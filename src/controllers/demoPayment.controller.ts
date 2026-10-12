import type { Request, Response, NextFunction } from 'express';
import {
  PaymentServiceError,
  type PaymentSessionService,
} from '../services/paymentSession.service.js';

export function createDemoPaymentController(service: PaymentSessionService) {
  return {
    submitResult: async (
      request: Request,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const sessionId = request.params.id;
        if (typeof sessionId !== 'string')
          throw new PaymentServiceError('Invalid payment session ID', 400);
        const session = await service.recordDemoOutcome(
          sessionId,
          request.body.outcome,
        );
        response.status(200).json({
          data: {
            session,
            resultType: 'SIMULATED',
            bankConfirmed: false,
            message:
              'Demo outcome recorded; this does not verify or move real money.',
          },
        });
      } catch (error) {
        next(error);
      }
    },
  };
}
