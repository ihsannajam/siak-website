// Entry point serverless untuk Vercel.
// Vercel tidak memakai app.listen() (lihat src/server.ts untuk run lokal),
// melainkan meng-handle setiap request lewat default export Express app ini.
import { createApp } from '../src/app';

const app = createApp();

export default app;
