import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import multer from 'multer';
import path from 'path';
import { env } from '../config/env';
import { ApiError } from './ApiError';

// Inisialisasi S3 Client yang diarahkan ke endpoint S3 Supabase
const s3Client = new S3Client({
  forcePathStyle: true,
  region: env.storage.region || 'ap-southeast-3', // Isi sesuai region project Supabase Anda (misal: ap-southeast-1)
  endpoint: `https://${env.storage.projectRef}.storage.supabase.co/storage/v1/s3`, // Gunakan ID project Anda
  credentials: {
    accessKeyId: env.storage.accessKeyId,        // Masukkan Access Key ID Anda di sini
    secretAccessKey: env.storage.secretAccessKey // Masukkan Secret Access Key Anda di sini
  }
});

const BUCKET_NAME = env.storage.bucketName || 'uploads';

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

export async function uploadToSupabase(file: Express.Multer.File, folderParam?: string): Promise<string> {
  const folder = folderParam || 'general';
  const ext = path.extname(file.originalname);
  const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
  const fileName = `${base}-${Date.now()}${ext}`;
  const supabasePath = `${folder}/${fileName}`;

  // Menggunakan lib-storage untuk menangani upload buffer memori ke S3 Supabase
  const parallelUploads3 = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: supabasePath,
      Body: file.buffer,
      ContentType: file.mimetype,
    },
  });

  await parallelUploads3.done();
  return supabasePath;
}

export function getPublicUrl(filePath: string): string {
  if (!filePath) return '';
  // Format URL publik bawaan objek CDN Supabase
  return `https://${env.storage.projectRef}.supabase.co/storage/v1/object/public/${BUCKET_NAME}/${filePath}`;
}
