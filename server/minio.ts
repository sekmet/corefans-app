import { Client } from "minio";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? "127.0.0.1";
const MINIO_PORT = Number(process.env.MINIO_PORT ?? 9000);
const MINIO_USE_SSL = (process.env.MINIO_USE_SSL ?? "false").toLowerCase() === "true";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? "minioadmin";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? "minioadmin";

export const MINIO_BUCKET_VIDEOS = process.env.MINIO_BUCKET_VIDEOS ?? "videos";
export const MINIO_BUCKET_THUMBS = process.env.MINIO_BUCKET_THUMBS ?? "thumbs";

let singleton: Client | null = null;
export function getMinio(): Client {
  if (!singleton) {
    singleton = new Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });
  }
  return singleton;
}

export async function presignPut(params: { bucket: string; key: string; expirySec?: number; contentType?: string }) {
  const { bucket, key, expirySec = 900, contentType } = params;
  const minio = getMinio();
  // MinIO presignedPutObject includes contentType via reqParams
  const url = await minio.presignedPutObject(bucket, key, expirySec, {
    "Content-Type": contentType ?? "application/octet-stream",
  });
  return { url, bucket, key, expirySec };
}

export async function presignGet(params: { bucket: string; key: string; expirySec?: number }) {
  const { bucket, key, expirySec = 900 } = params;
  const minio = getMinio();
  const url = await minio.presignedGetObject(bucket, key, expirySec);
  return { url, bucket, key, expirySec };
}
