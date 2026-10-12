import type { Request, Response, NextFunction } from 'express';
import {
  PaymentServiceError,
  type PaymentSessionService,
} from '../services/paymentSession.service.js';

export function createPaymentSessionController(service: PaymentSessionService) {
  return {
    create: async (
      request: Request,
      response: Response,
      next: NextFunction,
    ) => {
      try {
        const result = await service.create(request.body);
        response.status(result.reused ? 200 : 201).json({ data: result });
      } catch (error) {
        next(error);
      }
    },
    get: async (request: Request, response: Response, next: NextFunction) => {
      try {
        const sessionId = request.params.id;
        if (typeof sessionId !== 'string')
          throw new PaymentServiceError('Invalid payment session ID', 400);
        const session = await service.get(sessionId);
        response.status(200).json({ data: { session } });
      } catch (error) {
        next(error);
      }
    },
  };
}
