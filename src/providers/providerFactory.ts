import { env } from '../config/env.js';
import type { PaymentProvider } from '../types/payment.js';
import { DemoPaymentProvider } from './DemoPaymentProvider.js';

export function createPaymentProvider(): PaymentProvider {
  if (env.PAYMENT_MODE === 'DEMO') return new DemoPaymentProvider();
  throw new Error('RAZORPAY_TEST provider is not implemented in Stage 1');
}
