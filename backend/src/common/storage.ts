import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env';
import { ApiError } from './ApiError';

/**
 * Local-disk storage for development. The interface is intentionally thin so it
 * can be swapped for an S3/GCS driver later (set STORAGE_DRIVER=s3 and implement
 * an equivalent multer storage engine + getPublicUrl).
 */

const uploadRoot = path.resolve(process.cwd(), env.storage.uploadDir);

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'text/csv',
]);

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    // group by module folder if provided: req.params.module or "general"
    const folder = (req.params.folder as string) || 'general';
    const dir = path.join(uploadRoot, folder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 40);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

// Business Rule #10: validate file type + max size on every upload.
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

/** Returns a path/URL the frontend can use to fetch the file. */
export function getPublicUrl(filePath: string): string {
  const rel = path.relative(uploadRoot, filePath).replace(/\\/g, '/');
  return `/uploads/${rel}`;
}

export function deleteFile(filePath: string) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}
