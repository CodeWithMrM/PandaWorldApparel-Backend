const { PrismaClient } = require('@prisma/client');
const env = require('./env');

/**
 * A single, shared Prisma Client instance.
 * In development, Node's module cache + nodemon restarts can create many
 * PrismaClient instances and exhaust DB connections, so we cache it on
 * `global` in non-production environments.
 */
let prisma;

if (env.nodeEnv === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['warn', 'error'],
    });
  }
  prisma = global.__prisma;
}

module.exports = prisma;
