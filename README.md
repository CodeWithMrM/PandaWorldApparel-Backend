# E-Commerce Backend API

A production-ready e-commerce REST API built with **Node.js, Express, PostgreSQL, and Prisma ORM**, featuring JWT authentication, role-based authorization, shopping cart, orders, and **PayFast** (South Africa) payment integration.

## Tech Stack

- **Runtime:** Node.js (>=18) + Express.js
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** [Clerk](https://clerk.com) (frontend handles sign-up/sign-in; this API verifies Clerk session tokens and syncs users via webhook)
- **Uploads:** Multer (local disk by default, cloud-storage stub included)
- **Payments:** PayFast (South Africa)
- **Security:** Helmet, CORS, express-rate-limit, express-validator

## Project Structure

```
src/
├── controllers/     # Request handlers (thin — call services)
├── routes/           # Express routers
├── middleware/        # auth, validation, error handling, rate limiting, uploads
├── services/          # Business logic + Prisma queries
├── validators/         # express-validator rule sets
├── utils/              # ApiError, ApiResponse, asyncHandler, jwt, payfast, pagination
├── config/             # env loader, Prisma client singleton
├── uploads/             # local product image uploads (gitignored)
├── app.js
└── server.js
prisma/
├── schema.prisma
└── seed.js
```

## 1. Prerequisites

- Node.js 18+
- A running PostgreSQL instance (local install, Docker, or a hosted DB like Supabase/Neon/RDS)
- A free [Clerk](https://clerk.com) account/application (for auth)
- A [PayFast](https://www.payfast.co.za/) merchant account (sandbox credentials are fine for development: https://sandbox.payfast.co.za)

## 2. Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and fill in your values
cp .env.example .env

# 3. Create the database schema
npx prisma migrate dev --name init

# 4. (Optional) Seed sample categories/products
npm run prisma:seed

# 5. Start the dev server (auto-restarts on changes)
npm run dev

# ...or start it normally
npm start
```

The API will be available at `http://localhost:5000` (or whatever `PORT` you set). Health check: `GET /health`.

There's no seeded admin login — accounts are created via Clerk. See section 5 below for how to get an admin user.

## 3. Environment Variables

See `.env.example` for the full list. Key ones:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | From Clerk Dashboard → API Keys |
| `CLERK_PUBLISHABLE_KEY` | From Clerk Dashboard → API Keys (used by your frontend, kept here for reference) |
| `CLERK_WEBHOOK_SECRET` | From Clerk Dashboard → Webhooks → your endpoint's signing secret |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `STORAGE_DRIVER` | `local` or `cloud` (cloud is a stub — see below) |
| `PAYFAST_MERCHANT_ID` / `PAYFAST_MERCHANT_KEY` | From your PayFast merchant account |
| `PAYFAST_PASSPHRASE` | Optional, but recommended — set in your PayFast account settings too |
| `PAYFAST_HOST` | `sandbox.payfast.co.za` for testing, `www.payfast.co.za` for production |
| `RATE_LIMIT_*` | Rate limiting tuning |

## 4. Database (Prisma) Setup Notes

- `npx prisma migrate dev` creates/updates tables based on `prisma/schema.prisma` and regenerates the Prisma Client.
- `npx prisma studio` opens a GUI to browse/edit data.
- `npx prisma migrate deploy` is the command to run in CI/production (applies pending migrations without prompting).
- The schema defines: `User`, `Category`, `Product`, `Cart`, `CartItem`, `Order`, `OrderItem`, plus `Role`, `OrderStatus`, and `PaymentStatus` enums, with indexes on frequently-queried columns (email, product name/category/price, order status).

## 5. Authentication & Roles (Clerk)

Sign-up, sign-in, session management, and password reset are all handled by **Clerk** on the frontend (via `@clerk/nextjs`, `@clerk/clerk-react`, etc. — not this repo). This backend's job is just to:

1. **Verify** the Clerk session token sent by the frontend.
2. **Sync** a local `User` row (and their `Cart`) so Postgres has something to join `Order`/`Cart`/etc. against.
3. **Authorize** based on a role stored in Clerk's `publicMetadata`.

### 5.1 Frontend → Backend

Your frontend sends the Clerk session token on every request:

```
Authorization: Bearer <clerk session token>
```

`authenticate` (in `src/middleware/auth.middleware.js`) verifies it via `@clerk/express`, looks up (or lazily creates, as a fallback) the matching local `User` by `clerkId`, and attaches it to `req.user`.

### 5.2 Roles

Roles live in Clerk, **not** as something a user can self-assign:

1. In the [Clerk Dashboard](https://dashboard.clerk.com), open **Users → (a user) → Metadata**.
2. Under **Public metadata**, set:
   ```json
   { "role": "ADMIN" }
   ```
3. That's it — `authenticate` re-reads `publicMetadata.role` from Clerk on every request (and keeps the local `User.role` cache in sync), so the change takes effect on the user's very next API call. New users without this metadata default to `CUSTOMER`.

> **Perf tip:** `authenticate` calls the Clerk backend API once per request to read `publicMetadata`. For lower latency at scale, configure a Clerk **JWT template** that embeds `public_metadata` as a session claim, then read it straight off `getAuth(req).sessionClaims` instead — see the comment in `auth.middleware.js`.

### 5.3 Webhook: keeping Postgres in sync

Configure a webhook in the Clerk Dashboard (**Webhooks → Add Endpoint**):

- **Endpoint URL:** `{APP_URL}/api/webhooks/clerk` (for local dev, expose your server with `ngrok http 5000` and use the ngrok URL)
- **Events to subscribe to:** `user.created`, `user.updated`, `user.deleted`
- Copy the **Signing Secret** into `CLERK_WEBHOOK_SECRET` in `.env`

What it does (`src/controllers/webhook.controller.js`):
- `user.created` → creates the local `User` + an empty `Cart`
- `user.updated` → updates name/email/phone/role (e.g. after you set `publicMetadata.role`)
- `user.deleted` → deletes the local `User` (cascades to their `Cart`; their `Order` history is kept per the schema's `onDelete: Restrict`, so deleting a user with orders will fail by design — handle that policy however fits your business)

The webhook route is mounted with a **raw body parser** in `app.js`, ahead of the global JSON parser, because Svix (Clerk's webhook signer) needs the untouched raw bytes to verify the signature.

### 5.4 Local development without a webhook

If you don't want to set up `ngrok`/webhooks yet, you don't strictly have to: `authenticate` lazily creates a local `User` row on first request if one doesn't exist yet, using data from the Clerk API. You'll just miss out on `user.updated`/`user.deleted` sync until the webhook is wired up.

## 6. File Uploads

`STORAGE_DRIVER=local` (default) writes product images to `src/uploads/` and serves them at `/uploads/<filename>`. Setting `STORAGE_DRIVER=cloud` is a **stub**: `src/services/storage.service.js` has clearly marked spots to wire up S3/Cloudinary/etc. Until implemented, it logs a warning and falls back to local URLs so the app keeps working.

## 7. PayFast Integration Flow

1. Client calls `POST /api/payments/payfast` with `{ orderId }` (must be an order belonging to the authenticated user).
2. API responds with `{ fields, processUrl }` — a signed set of form fields and the PayFast endpoint to POST them to.
3. Client auto-submits an HTML form (fields as hidden inputs) to `processUrl`, redirecting the shopper into PayFast's hosted checkout.
4. After payment, PayFast redirects the shopper's browser to `return_url` (`GET /api/payments/success`) or `cancel_url` (`GET /api/payments/cancel`), which redirect on to `CLIENT_URL`.
5. **Independently and reliably**, PayFast also calls `notify_url` (`POST /api/payments/notify`) server-to-server with the final payment result (ITN). This is signature-verified and is the **source of truth** used to update `order.paymentStatus` (`PAID`/`FAILED`) — never trust the browser redirect alone, since a user can close the tab before it fires.

> In production, additionally verify PayFast's IP range and consider doing a server-to-server "validate" callback to `www.payfast.co.za/eng/query/validate` per PayFast's docs for extra assurance.

## 8. Rate Limiting

Rate limiting is applied in layers:

- **Global limiter** on all `/api/*` routes (`RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS`).
- **Write limiter** on admin write operations (create/update category, product, order creation, payment session creation).
- **Payment notify limiter** on the PayFast ITN webhook (generous, since PayFast may retry, but still bounded).
- **Clerk webhook limiter** on `/webhooks/clerk` (same rationale — a public URL only Clerk should call, but bounded).

Sign-up/sign-in brute-force protection is handled by Clerk itself, since it owns those flows.

All limiters return a consistent `429` JSON body: `{ success: false, statusCode: 429, message: "..." }`.

## 9. API Endpoints

Base URL: `/api`

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/auth/me` | Bearer (Clerk) | Get current authenticated user's local profile |

Registration and login happen entirely via Clerk on the frontend — there are no `/register` or `/login` endpoints on this API.

### Users
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/profile` | Bearer | Get own profile |
| PUT | `/users/profile` | Bearer | Update own profile (name, phone — email/password are managed via Clerk) |
| GET | `/users` | Admin | List all users (paginated, search, filter by role) |
| DELETE | `/users/:id` | Admin | Delete a user |

### Categories
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/categories` | Public | List categories |
| GET | `/categories/:id` | Public | Get one category |
| POST | `/categories` | Admin | Create category |
| PUT | `/categories/:id` | Admin | Update category |
| DELETE | `/categories/:id` | Admin | Delete category (blocked if products still reference it) |

### Products
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/products` | Public | List products — supports `page`, `limit`, `search`, `categoryId`, `sortBy=price\|name`, `order=asc\|desc` |
| GET | `/products/:id` | Public | Get one product |
| POST | `/products` | Admin | Create product (multipart/form-data, field `image` for the file) |
| PUT | `/products/:id` | Admin | Update product |
| DELETE | `/products/:id` | Admin | Delete product |

Example: `GET /api/products?search=phone&categoryId=abc123&sortBy=price&order=asc&page=1&limit=10`

### Cart (customer-scoped)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/cart` | Bearer | View own cart |
| POST | `/cart/items` | Bearer | Add item `{ productId, quantity }` |
| PUT | `/cart/items/:id` | Bearer | Update item quantity `{ quantity }` |
| DELETE | `/cart/items/:id` | Bearer | Remove item |
| DELETE | `/cart/clear` | Bearer | Clear cart |

### Orders
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/orders` | Bearer | Create order from current cart `{ shippingAddress }` |
| GET | `/orders` | Bearer | Own orders (customer) or all orders (admin), paginated |
| GET | `/orders/:id` | Bearer | Get one order (scoped to owner unless admin) |
| PATCH | `/orders/:id/status` | Admin | Update order status `{ status }` |

### Payments (PayFast)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/payments/payfast` | Bearer | Create a PayFast payment session `{ orderId }` |
| POST | `/payments/notify` | Public (PayFast) | ITN webhook — updates payment status |
| GET | `/payments/success` | Public | Browser return URL, redirects to `CLIENT_URL` |
| GET | `/payments/cancel` | Public | Browser cancel URL, redirects to `CLIENT_URL` |

### Webhooks
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/webhooks/clerk` | Public (Clerk, Svix-signed) | Syncs local `User`/`Cart` on `user.created`/`user.updated`/`user.deleted` |

## 10. Response Format

**Success:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Products fetched",
  "data": [ ... ],
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5, "hasNextPage": true, "hasPrevPage": false }
}
```

**Error:**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [ { "field": "email", "message": "Must be a valid email" } ]
}
```

## 11. Security Notes

- Credentials (passwords, MFA, sessions) are entirely owned and secured by Clerk — this API never sees or stores a password.
- Helmet sets protective HTTP headers.
- CORS restricted to `CORS_ORIGIN`.
- All input validated with express-validator before hitting business logic.
- The Clerk webhook is signature-verified (Svix) before any data is written.
- Global error handler normalizes Prisma/Multer/Clerk errors into a consistent JSON shape and never leaks stack traces outside development.
- Rate limiting as described above.
- Order totals and line-item prices are snapshotted server-side from the database at checkout — the client can never set its own price/total.

## 12. Testing the API Quickly

Since auth is handled by Clerk, you'll need a real session token from your frontend (e.g. copy it out of your browser's dev tools after signing in with Clerk, or use Clerk's testing tokens in CI). Once you have one:

```bash
# Get current user (creates the local User row on first call if the
# webhook hasn't synced it yet)
curl http://localhost:5000/api/auth/me -H "Authorization: Bearer <CLERK_SESSION_TOKEN>"

# Browse products (public, no auth needed)
curl http://localhost:5000/api/products
```

## License

MIT
