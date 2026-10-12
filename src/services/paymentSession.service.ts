import { randomUUID } from 'node:crypto';
import { isAddress, getAddress } from 'ethers';
import type {
  PaymentContextResolver,
  PaymentSession,
  PaymentSessionCreateInput,
  PaymentSessionRepositoryPort,
} from '../types/payment.js';
import { PaymentStateService } from './paymentState.service.js';

export class PaymentServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'PaymentServiceError';
  }
}

export class PaymentSessionService {
  constructor(
    private readonly repository: PaymentSessionRepositoryPort,
    private readonly contextResolver: PaymentContextResolver,
    private readonly state: PaymentStateService,
  ) {}

  async create(
    input: PaymentSessionCreateInput,
  ): Promise<{ session: PaymentSession; reused: boolean }> {
    const context = await this.contextResolver.resolve(input);
    if (!context) {
      throw new PaymentServiceError(
        'No trusted payment context exists for this escrow request',
        404,
      );
    }

    if (
      context.escrowRequestId !== input.escrowRequestId ||
      context.chainId !== input.chainId ||
      context.contractAddress.toLowerCase() !==
        input.contractAddress.toLowerCase()
    ) {
      throw new PaymentServiceError(
        'Trusted payment context does not match request identifiers',
        409,
      );
    }
    if (
      !isAddress(context.requesterAddress) ||
      !isAddress(context.resolverAddress)
    ) {
      throw new PaymentServiceError(
        'Trusted payment context contains an invalid wallet address',
        500,
      );
    }
    if (
      !/^\d+$/.test(context.inrAmountPaise) ||
      BigInt(context.inrAmountPaise) <= 0n
    ) {
      throw new PaymentServiceError(
        'Trusted payment context contains an invalid INR amount',
        500,
      );
    }
    if (!/^0x[0-9a-f]{64}$/.test(context.payeeHash)) {
      throw new PaymentServiceError(
        'Trusted payment context contains an invalid payee hash',
        500,
      );
    }
    if (context.expiresAt.getTime() <= Date.now()) {
      throw new PaymentServiceError('Escrow request is already expired', 409);
    }

    const existing = await this.repository.findByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) return this.reuseOrConflict(existing, context);

    const sessionId = randomUUID();
    const createdAt = new Date();
    const attempt = await this.stateProviderAttempt(
      sessionId,
      context.expiresAt,
    );
    const session: PaymentSession = {
      sessionId,
      escrowRequestId: context.escrowRequestId,
      chainId: context.chainId,
      contractAddress: getAddress(context.contractAddress),
      requesterAddress: getAddress(context.requesterAddress),
      resolverAddress: getAddress(context.resolverAddress),
      inrAmountPaise: context.inrAmountPaise,
      currency: 'INR',
      payeeHash: context.payeeHash,
      verificationMode: 'SIMULATED',
      status: 'PENDING',
      idempotencyKey: input.idempotencyKey,
      providerReference: attempt.providerReference,
      createdAt,
      updatedAt: createdAt,
      expiresAt: context.expiresAt,
    };

    try {
      await this.repository.insertSession(session);
    } catch (error) {
      const concurrent = await this.repository.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (concurrent) return this.reuseOrConflict(concurrent, context);
      throw error;
    }

    await this.repository.insertEvent({
      eventId: randomUUID(),
      sessionId,
      type: 'PAYMENT_SESSION_CREATED',
      status: 'PENDING',
      verificationMode: 'SIMULATED',
      createdAt,
      details: {
        resultType: attempt.resultType,
        providerReference: attempt.providerReference,
        message: attempt.message,
      },
    });
    return { session, reused: false };
  }

  async get(sessionId: string): Promise<PaymentSession> {
    const session = await this.repository.findById(sessionId);
    if (!session)
      throw new PaymentServiceError('Payment session not found', 404);
    return this.state.refresh(session);
  }

  async recordDemoOutcome(
    sessionId: string,
    outcome: 'PENDING' | 'SUCCESS' | 'FAILURE',
  ): Promise<PaymentSession> {
    const session = await this.repository.findById(sessionId);
    if (!session)
      throw new PaymentServiceError('Payment session not found', 404);
    if (session.verificationMode !== 'SIMULATED') {
      throw new PaymentServiceError(
        'Demo outcomes are unavailable for this session',
        409,
      );
    }
    try {
      return await this.state.applyDemoOutcome(session, outcome);
    } catch (error) {
      if (error instanceof Error && error.message.includes('terminal state')) {
        throw new PaymentServiceError(error.message, 409);
      }
      throw error;
    }
  }

  private async stateProviderAttempt(sessionId: string, expiresAt: Date) {
    return this.state.createAttempt(sessionId, expiresAt);
  }

  private reuseOrConflict(
    existing: PaymentSession,
    context: NonNullable<
      Awaited<ReturnType<PaymentContextResolver['resolve']>>
    >,
  ): { session: PaymentSession; reused: true } {
    if (
      existing.escrowRequestId !== context.escrowRequestId ||
      existing.chainId !== context.chainId ||
      existing.contractAddress.toLowerCase() !==
        context.contractAddress.toLowerCase() ||
      existing.requesterAddress.toLowerCase() !==
        context.requesterAddress.toLowerCase() ||
      existing.resolverAddress.toLowerCase() !==
        context.resolverAddress.toLowerCase() ||
      existing.inrAmountPaise !== context.inrAmountPaise ||
      existing.payeeHash !== context.payeeHash
    ) {
      throw new PaymentServiceError(
        'Idempotency key was already used for a different payment context',
        409,
      );
    }
    return { session: existing, reused: true };
  }
}
