import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp, demoEndpointsEnabled } from '../src/app.js';
import { DemoPaymentProvider } from '../src/providers/DemoPaymentProvider.js';
import type {
  PaymentContextResolver,
  PaymentSession,
  PaymentSessionEvent,
  PaymentSessionRepositoryPort,
  PaymentSessionStatus,
  TrustedPaymentContext,
} from '../src/types/payment.js';

const context: TrustedPaymentContext = {
  escrowRequestId: '9',
  chainId: 84532,
  contractAddress: '0x0000000000000000000000000000000000000009',
  requesterAddress: '0x0000000000000000000000000000000000000001',
  resolverAddress: '0x0000000000000000000000000000000000000002',
  inrAmountPaise: '10000',
  payeeHash: `0x${'b'.repeat(64)}`,
  expiresAt: new Date(Date.now() + 60_000),
};

class MemoryRepository implements PaymentSessionRepositoryPort {
  readonly sessions = new Map<string, PaymentSession>();

  async findById(id: string) {
    return this.sessions.get(id) ?? null;
  }
  async findByIdempotencyKey(key: string) {
    return (
      [...this.sessions.values()].find((item) => item.idempotencyKey === key) ??
      null
    );
  }
  async insertSession(session: PaymentSession) {
    this.sessions.set(session.sessionId, session);
  }
  async transitionStatus(
    id: string,
    expected: PaymentSessionStatus,
    status: PaymentSessionStatus,
    updatedAt: Date,
  ) {
    const current = this.sessions.get(id);
    if (!current || current.status !== expected) return null;
    const updated = { ...current, status, updatedAt };
    this.sessions.set(id, updated);
    return updated;
  }
  async insertEvent(event: PaymentSessionEvent) {
    void event;
  }
}

function makeApp(demoEnabled = true) {
  const repository = new MemoryRepository();
  const resolver: PaymentContextResolver = { resolve: async () => context };
  const provider = new DemoPaymentProvider();
  return createApp({
    repository,
    contextResolver: resolver,
    provider,
    apiKey: 'test-api-key-at-least-32-characters',
    demoEnabled,
    frontendOrigin: 'http://localhost:3000',
    checkDatabaseHealth: async () => true,
  });
}

describe('payment session routes', () => {
  it('requires authentication and validates input', async () => {
    const app = makeApp();
    const unauthenticated = await request(app)
      .post('/api/payment-sessions')
      .send({});
    const invalid = await request(app)
      .post('/api/payment-sessions')
      .set('Authorization', 'Bearer test-api-key-at-least-32-characters')
      .send({ escrowRequestId: '9' });

    expect(unauthenticated.status).toBe(401);
    expect(invalid.status).toBe(400);
  });

  it('creates a session and returns an explicitly simulated demo result', async () => {
    const app = makeApp();
    const created = await request(app)
      .post('/api/payment-sessions')
      .set('Authorization', 'Bearer test-api-key-at-least-32-characters')
      .send({
        escrowRequestId: '9',
        chainId: 84532,
        contractAddress: context.contractAddress,
        idempotencyKey: 'route-test-idempotency-0001',
      });
    const sessionId = created.body.data.session.sessionId;
    const outcome = await request(app)
      .post(`/api/payment-sessions/${sessionId}/demo-result`)
      .set('Authorization', 'Bearer test-api-key-at-least-32-characters')
      .send({ outcome: 'SUCCESS' });

    expect(created.status).toBe(201);
    expect(outcome.body.data).toMatchObject({
      resultType: 'SIMULATED',
      bankConfirmed: false,
      session: { status: 'SIMULATED_SUCCESS' },
    });
  });

  it('does not mount demo outcomes when demo mode is disabled', async () => {
    const response = await request(makeApp(false))
      .post('/api/payment-sessions/anything/demo-result')
      .set('Authorization', 'Bearer test-api-key-at-least-32-characters')
      .send({ outcome: 'SUCCESS' });

    expect(response.status).toBe(404);
  });

  it('never enables demo outcomes in production', () => {
    expect(demoEndpointsEnabled('production', 'DEMO')).toBe(false);
    expect(demoEndpointsEnabled('development', 'DEMO')).toBe(true);
    expect(demoEndpointsEnabled('development', 'RAZORPAY_TEST')).toBe(false);
  });
});
