const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const env = require('./config/env');
const routes = require('./routes');
const webhookRoutes = require('./routes/webhook.routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const { generalLimiter } = require('./middleware/rateLimiter.middleware');
const { withClerk } = require('./middleware/auth.middleware');
const ApiResponse = require('./utils/ApiResponse');

const app = express();

// Trust the first proxy (needed for correct client IPs behind a load
// balancer / reverse proxy, which express-rate-limit relies on).
app.set('trust proxy', 1);

// --- Security & core middleware ---
app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

// --- Clerk webhook: MUST be mounted with a raw body parser, and BEFORE
// the global express.json() below, because Svix needs the untouched raw
// request body to verify the webhook signature. ---
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// PayFast ITN posts as application/x-www-form-urlencoded.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Statically serve locally-uploaded product images.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Apply a general rate limiter across the whole API surface.
// Stricter, endpoint-specific limiters are layered on top in the route files.
app.use('/api', generalLimiter);

// Clerk middleware: parses the session token (if present) on every
// request and attaches auth state to req.auth. Doesn't reject
// unauthenticated requests by itself — see middleware/auth.middleware.js's
// `authenticate` for that.
app.use(withClerk);

// --- Health check ---
app.get('/health', (req, res) => {
  return new ApiResponse(200, { uptime: process.uptime() }, 'OK').send(res);
});

// --- API routes ---
app.use('/api', routes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PandaWorld API is running",
  });
});

// --- 404 + error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
