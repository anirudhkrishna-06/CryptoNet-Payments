import { Router } from 'express';
import { createPaymentSessionController } from '../controllers/paymentSession.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import type { PaymentSessionService } from '../services/paymentSession.service.js';
import { createPaymentSessionSchema } from '../validators/paymentSession.schema.js';

export function createPaymentSessionRouter(
  service: PaymentSessionService,
  apiKey: string,
): Router {
  const router = Router();
  const controller = createPaymentSessionController(service);
  router.use(authenticate(apiKey));
  router.post(
    '/',
    validateRequest(createPaymentSessionSchema),
    controller.create,
  );
  router.get('/:id', controller.get);
  return router;
}
