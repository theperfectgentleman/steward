import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function getR2Client(): S3Client {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint =
    process.env.R2_ENDPOINT?.replace(/\/$/, "") ||
    (accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : undefined);

  if (!endpoint) {
    throw new Error("R2 is not configured (missing R2_ENDPOINT or R2_ACCOUNT_ID)");
  }

  client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  return client;
}

function bucketName(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET is not configured");
  return bucket;
}

/** Optional key prefix (e.g. steward/ from R2_S3_API_URL path). */
export function r2KeyPrefix(): string {
  const explicit = process.env.R2_KEY_PREFIX?.replace(/^\/|\/$/g, "");
  if (explicit) return explicit;

  const s3ApiUrl = process.env.R2_S3_API_URL;
  if (s3ApiUrl) {
    try {
      const path = new URL(s3ApiUrl).pathname.replace(/^\/|\/$/g, "");
      if (path) return path;
    } catch {
      /* ignore malformed URL */
    }
  }

  return "steward";
}

export function buildR2Key(...segments: string[]): string {
  const parts = [r2KeyPrefix(), ...segments]
    .filter(Boolean)
    .join("/")
    .split("/")
    .filter(Boolean);
  return parts.join("/");
}

export function sanitizeStorageFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return (base.slice(0, 200) || "file").toLowerCase();
}

export async function putR2Object(opts: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
}): Promise<void> {
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured");
  }

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType || "application/octet-stream",
    }),
  );
}

export async function getR2Object(key: string) {
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured");
  }

  const result = await getR2Client().send(
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error("Empty object body");
  }

  return {
    body: result.Body,
    contentType: result.ContentType,
    contentLength: result.ContentLength,
  };
}

export async function deleteR2Object(key: string): Promise<void> {
  if (!isR2Configured() || !key) return;

  try {
    await getR2Client().send(
      new DeleteObjectCommand({
        Bucket: bucketName(),
        Key: key,
      }),
    );
  } catch (err) {
    console.error("R2 delete failed:", key, err);
  }
}

/** Public URL when the bucket has R2.dev or custom domain access enabled. */
export function publicR2Url(storageKey: string): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/${storageKey}`;
}
