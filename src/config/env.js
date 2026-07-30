require('dotenv').config();

/**
 * Centralised, validated access to environment variables.
 * Fail fast on boot if something critical is missing.
 */
const required = ['DATABASE_URL', 'CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    // eslint-disable-next-line no-console
    console.error(`[env] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  appUrl: process.env.APP_URL || 'http://localhost:5000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  databaseUrl: process.env.DATABASE_URL,

  clerk: {
    // @clerk/express reads CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY from
    // process.env directly, but we keep copies here for explicitness and
    // for use in our own webhook verification code.
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
  },

  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim()),

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 5,
  },

  payfast: {
    merchantId: process.env.PAYFAST_MERCHANT_ID,
    merchantKey: process.env.PAYFAST_MERCHANT_KEY,
    passphrase: process.env.PAYFAST_PASSPHRASE || '',
    sandbox: (process.env.PAYFAST_SANDBOX || 'true') === 'true',
    host: process.env.PAYFAST_HOST || 'sandbox.payfast.co.za',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
  },
};
