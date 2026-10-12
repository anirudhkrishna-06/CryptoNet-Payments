import { Router } from 'express';
import { createDemoPaymentController } from '../controllers/demoPayment.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import type { PaymentSessionService } from '../services/paymentSession.service.js';
import { demoPaymentResultSchema } from '../validators/paymentSession.schema.js';

export function createDemoPaymentRouter(
  service: PaymentSessionService,
  apiKey: string,
): Router {
  const router = Router();
  const controller = createDemoPaymentController(service);
  router.use(authenticate(apiKey));
  router.post(
    '/:id/demo-result',
    validateRequest(demoPaymentResultSchema),
    controller.submitResult,
  );
  return router;
}
