import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '5000', 10),
  apiPrefix: process.env.API_PREFIX ?? '/api',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  databaseUrl: (() => {
    const url = required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/siak_annahl?schema=public');
    if (!process.env.DATABASE_URL) process.env.DATABASE_URL = url;
    return url;
  })(),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
    maxFileSizeMb: parseInt(
      process.env.STORAGE_MAX_FILE_SIZE_MB ?? process.env.MAX_FILE_SIZE_MB ?? '5',
      10,
    ),
    // Supabase S3-compatible storage
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
    projectRef: process.env.STORAGE_PROJECT_REF ?? '',
    region: process.env.STORAGE_REGION ?? 'ap-southeast-1',
    bucketName: process.env.STORAGE_BUCKET_NAME ?? 'uploads',
  },

  loginRate: {
    windowMinutes: parseInt(process.env.LOGIN_RATE_WINDOW_MINUTES ?? '15', 10),
    max: parseInt(process.env.LOGIN_RATE_MAX ?? '10', 10),
  },

  get isProd() {
    return this.nodeEnv === 'production';
  },
};
