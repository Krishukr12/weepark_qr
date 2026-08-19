import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { userRepository } from '../repositories/user.repository';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/request';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/apiError';
import { assertSameSiteOrigin, clearRefreshCookie, readRefreshToken, setRefreshCookie } from '../utils/cookies';
import type { UpdateProfileInput } from '../validators/auth.validator';

function loginContext(req: Request): { userAgent?: string; ipAddress?: string } {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.login(email, password, loginContext(req));
    setRefreshCookie(res, result.refreshToken);
    sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 200, 'Logged in successfully');
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    assertSameSiteOrigin(req);
    const refreshToken = readRefreshToken(req);
    if (!refreshToken) throw ApiError.unauthorized('Refresh token is missing');
    const result = await authService.refresh(refreshToken, loginContext(req));
    setRefreshCookie(res, result.refreshToken);
    sendSuccess(res, { user: result.user, accessToken: result.accessToken });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = readRefreshToken(req);
    if (refreshToken) await authService.logout(refreshToken);
    clearRefreshCookie(res);
    sendSuccess(res, null, 200, 'Logged out successfully');
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as { email: string };
    await authService.forgotPassword(email);
    sendSuccess(res, null, 200, 'If that email exists, a reset link has been sent');
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body as { token: string; password: string };
    await authService.resetPassword(token, password);
    sendSuccess(res, null, 200, 'Password has been reset. You can now sign in.');
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    sendSuccess(res, null, 200, 'Password changed successfully');
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await userRepository.findById(req.user.id);
    if (!user) throw ApiError.notFound('User not found');
    const { passwordHash: _ignored, ...safe } = user;
    sendSuccess(res, safe);
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const input = req.body as UpdateProfileInput;
    const user = await userRepository.update(req.user.id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
    });
    const { passwordHash: _ignored, ...safe } = user;
    sendSuccess(res, safe, 200, 'Profile updated');
  }),

  sessions: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const sessions = await authService.getSessions(req.user.id);
    sendSuccess(res, sessions);
  }),

  revokeSession: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await authService.revokeSession(req.user.id, param(req, 'id'));
    sendSuccess(res, null, 200, 'Session revoked');
  }),
};
