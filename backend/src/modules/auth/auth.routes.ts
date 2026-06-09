import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/auth';
import { loginSchema, refreshSchema } from './auth.validation';
import { env } from '../../config/env';

const router = Router();

// Security: rate limit login attempts.
const loginLimiter = rateLimit({
  windowMs: env.loginRate.windowMinutes * 60 * 1000,
  max: env.loginRate.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login. Coba lagi nanti.',
  },
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login dan dapatkan access + refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: admin }
 *               password: { type: string, example: Admin123! }
 *     responses:
 *       200: { description: Login berhasil }
 */
router.post('/login', loginLimiter, validate(loginSchema), authController.login);

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Tukar refresh token dengan access token baru
 */
router.post('/refresh-token', validate(refreshSchema), authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout dan revoke refresh token
 */
router.post('/logout', authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Profil pengguna yang sedang login (termasuk roles & permissions)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me', authenticate, authController.me);

export default router;
