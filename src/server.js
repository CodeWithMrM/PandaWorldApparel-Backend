const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

let server;

async function start() {
  try {
    // Fail fast if the database is unreachable.
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log('[db] Connected to PostgreSQL via Prisma');

    server = app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] Running in ${env.nodeEnv} mode on port ${env.port}`);
      // eslint-disable-next-line no-console
      console.log(`[server] Health check: http://localhost:${env.port}/health`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`[server] Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      await prisma.$disconnect();
      // eslint-disable-next-line no-console
      console.log('[server] Closed out remaining connections. Bye!');
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }

  // Force shutdown if it takes too long.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[server] Unhandled Rejection:', reason);
});

start();
