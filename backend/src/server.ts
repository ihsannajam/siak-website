import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

const app = createApp();

export default app;

// app.listen hanya untuk local development, jangan untuk Vercel serverless
if (!process.env.VERCEL) {
  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`\n🚀 SIAK An Nahl API berjalan di http://localhost:${env.port}`);
    // eslint-disable-next-line no-console
    console.log(`📚 Dokumentasi API: http://localhost:${env.port}/api-docs`);
    // eslint-disable-next-line no-console
    console.log(`🔌 Base URL: http://localhost:${env.port}${env.apiPrefix}\n`);
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} diterima, menutup server...`);

    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}