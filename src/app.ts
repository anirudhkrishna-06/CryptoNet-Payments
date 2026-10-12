import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { createPaymentSessionRouter } from './routes/paymentSession.routes.js';
import { createDemoPaymentRouter } from './routes/demoPayment.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
import type {
  PaymentContextResolver,
  PaymentProvider,
  PaymentSessionRepositoryPort,
} from './types/payment.js';
import { PaymentStateService } from './services/paymentState.service.js';
import { PaymentSessionService } from './services/paymentSession.service.js';

export interface AppDependencies {
  repository: PaymentSessionRepositoryPort;
  contextResolver: PaymentContextResolver;
  provider: PaymentProvider;
  apiKey: string;
  demoEnabled: boolean;
  frontendOrigin: string;
  checkDatabaseHealth: () => Promise<boolean>;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const state = new PaymentStateService(
    dependencies.repository,
    dependencies.provider,
  );
  const service = new PaymentSessionService(
    dependencies.repository,
    dependencies.contextResolver,
    state,
  );

  app.disable('x-powered-by');
  app.use(cors({ origin: dependencies.frontendOrigin }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/health', createHealthRouter(dependencies.checkDatabaseHealth));
  app.use(
    '/api/payment-sessions',
    createPaymentSessionRouter(service, dependencies.apiKey),
  );

  if (dependencies.demoEnabled) {
    app.use(
      '/api/payment-sessions',
      createDemoPaymentRouter(service, dependencies.apiKey),
    );
  }

  app.use((_request, response) => {
    response
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
  app.use(errorHandler);
  return app;
}

export function demoEndpointsEnabled(
  nodeEnv: string,
  paymentMode: string,
): boolean {
  return nodeEnv !== 'production' && paymentMode === 'DEMO';
}
