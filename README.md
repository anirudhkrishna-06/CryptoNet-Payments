# CryptoNet-Payments

Standalone Node.js/TypeScript payment-session API. Stage 1 includes MongoDB persistence and an explicitly simulated demo provider. It is separate from the existing frontend, CryptoNet API, and escrow contract; it does not claim to verify or initiate a real UPI payment.

## Requirements

- Node.js 20 or later and npm
- A reachable MongoDB deployment
- The same MongoDB URI and database currently used by `fulloncrypto-nodejs`

The existing backend configuration resolves `DB_NAME` to `cryptonet` by default. Its local `.env` may override the Mongo URI or database; copy the URI privately into this service's ignored `.env` and set `DB_NAME` to the resolved existing database name. Do not print or commit either value. This service only creates/uses `paymentSessions` and `paymentEvents`; it does not rename, migrate, or modify `users`, `paymentRequests`, or `upiIndex`.

## Setup

```powershell
Set-Location E:\Projects\CryptoNet\CryptoNet-Payments
npm install
Copy-Item .env.example .env
```

Set `MONGODB_URI` in `.env` by copying the existing backend URI privately. Keep `DB_NAME=cryptonet` unless the existing backend's effective configuration explicitly uses a different database. Replace `PAYMENT_API_KEY` with a randomly generated value of at least 32 characters. Never commit `.env`.

`PAYMENT_CONTEXT_MODE=DEVELOPMENT_FIXTURE` is the only context adapter implemented in Stage 1. Populate `PAYMENT_CONTEXT_FIXTURES_JSON` with trusted local test fixtures, for example:

```json
[
  {
    "escrowRequestId": "17",
    "chainId": 84532,
    "contractAddress": "0x0000000000000000000000000000000000000017",
    "requesterAddress": "0x0000000000000000000000000000000000000001",
    "resolverAddress": "0x0000000000000000000000000000000000000002",
    "inrAmountPaise": "12345",
    "payeeHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "expiresAt": "2027-01-01T00:00:00.000Z"
  }
]
```

Only identifiers in a configured fixture resolve. Session creation does not accept requester, resolver, amount, payee, or expiry from the caller. `CRYPTONET_API` context mode intentionally fails closed until a trusted CryptoNet adapter is implemented. Fixture mode is rejected in production. `PAYMENT_MODE=DEMO` is also rejected in production; no Razorpay implementation is included.

## Run, test, build

```powershell
npm run dev
npm test
npm run build
npm run lint
npm run format:check
npm start
```

Startup connects one shared Mongo client and creates indexes for session ID, idempotency key, escrow request/chain, resolver, status/expiry and event history. Expired documents are not TTL-deleted. The process closes the HTTP server and Mongo client on `SIGINT` or `SIGTERM`. Health is `503` until database/index startup succeeds.

For container deployment, build with `docker build -t cryptonet-payments .` and provide the environment variables through the platform's secret/environment configuration. The image runs `npm start` on port `3002`.

## Money and state model

`inrAmountPaise` is a base-10 integer string of paise (`100` paise = `₹1`); no floating-point amount arithmetic is used. The escrow contract currently stores whole INR rupees, so a future chain adapter must verify the contract's integer rupee amount and convert `amountINR * 100` to paise exactly. Fractional rupees cannot be represented by that existing contract field.

Session states are `PENDING`, `SIMULATED_SUCCESS`, `SIMULATED_FAILURE`, and `EXPIRED`. Session expiry is copied from the trusted escrow context. A demo result is not evidence of a bank transfer and does not authorize or trigger escrow release. The `paymentEvents` log supports auditing, but Mongo writes are not a cross-collection transaction; consumers must reconcile session state and event records.

## API

All `/api` routes require `Authorization: Bearer <PAYMENT_API_KEY>`. Responses use `{ "data": ... }` on success and `{ "error": { "code", "message" } }` on failure. `/health` is public and returns service/database status only.

### `GET /health`

```json
{
  "data": {
    "service": "CryptoNet-Payments",
    "status": "healthy",
    "database": "connected"
  }
}
```

### `POST /api/payment-sessions`

The request supplies only an escrow lookup and idempotency key. Other session fields come from a trusted configured context fixture/adapter, never from caller-supplied payment claims.

```json
{
  "escrowRequestId": "17",
  "chainId": 84532,
  "contractAddress": "0x0000000000000000000000000000000000000017",
  "idempotencyKey": "client-operation-key-000017"
}
```

Returns `201` for a new session and `200` when an identical idempotency key/context is replayed. Reusing the key for a different payment context returns `409`; unknown trusted context returns `404`.

### `GET /api/payment-sessions/:id`

Returns the session. If its trusted expiry has passed while pending, the API records `EXPIRED` and returns the updated session.

### `POST /api/payment-sessions/:id/demo-result`

Enabled only when `PAYMENT_MODE=DEMO` and `NODE_ENV` is not production.

```json
{ "outcome": "SUCCESS" }
```

Allowed outcomes: `PENDING`, `SUCCESS`, `FAILURE`. The response always includes `resultType: "SIMULATED"` and `bankConfirmed: false`. Outcomes are terminal except `PENDING`; submitting the same terminal outcome is idempotent and a conflicting terminal outcome returns `409`.

## Security and current integration boundary

- `PAYMENT_API_KEY` protects API operations; keep it server-side and do not expose it to a browser bundle.
- `FRONTEND_ORIGIN` only configures CORS; CORS is not authentication.
- The development fixture resolver is an explicit local/test adapter, not a production source of truth.
- The payment service has no chain signer, relayer, webhook, Razorpay adapter, or contract integration in Stage 1.
- Do not interpret `SIMULATED_SUCCESS` as UPI receipt or permit it to release escrow.
