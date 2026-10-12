import { getAddress, isAddress } from 'ethers';
import { z } from 'zod';
import type {
  PaymentContextLookup,
  PaymentContextResolver,
  TrustedPaymentContext,
} from '../types/payment.js';

const fixtureSchema = z
  .object({
    escrowRequestId: z.string().regex(/^[1-9]\d{0,77}$/),
    chainId: z.number().int().positive(),
    contractAddress: z.string().refine(isAddress),
    requesterAddress: z.string().refine(isAddress),
    resolverAddress: z.string().refine(isAddress),
    inrAmountPaise: z.string().regex(/^[1-9]\d*$/),
    payeeHash: z.string().regex(/^0x[0-9a-f]{64}$/),
    expiresAt: z.string().datetime(),
  })
  .strict();

export class DevelopmentFixtureContextResolver implements PaymentContextResolver {
  private constructor(private readonly fixtures: TrustedPaymentContext[]) {}

  static fromEnvironment(
    mode: string,
    fixturesJson: string,
  ): PaymentContextResolver {
    if (mode !== 'DEVELOPMENT_FIXTURE') {
      throw new Error(
        'CryptoNet API context adapter is not implemented; refusing untrusted context',
      );
    }
    const parsedJson: unknown = JSON.parse(fixturesJson);
    const fixtures = z
      .array(fixtureSchema)
      .parse(parsedJson)
      .map((fixture) => ({
        ...fixture,
        contractAddress: getAddress(fixture.contractAddress),
        requesterAddress: getAddress(fixture.requesterAddress),
        resolverAddress: getAddress(fixture.resolverAddress),
        expiresAt: new Date(fixture.expiresAt),
      }));
    return new DevelopmentFixtureContextResolver(fixtures);
  }

  async resolve(
    input: PaymentContextLookup,
  ): Promise<TrustedPaymentContext | null> {
    return (
      this.fixtures.find(
        (fixture) =>
          fixture.escrowRequestId === input.escrowRequestId &&
          fixture.chainId === input.chainId &&
          fixture.contractAddress.toLowerCase() ===
            input.contractAddress.toLowerCase(),
      ) ?? null
    );
  }
}
