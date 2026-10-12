import { MongoClient, type Db } from 'mongodb';
import { env } from './env.js';
import { MongoPaymentSessionRepository } from '../repositories/paymentSession.repository.js';
import type { PaymentSession, PaymentSessionEvent } from '../types/payment.js';

let client: MongoClient | undefined;
let database: Db | undefined;
let repository: MongoPaymentSessionRepository | undefined;

export async function connectDatabase(): Promise<MongoPaymentSessionRepository> {
  if (repository) return repository;

  const candidate = new MongoClient(env.MONGODB_URI, {
    appName: 'CryptoNet-Payments',
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    await candidate.connect();
    const connectedDatabase = candidate.db(env.DB_NAME);
    const sessionCollection = connectedDatabase.collection<PaymentSession>(
      env.PAYMENT_SESSIONS_COLLECTION,
    );
    const eventCollection = connectedDatabase.collection<PaymentSessionEvent>(
      env.PAYMENT_EVENTS_COLLECTION,
    );

    await Promise.all([
      sessionCollection.createIndexes([
        { key: { sessionId: 1 }, name: 'session_id_unique', unique: true },
        {
          key: { idempotencyKey: 1 },
          name: 'idempotency_key_unique',
          unique: true,
        },
        {
          key: { escrowRequestId: 1, chainId: 1 },
          name: 'escrow_request_chain',
        },
        { key: { resolverAddress: 1 }, name: 'resolver_address' },
        { key: { status: 1 }, name: 'session_status' },
        { key: { expiresAt: 1 }, name: 'session_expiry' },
        { key: { status: 1, expiresAt: 1 }, name: 'status_expiry' },
      ]),
      eventCollection.createIndexes([
        { key: { eventId: 1 }, name: 'event_id_unique', unique: true },
        { key: { sessionId: 1, createdAt: 1 }, name: 'session_event_history' },
      ]),
    ]);

    client = candidate;
    database = connectedDatabase;
    repository = new MongoPaymentSessionRepository(
      sessionCollection,
      eventCollection,
    );
    return repository;
  } catch (error) {
    await candidate.close().catch(() => undefined);
    throw new Error(
      'MongoDB connection or payment collection index initialization failed',
      {
        cause: error,
      },
    );
  }
}

export function isDatabaseConnected(): boolean {
  return Boolean(database && client);
}

export async function checkDatabaseHealth(): Promise<boolean> {
  if (!database || !client) return false;
  await database.command({ ping: 1 });
  return true;
}

export async function closeDatabase(): Promise<void> {
  const currentClient = client;
  client = undefined;
  database = undefined;
  repository = undefined;
  if (currentClient) await currentClient.close();
}
