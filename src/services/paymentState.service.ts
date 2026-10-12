import { randomUUID } from 'node:crypto';
import type {
  PaymentProvider,
  PaymentProviderResult,
  PaymentSession,
  PaymentSessionRepositoryPort,
  PaymentSessionStatus,
} from '../types/payment.js';

export class PaymentStateService {
  constructor(
    private readonly repository: PaymentSessionRepositoryPort,
    private readonly provider: PaymentProvider,
  ) {}

  async createAttempt(sessionId: string, expiresAt: Date) {
    return this.provider.createAttempt(sessionId, expiresAt);
  }

  async refresh(session: PaymentSession): Promise<PaymentSession> {
    if (session.status !== 'PENDING') return session;
    const result = await this.provider.getResult(
      session.sessionId,
      session.expiresAt,
    );
    if (result.status !== 'EXPIRED') return session;
    return this.transition(session, 'EXPIRED', result);
  }

  async applyDemoOutcome(
    session: PaymentSession,
    outcome: 'PENDING' | 'SUCCESS' | 'FAILURE',
  ): Promise<PaymentSession> {
    if (session.status !== 'PENDING') {
      const expected = this.mapProviderStatus(outcome);
      if (session.status === expected) return session;
      throw new Error('Payment session is already in a terminal state');
    }

    const result = await this.provider.getResult(
      session.sessionId,
      session.expiresAt,
      outcome,
    );
    if (result.status === 'PENDING') return session;
    const nextStatus = this.mapProviderStatus(result.status);
    return this.transition(session, nextStatus, result);
  }

  private async transition(
    session: PaymentSession,
    nextStatus: PaymentSessionStatus,
    result: PaymentProviderResult,
  ): Promise<PaymentSession> {
    const updatedAt = new Date();
    const updated = await this.repository.transitionStatus(
      session.sessionId,
      'PENDING',
      nextStatus,
      updatedAt,
    );
    if (!updated) {
      const current = await this.repository.findById(session.sessionId);
      if (current?.status === nextStatus) return current;
      throw new Error('Payment session changed concurrently; reload and retry');
    }

    await this.repository.insertEvent({
      eventId: randomUUID(),
      sessionId: updated.sessionId,
      type: `PAYMENT_SESSION_${nextStatus}`,
      status: nextStatus,
      verificationMode: updated.verificationMode,
      createdAt: updatedAt,
      details: {
        resultType: result.resultType,
        providerReference: result.providerReference,
        message: result.message,
      },
    });
    return updated;
  }

  private mapProviderStatus(status: string): PaymentSessionStatus {
    switch (status) {
      case 'SUCCESS':
        return 'SIMULATED_SUCCESS';
      case 'FAILURE':
        return 'SIMULATED_FAILURE';
      case 'EXPIRED':
        return 'EXPIRED';
      case 'PENDING':
        return 'PENDING';
      default:
        throw new Error(`Unsupported provider status: ${status}`);
    }
  }
}
