import { describe, expect, it } from 'vitest';
import { DemoPaymentProvider } from '../src/providers/DemoPaymentProvider.js';
import { PaymentStateService } from '../src/services/paymentState.service.js';
import {
  PaymentSessionService,
  PaymentServiceError,
} from '../src/services/paymentSession.service.js';
import type {
  PaymentContextResolver,
  PaymentSession,
  PaymentSessionEvent,
  PaymentSessionRepositoryPort,
  PaymentSessionStatus,
  TrustedPaymentContext,
} from '../src/types/payment.js';

const context: TrustedPaymentContext = {
  escrowRequestId: '17',
  chainId: 84532,
  contractAddress: '0x0000000000000000000000000000000000000017',
  requesterAddress: '0x0000000000000000000000000000000000000001',
  resolverAddress: '0x0000000000000000000000000000000000000002',
  inrAmountPaise: '12345',
  payeeHash: `0x${'a'.repeat(64)}`,
  expiresAt: new Date(Date.now() + 60_000),
};

class MemoryRepository implements PaymentSessionRepositoryPort {
  readonly sessions = new Map<string, PaymentSession>();
  readonly events: PaymentSessionEvent[] = [];

  async findById(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  async findByIdempotencyKey(idempotencyKey: string) {
    return (
      [...this.sessions.values()].find(
        (session) => session.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  async insertSession(session: PaymentSession) {
    this.sessions.set(session.sessionId, session);
  }

  async transitionStatus(
    sessionId: string,
    expectedStatus: PaymentSessionStatus,
    status: PaymentSessionStatus,
    updatedAt: Date,
  ) {
    const current = this.sessions.get(sessionId);
    if (!current || current.status !== expectedStatus) return null;
    const updated = { ...current, status, updatedAt };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  async insertEvent(event: PaymentSessionEvent) {
    this.events.push(event);
  }
}

function setup(initialContext: TrustedPaymentContext | null = context) {
  const repository = new MemoryRepository();
  let resolvedContext = initialContext;
  const contextResolver: PaymentContextResolver = {
    resolve: async () => resolvedContext,
  };
  const provider = new DemoPaymentProvider();
  const state = new PaymentStateService(repository, provider);
  return {
    repository,
    service: new PaymentSessionService(repository, contextResolver, state),
    setContext: (nextContext: TrustedPaymentContext | null) => {
      resolvedContext = nextContext;
    },
  };
}

const createInput = {
  escrowRequestId: '17',
  chainId: 84532,
  contractAddress: context.contractAddress,
  idempotencyKey: 'test-idempotency-key-0001',
};

describe('PaymentSessionService', () => {
  it('creates and retrieves a simulated payment session with integer paise', async () => {
    const { service } = setup();
    const created = await service.create(createInput);
    const retrieved = await service.get(created.session.sessionId);

    expect(created.session.inrAmountPaise).toBe('12345');
    expect(created.session.currency).toBe('INR');
    expect(created.session.verificationMode).toBe('SIMULATED');
    expect(retrieved.sessionId).toBe(created.session.sessionId);
  });

  it('returns the original session for an identical idempotent request', async () => {
    const { service, repository } = setup();
    const first = await service.create(createInput);
    const second = await service.create(createInput);

    expect(second.reused).toBe(true);
    expect(second.session.sessionId).toBe(first.session.sessionId);
    expect(repository.sessions.size).toBe(1);
  });

  it('rejects an idempotency key reused for a different trusted payment context', async () => {
    const { service, setContext } = setup();
    await service.create(createInput);
    setContext({ ...context, inrAmountPaise: '999' });
    await expect(service.create(createInput)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('records success as explicitly simulated and idempotently returns terminal status', async () => {
    const { service, repository } = setup();
    const { session } = await service.create(createInput);
    const result = await service.recordDemoOutcome(
      session.sessionId,
      'SUCCESS',
    );
    const repeated = await service.recordDemoOutcome(
      session.sessionId,
      'SUCCESS',
    );

    expect(result.status).toBe('SIMULATED_SUCCESS');
    expect(repeated.status).toBe('SIMULATED_SUCCESS');
    expect(repository.events.at(-1)).toMatchObject({
      type: 'PAYMENT_SESSION_SIMULATED_SUCCESS',
      verificationMode: 'SIMULATED',
    });
  });

  it('supports simulated failure and rejects conflicting terminal outcomes', async () => {
    const { service } = setup();
    const { session } = await service.create(createInput);
    await service.recordDemoOutcome(session.sessionId, 'FAILURE');
    await expect(
      service.recordDemoOutcome(session.sessionId, 'SUCCESS'),
    ).rejects.toBeInstanceOf(PaymentServiceError);
  });

  it('expires a pending session when its trusted escrow expiry is reached', async () => {
    const { service, repository } = setup();
    const { session } = await service.create(createInput);
    repository.sessions.set(session.sessionId, {
      ...session,
      expiresAt: new Date(Date.now() - 1),
    });

    const expired = await service.get(session.sessionId);
    expect(expired.status).toBe('EXPIRED');
  });

  it('rejects creation when no trusted request context exists', async () => {
    const { service } = setup(null);
    await expect(service.create(createInput)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
