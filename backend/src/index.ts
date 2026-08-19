import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { closeSocket, initSocket } from './sockets/socket';

async function bootstrap(): Promise<void> {
  await prisma.$connect();

  const app = createApp();
  const server = http.createServer(app);
  server.timeout = 30_000;
  server.headersTimeout = 35_000;
  server.requestTimeout = 30_000;
  initSocket(server);

  server.listen(env.PORT, () => {
    console.log(`WeePark API running on ${env.API_URL}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — shutting down`);

    const force = setTimeout(() => {
      console.error('Shutdown timed out');
      process.exit(1);
    }, 15_000);
    force.unref();

    await closeSocket();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await prisma.$disconnect();
    process.exit(exitCode);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection', reason);
  });
  process.on('uncaughtException', (error) => {
    console.error('uncaughtException', error);
    void shutdown('uncaughtException', 1);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
