import { Request, Response } from 'express';
import { authService } from './auth.service';
import { success } from '../../common/apiResponse';
import { asyncHandler } from '../../common/asyncHandler';
import { writeAudit } from '../../common/audit';

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    await writeAudit({
      req,
      userId: result.user.id,
      action: 'LOGIN',
      module: 'auth',
      detail: `User ${username} berhasil login`,
    });
    return success(res, result, 'Login berhasil');
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const tokens = await authService.refresh(refreshToken);
    return success(res, tokens, 'Token diperbarui');
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.body?.refreshToken);
    await writeAudit({ req, action: 'LOGOUT', module: 'auth' });
    return success(res, null, 'Logout berhasil');
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.me(req.user!.id);
    return success(res, data, 'Profil pengguna');
  }),
};
