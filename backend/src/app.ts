import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { apiRouter } from './routes';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler';
import { setupSwagger } from './config/swagger';

export function createApp() {
  const app = express();

  // CORS_ORIGIN supports comma-separated values, e.g.:
  // CORS_ORIGIN=http://localhost:5173,https://siak-website.vercel.app
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow Postman, curl, health check, server-to-server request
    if (!origin) {
      return callback(null, true);
    }

    const isAllowedOrigin = allowedOrigins.includes(origin);

    // Allow Vercel preview deployments untuk project frontend
    const isVercelPreview =
      /^https:\/\/siak-website[\w-]*\.vercel\.app$/.test(origin);

    if (isAllowedOrigin || isVercelPreview) {
      return callback(null, true);
    }

    console.log("CORS blocked origin:", origin);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

  // Security & parsing
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors(corsOptions),
  );

app.options("*", cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (!env.isProd) app.use(morgan('dev'));

  // Static: uploaded files (local storage driver)
  app.use('/uploads', express.static(path.resolve(process.cwd(), env.storage.uploadDir)));

  // API docs
  setupSwagger(app);

  // API
  app.use(env.apiPrefix, apiRouter);

  app.get('/', (_req, res) => {
    res.json({
      name: 'SIAK RQ An Nahl API',
      docs: '/api-docs',
      api: env.apiPrefix,
    });
  });

  // Errors
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
