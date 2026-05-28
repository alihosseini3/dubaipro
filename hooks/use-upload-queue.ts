'use client';

/**
 * useUploadQueue — core XHR upload engine shared by Single & Multi uploaders.
 *
 * Features:
 *  - Per-file XHR with real upload-progress events (fetch can't do this)
 *  - Abort any in-flight upload
 *  - Duplicate detection: SHA-256 hash of file bytes checked against
 *    GET /api/media?q=hash:<hex>&limit=1 before transmitting
 *  - Compression analysis: warns when original file > 3× expected size
 *    for its dimensions
 *  - Parallel uploads, independent abort
 */

import { useCallback, useRef } from 'react';
import type { PipelineResult } from '@/lib/media/types';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Types                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface UploadItem {
  id:        string;
  file:      File;
  objectUrl: string;
  progress:  number;
  /** true = upload bytes sent, server processing */
  processing: boolean;
  error?:    string;
  result?:   PipelineResult;
}

export interface DuplicateInfo {
  assetId:    string;
  url:        string;
  existingId: string;
}

export interface CompressionWarning {
  fileSizeKb:    number;
  expectedMaxKb: number;
  ratio:         number;
}

export interface UploadFormFields {
  context?:     string;
  folder?:      string;
  skipAvif?:    boolean;
  alt?:         string;
  title?:       string;
  seoTitle?:    string;
  caption?:     string;
  description?: string;
  keywords?:    string[];
  tags?:        string[];
  entityType?:  string;
  entityId?:    string;
  field?:       string;
  /** Raw canvas-cropped blob to upload instead of the original file. */
  croppedBlob?: Blob;
}

export interface StartUploadResult {
  id: string;
  duplicate?: DuplicateInfo | null;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Hash utility (browser-side)                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

async function sha256Hex(file: File): Promise<string> {
  const buf    = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Compression analysis                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

export function analyzeCompression(
  fileSizeBytes: number,
  width: number,
  height: number,
): CompressionWarning | null {
  if (!width || !height) return null;
  const pixels = width * height;
  // Rough heuristic: well-compressed JPEG/WebP should be ~0.3 bits/px
  // ≈ 0.0375 bytes/px; 3× that = 0.1125 bytes/px threshold.
  const expectedMaxKb = Math.round((pixels * 0.1125) / 1024);
  const fileSizeKb    = Math.round(fileSizeBytes / 1024);
  if (fileSizeKb <= expectedMaxKb) return null;
  return { fileSizeKb, expectedMaxKb, ratio: fileSizeKb / expectedMaxKb };
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Hook                                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface UseUploadQueueOptions {
  onItemChange: (id: string, patch: Partial<UploadItem>) => void;
  onComplete:   (id: string, result: PipelineResult) => void;
  onError:      (id: string, message: string) => void;
  onAbort:      (id: string) => void;
}

export function useUploadQueue(opts: UseUploadQueueOptions) {
  const { onItemChange, onComplete, onError, onAbort } = opts;
  const xhrMap = useRef<Map<string, XMLHttpRequest>>(new Map());

  /**
   * Check server for duplicate by hash.
   * Returns the existing asset id if found, null otherwise.
   */
  const checkDuplicate = useCallback(async (hash: string): Promise<DuplicateInfo | null> => {
    try {
      const res = await fetch(`/api/media?q=hash:${hash}&limit=1`);
      if (!res.ok) return null;
      const json = await res.json() as { data?: Array<{ id: string; url: string }> };
      const hit  = json.data?.[0];
      if (!hit) return null;
      return { assetId: hit.id, url: hit.url, existingId: hit.id };
    } catch {
      return null;
    }
  }, []);

  /**
   * Start uploading one file. Returns the assigned item id.
   * Caller should have already added the item to their state.
   */
  const startUpload = useCallback(async (
    id: string,
    file: File,
    fields: UploadFormFields = {},
  ): Promise<void> => {
    const { croppedBlob, ...rest } = fields;

    const fd = new FormData();
    fd.append('file', croppedBlob ? new File([croppedBlob], file.name, { type: croppedBlob.type }) : file);
    if (rest.context)     fd.append('context',     rest.context);
    if (rest.folder)      fd.append('folder',      rest.folder);
    if (rest.skipAvif)    fd.append('skipAvif',    'true');
    if (rest.alt)         fd.append('alt',         rest.alt);
    if (rest.title)       fd.append('title',       rest.title);
    if (rest.seoTitle)    fd.append('seoTitle',    rest.seoTitle);
    if (rest.caption)     fd.append('caption',     rest.caption);
    if (rest.description) fd.append('description', rest.description);
    if (rest.keywords?.length)  fd.append('keywords',  JSON.stringify(rest.keywords));
    if (rest.tags?.length)      fd.append('tags',      JSON.stringify(rest.tags));
    if (rest.entityType)  fd.append('entityType',  rest.entityType);
    if (rest.entityId)    fd.append('entityId',    rest.entityId);
    if (rest.field)       fd.append('field',       rest.field);

    const xhr = new XMLHttpRequest();
    xhrMap.current.set(id, xhr);
    xhr.open('POST', '/api/media/upload', true);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const progress = Math.round((e.loaded / e.total) * 100);
      onItemChange(id, { progress });
      if (progress === 100) onItemChange(id, { processing: true });
    };

    xhr.onload = () => {
      xhrMap.current.delete(id);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const payload = JSON.parse(xhr.responseText) as { data?: PipelineResult };
          if (payload.data) { onComplete(id, payload.data); return; }
        } catch { /* fallthrough */ }
        onError(id, 'Upload failed — unexpected response');
        return;
      }
      let msg = 'Upload failed';
      try {
        const p = JSON.parse(xhr.responseText) as { error?: string };
        if (p.error === 'file too large')       msg = 'File is too large';
        else if (p.error === 'unsupported file type') msg = 'Unsupported file type';
        else if (xhr.status === 401)            msg = 'Not authorized';
        else if (p.error)                       msg = p.error;
      } catch { /* keep */ }
      onError(id, msg);
    };

    xhr.onerror = () => {
      xhrMap.current.delete(id);
      onError(id, 'Network error — please try again');
    };

    xhr.onabort = () => {
      xhrMap.current.delete(id);
      onAbort(id);
    };

    xhr.send(fd);
  }, [onItemChange, onComplete, onError, onAbort]);

  const abort = useCallback((id: string) => {
    xhrMap.current.get(id)?.abort();
  }, []);

  const abortAll = useCallback(() => {
    xhrMap.current.forEach((xhr) => xhr.abort());
    xhrMap.current.clear();
  }, []);

  return { startUpload, abort, abortAll, checkDuplicate };
}
