export type PaymentMode = 'DEMO' | 'RAZORPAY_TEST';
export type VerificationMode = 'SIMULATED' | 'PROVIDER_TEST';
export type PaymentSessionStatus =
  'PENDING' | 'SIMULATED_SUCCESS' | 'SIMULATED_FAILURE' | 'EXPIRED';
export type DemoOutcome = 'PENDING' | 'SUCCESS' | 'FAILURE';
export type ProviderResultStatus =
  'PENDING' | 'SUCCESS' | 'FAILURE' | 'EXPIRED';

export interface PaymentContextLookup {
  escrowRequestId: string;
  chainId: number;
  contractAddress: string;
}

export interface TrustedPaymentContext extends PaymentContextLookup {
  requesterAddress: string;
  resolverAddress: string;
  /** Whole paise as an unsigned base-10 integer string. */
  inrAmountPaise: string;
  /** Lowercase 0x-prefixed SHA-256 merchant identity hash. */
  payeeHash: string;
  expiresAt: Date;
}

export interface PaymentSession {
  sessionId: string;
  escrowRequestId: string;
  chainId: number;
  contractAddress: string;
  requesterAddress: string;
  resolverAddress: string;
  /** Whole paise as an unsigned base-10 integer string; 100 paise = ₹1. */
  inrAmountPaise: string;
  currency: 'INR';
  payeeHash: string;
  verificationMode: VerificationMode;
  status: PaymentSessionStatus;
  idempotencyKey: string;
  providerReference: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface PaymentSessionEvent {
  eventId: string;
  sessionId: string;
  type: string;
  status: PaymentSessionStatus;
  verificationMode: VerificationMode;
  createdAt: Date;
  details: Record<string, string>;
}

export interface PaymentSessionCreateInput extends PaymentContextLookup {
  idempotencyKey: string;
}

export interface PaymentProviderResult {
  resultType: 'SIMULATED';
  status: ProviderResultStatus;
  providerReference: string;
  message: string;
}

export interface PaymentProvider {
  createAttempt(
    sessionId: string,
    expiresAt: Date,
  ): Promise<PaymentProviderResult>;
  getResult(
    sessionId: string,
    expiresAt: Date,
    requestedOutcome?: DemoOutcome,
  ): Promise<PaymentProviderResult>;
}

export interface PaymentContextResolver {
  resolve(input: PaymentContextLookup): Promise<TrustedPaymentContext | null>;
}

export interface PaymentSessionRepositoryPort {
  findById(sessionId: string): Promise<PaymentSession | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<PaymentSession | null>;
  insertSession(session: PaymentSession): Promise<void>;
  transitionStatus(
    sessionId: string,
    expectedStatus: PaymentSessionStatus,
    status: PaymentSessionStatus,
    updatedAt: Date,
  ): Promise<PaymentSession | null>;
  insertEvent(event: PaymentSessionEvent): Promise<void>;
}
