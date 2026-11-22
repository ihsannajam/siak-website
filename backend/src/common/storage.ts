import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import multer from 'multer';
import path from 'path';
import { env } from '../config/env';
import { ApiError } from './ApiError';

// Inisialisasi S3 Client yang diarahkan ke endpoint S3 Supabase
export const s3Client = new S3Client({
  forcePathStyle: true,
  region: env.storage.region || 'ap-southeast-3', // Isi sesuai region project Supabase Anda (misal: ap-southeast-1)
  endpoint: `https://${env.storage.projectRef}.storage.supabase.co/storage/v1/s3`, // Gunakan ID project Anda
  credentials: {
    accessKeyId: env.storage.accessKeyId,        // Masukkan Access Key ID Anda di sini
    secretAccessKey: env.storage.secretAccessKey // Masukkan Secret Access Key Anda di sini
  }
});

export const BUCKET_NAME = env.storage.bucketName || 'uploads';
export const PRIVATE_BUCKET_NAME = env.storage.privateBucketName;
export const PRIVATE_PATH_PREFIX = 'private://';

/** Nama objek acak agar nama asli dokumen tidak ikut tersimpan di storage. */
export function buildPrivateKey(folder: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
  return `${folder}/${randomUUID()}${ext}`;
}

/** Upload ke bucket privat. Tidak pernah jatuh kembali ke bucket publik. */
export async function uploadPrivate(file: Express.Multer.File, folder: string): Promise<string> {
  const key = buildPrivateKey(folder, file.originalname);
  await new Upload({
    client: s3Client,
    params: { Bucket: PRIVATE_BUCKET_NAME, Key: key, Body: file.buffer, ContentType: file.mimetype },
  }).done();
  return `${PRIVATE_PATH_PREFIX}${key}`;
}

/** Mengenali path privat baru dan URL publik lama milik project ini. */
export function resolveStoredObject(filePath: string): { bucket: string; key: string } | null {
  if (filePath.startsWith(PRIVATE_PATH_PREFIX)) {
    return { bucket: PRIVATE_BUCKET_NAME, key: filePath.slice(PRIVATE_PATH_PREFIX.length) };
  }
  try {
    const url = new URL(filePath);
    const match = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (url.hostname !== `${env.storage.projectRef}.supabase.co` || !match) return null;
    return { bucket: decodeURIComponent(match[1]), key: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

/** Link sementara untuk membuka file; panggil hanya setelah izin pengguna diperiksa. */
export async function getSignedFileUrl(filePath: string, expiresInSeconds = 60): Promise<string> {
  const object = resolveStoredObject(filePath);
  if (!object) throw ApiError.notFound('File tidak ditemukan');
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: object.bucket, Key: object.key }),
    { expiresIn: expiresInSeconds },
  );
}

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'text/csv',
]);

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: env.storage.maxFileSizeMb * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(ApiError.badRequest(`Tipe file tidak diizinkan: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});
