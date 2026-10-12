import type {
  DemoOutcome,
  PaymentProvider,
  PaymentProviderResult,
} from '../types/payment.js';

export class DemoPaymentProvider implements PaymentProvider {
  async createAttempt(
    sessionId: string,
    expiresAt: Date,
  ): Promise<PaymentProviderResult> {
    return this.result(
      sessionId,
      expiresAt,
      'PENDING',
      'Simulated payment attempt created; no money was moved or verified.',
    );
  }

  async getResult(
    sessionId: string,
    expiresAt: Date,
    requestedOutcome?: DemoOutcome,
  ): Promise<PaymentProviderResult> {
    if (Date.now() >= expiresAt.getTime()) {
      return this.result(
        sessionId,
        expiresAt,
        'EXPIRED',
        'Simulated payment session expired.',
      );
    }
    if (requestedOutcome === 'SUCCESS') {
      return this.result(
        sessionId,
        expiresAt,
        'SUCCESS',
        'Simulated success only; no bank confirmation or money movement occurred.',
      );
    }
    if (requestedOutcome === 'FAILURE') {
      return this.result(
        sessionId,
        expiresAt,
        'FAILURE',
        'Simulated failure; no provider was contacted.',
      );
    }
    return this.result(
      sessionId,
      expiresAt,
      'PENDING',
      'Simulated payment remains pending; no provider was contacted.',
    );
  }

  private result(
    sessionId: string,
    _expiresAt: Date,
    status: PaymentProviderResult['status'],
    message: string,
  ): PaymentProviderResult {
    return {
      resultType: 'SIMULATED',
      status,
      providerReference: `demo_${sessionId}`,
      message,
    };
  }
}
