/**
 * StorageAdapter — pluggable storage backend interface.
 *
 * The pipeline calls only these four methods so swapping from local FS
 * to S3 / Cloudflare R2 / Cloudflare Images requires only implementing
 * this interface and updating the factory in store/index.ts.
 */

export interface PutOptions {
  /** Relative filename (no directory prefix). */
  filename: string;
  buffer: Buffer;
  mimeType?: string;
  /** Make the object publicly readable. Default true. */
  isPublic?: boolean;
}

export interface PutResult {
  /** Public URL served to browsers. */
  url: string;
  /** Local disk path — only set for the FS adapter. */
  diskPath?: string;
}

export interface StorageAdapter {
  readonly providerName: string;

  /** Write a single file. Returns its public URL. */
  put(opts: PutOptions): Promise<PutResult>;

  /** Delete one file. Missing files must be silently ignored. */
  delete(filename: string): Promise<void>;

  /** Bulk delete. */
  deleteMany(filenames: readonly string[]): Promise<void>;

  /** Build the public URL for a filename without writing anything. */
  publicUrl(filename: string): string;
}
