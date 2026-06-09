import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SIAK RQ An Nahl API',
      version: '1.0.0',
      description:
        'REST API Sistem Informasi Akademik RQ An Nahl. Autentikasi JWT + RBAC. ' +
        'Sebagian besar modul mengikuti pola CRUD standar: ' +
        'GET /{module}, GET /{module}/{id}, POST /{module}, PUT /{module}/{id}, DELETE /{module}/{id}.',
    },
    servers: [{ url: env.apiPrefix, description: 'API server' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    tags: [
      { name: 'Auth' },
      { name: 'Dashboard' },
    ],
  },
  apis: ['./src/modules/**/*.ts'],
};

export function setupSwagger(app: Express) {
  const spec = swaggerJsdoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
  app.get('/api-docs.json', (_req, res) => res.json(spec));
}
