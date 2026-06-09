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

  // Security & parsing
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean),
      credentials: true,
    }),
  );
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
