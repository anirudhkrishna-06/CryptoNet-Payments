import { isAddress } from 'ethers';
import { z } from 'zod';

export const createPaymentSessionSchema = z
  .object({
    escrowRequestId: z
      .string()
      .regex(/^[1-9]\d{0,77}$/, 'Must be a positive on-chain request ID'),
    chainId: z.number().int().positive(),
    contractAddress: z
      .string()
      .refine(isAddress, 'Must be a valid EVM contract address'),
    idempotencyKey: z.string().min(16).max(128),
  })
  .strict();

export const demoPaymentResultSchema = z
  .object({
    outcome: z.enum(['PENDING', 'SUCCESS', 'FAILURE']),
  })
  .strict();
