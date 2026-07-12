import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { authLimiter } from '../middlewares/rateLimiter';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validator';

export const authRoutes = Router();

authRoutes.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
authRoutes.post('/refresh', validate({ body: refreshSchema }), authController.refresh);
authRoutes.post('/logout', validate({ body: refreshSchema }), authController.logout);
authRoutes.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), authController.forgotPassword);
authRoutes.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), authController.resetPassword);

authRoutes.get('/me', authenticate, authController.me);
authRoutes.patch('/me', authenticate, validate({ body: updateProfileSchema }), authController.updateProfile);
authRoutes.post('/change-password', authenticate, validate({ body: changePasswordSchema }), authController.changePassword);
authRoutes.get('/sessions', authenticate, authController.sessions);
authRoutes.delete('/sessions/:id', authenticate, authController.revokeSession);
