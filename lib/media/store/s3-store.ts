/**
 * S3 / Cloudflare R2 storage adapter.
 *
 * Required env vars:
 *   MEDIA_STORAGE=s3
 *   MEDIA_S3_BUCKET          — bucket name
 *   MEDIA_S3_REGION          — AWS region (e.g. "us-east-1") or "auto" for R2
 *   MEDIA_S3_ACCESS_KEY_ID
 *   MEDIA_S3_SECRET_ACCESS_KEY
 *   MEDIA_S3_ENDPOINT        — optional; set for R2: https://<account>.r2.cloudflarestorage.com
 *   MEDIA_S3_PUBLIC_URL      — CDN base URL (e.g. https://assets.example.com)
 *
 * Install: npm install @aws-sdk/client-s3
 */
import type { StorageAdapter, PutOptions, PutResult } from './types';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`S3 storage adapter requires env var ${key}`);
  return v;
}

export const s3Adapter: StorageAdapter = {
  providerName: 's3',

  async put(opts: PutOptions): Promise<PutResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdk = await (eval('import("@aws-sdk/client-s3")') as Promise<any>);
    const bucket    = requireEnv('MEDIA_S3_BUCKET');
    const publicUrl = requireEnv('MEDIA_S3_PUBLIC_URL');

    const client = new sdk.S3Client({
      region:      requireEnv('MEDIA_S3_REGION'),
      endpoint:    process.env.MEDIA_S3_ENDPOINT,
      credentials: {
        accessKeyId:     requireEnv('MEDIA_S3_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('MEDIA_S3_SECRET_ACCESS_KEY'),
      },
    });

    await client.send(new sdk.PutObjectCommand({
      Bucket:      bucket,
      Key:         opts.filename,
      Body:        opts.buffer,
      ContentType: opts.mimeType,
      ACL:         opts.isPublic !== false ? 'public-read' : 'private',
    }));

    return { url: `${publicUrl.replace(/\/$/, '')}/${opts.filename}` };
  },

  async delete(filename: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdk = await (eval('import("@aws-sdk/client-s3")') as Promise<any>);
    const client = new sdk.S3Client({
      region:      requireEnv('MEDIA_S3_REGION'),
      endpoint:    process.env.MEDIA_S3_ENDPOINT,
      credentials: {
        accessKeyId:     requireEnv('MEDIA_S3_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('MEDIA_S3_SECRET_ACCESS_KEY'),
      },
    });
    await client.send(new sdk.DeleteObjectCommand({
      Bucket: requireEnv('MEDIA_S3_BUCKET'),
      Key:    filename,
    }));
  },

  async deleteMany(filenames: readonly string[]): Promise<void> {
    await Promise.all(filenames.map((f) => this.delete(f)));
  },

  publicUrl(filename: string): string {
    return `${requireEnv('MEDIA_S3_PUBLIC_URL').replace(/\/$/, '')}/${filename}`;
  },
};
