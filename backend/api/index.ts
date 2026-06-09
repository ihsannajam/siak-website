import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/app';
import type { Application } from 'express';

// Initialize Express app once (cold start). If it throws, we still
// return a proper JSON error — never a raw Vercel 502 without CORS headers.
let app: Application | undefined;
let initError: unknown;
try {
  app = createApp();
} catch (err) {
  initError = err;
  console.error('[api/index] App init failed:', err);
}

// Parse allowed origins from env at cold-start time.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers['origin'];
  if (!origin) return;

  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/siak-website.*\.vercel\.app$/.test(origin);

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
}

// Vercel serverless function handler.
// CORS headers are set here first so they are present even when Express
// throws an error (error handler does not re-set them).
export default function handler(req: IncomingMessage, res: ServerResponse): void {
  setCorsHeaders(req, res);

  // Respond to preflight directly — no need to involve Express.
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!app) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Server initialization failed',
      details: String(initError),
    }));
    return;
  }

  (app as any)(req, res);
}
