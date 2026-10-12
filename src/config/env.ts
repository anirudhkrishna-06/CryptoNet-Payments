import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3002),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    DB_NAME: z.string().min(1).default('cryptonet'),
    PAYMENT_SESSIONS_COLLECTION: z.string().min(1).default('paymentSessions'),
    PAYMENT_EVENTS_COLLECTION: z.string().min(1).default('paymentEvents'),
    PAYMENT_MODE: z.enum(['DEMO', 'RAZORPAY_TEST']).default('DEMO'),
    FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
    CRYPTONET_API_URL: z.string().url().default('http://localhost:3001/api'),
    PAYMENT_API_KEY: z
      .string()
      .min(32, 'PAYMENT_API_KEY must be at least 32 characters'),
    PAYMENT_CONTEXT_MODE: z
      .enum(['DEVELOPMENT_FIXTURE', 'CRYPTONET_API'])
      .default('DEVELOPMENT_FIXTURE'),
    PAYMENT_CONTEXT_FIXTURES_JSON: z.string().default('[]'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.PAYMENT_MODE === 'DEMO') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYMENT_MODE'],
        message: 'DEMO mode is forbidden in production',
      });
    }
    if (
      env.PAYMENT_CONTEXT_MODE === 'DEVELOPMENT_FIXTURE' &&
      env.NODE_ENV !== 'development' &&
      env.NODE_ENV !== 'test'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYMENT_CONTEXT_MODE'],
        message: 'Development fixtures are allowed only in development or test',
      });
    }
    if (env.PAYMENT_SESSIONS_COLLECTION === env.PAYMENT_EVENTS_COLLECTION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYMENT_EVENTS_COLLECTION'],
        message: 'Payment session and event collections must be different',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map(
      (issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`,
    )
    .join('; ');
  throw new Error(`Invalid service configuration: ${details}`);
}

export const env = Object.freeze(parsed.data);
