import { createApp } from '../src/app';

let app: ReturnType<typeof createApp> | null = null;
let initError: unknown;

try {
  app = createApp();
} catch (err) {
  initError = err;
  console.error('[api] App init failed:', err);
}

// Export the Express app directly so Vercel's @vercel/node runtime wraps it
// correctly and waits for async middleware (DB queries, etc.) to finish.
// If initialization failed, export a minimal fallback that still returns
// CORS headers so the browser can read the error message.
export default app ?? function fallback(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    message: 'Server initialization failed',
    details: String(initError),
  }));
};
