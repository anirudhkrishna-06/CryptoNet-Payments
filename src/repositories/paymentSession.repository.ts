import type { Collection, WithId } from 'mongodb';
import type {
  PaymentSession,
  PaymentSessionEvent,
  PaymentSessionRepositoryPort,
  PaymentSessionStatus,
} from '../types/payment.js';

function withoutMongoId(
  document: WithId<PaymentSession> | null,
): PaymentSession | null {
  if (!document) return null;
  const { _id, ...value } = document;
  void _id;
  return value;
}

export class MongoPaymentSessionRepository implements PaymentSessionRepositoryPort {
  constructor(
    private readonly sessions: Collection<PaymentSession>,
    private readonly events: Collection<PaymentSessionEvent>,
  ) {}

  async findById(sessionId: string): Promise<PaymentSession | null> {
    return withoutMongoId(await this.sessions.findOne({ sessionId }));
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PaymentSession | null> {
    return withoutMongoId(await this.sessions.findOne({ idempotencyKey }));
  }

  async insertSession(session: PaymentSession): Promise<void> {
    await this.sessions.insertOne(session);
  }

  async transitionStatus(
    sessionId: string,
    expectedStatus: PaymentSessionStatus,
    status: PaymentSessionStatus,
    updatedAt: Date,
  ): Promise<PaymentSession | null> {
    const result = await this.sessions.findOneAndUpdate(
      { sessionId, status: expectedStatus },
      { $set: { status, updatedAt } },
      { returnDocument: 'after' },
    );
    return withoutMongoId(result);
  }

  async insertEvent(event: PaymentSessionEvent): Promise<void> {
    await this.events.insertOne(event);
  }
}
