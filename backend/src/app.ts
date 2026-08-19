import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env, isProduction, isTest } from './config/env';
import { prisma } from './config/prisma';
import { swaggerSpec } from './config/swagger';
import { apiRouter, publicRouter } from './routes';
import { apiLimiter } from './middlewares/rateLimiter';
import { globalErrorHandler, notFoundHandler } from './middlewares/errorHandler';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      hsts: isProduction && env.ENFORCE_HTTPS ? { maxAge: 15552000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(cookieParser());
  if (!isTest) {
    app.use(morgan(isProduction ? 'combined' : 'dev'));
  }

  if (isProduction && env.ENFORCE_HTTPS) {
    app.use((req, res, next) => {
      const proto = req.header('x-forwarded-proto') ?? (req.secure ? 'https' : 'http');
      if (proto === 'https') {
        next();
        return;
      }
      res.redirect(301, `https://${req.header('host')}${req.originalUrl}`);
    });
  }

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  app.use(apiLimiter);

  app.use('/api/v1', apiRouter);
  app.use('/api/v1/public', publicRouter);

  if (!isProduction) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'WeePark API Docs' }));
  }

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
