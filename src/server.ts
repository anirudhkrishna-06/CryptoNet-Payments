import { createApp, demoEndpointsEnabled } from './app.js';
import {
  checkDatabaseHealth,
  closeDatabase,
  connectDatabase,
} from './config/database.js';
import { env } from './config/env.js';
import { createPaymentProvider } from './providers/providerFactory.js';
import { DevelopmentFixtureContextResolver } from './services/developmentFixtureContextResolver.js';

async function start(): Promise<void> {
  const repository = await connectDatabase();
  const contextResolver = DevelopmentFixtureContextResolver.fromEnvironment(
    env.PAYMENT_CONTEXT_MODE,
    env.PAYMENT_CONTEXT_FIXTURES_JSON,
  );
  const app = createApp({
    repository,
    contextResolver,
    provider: createPaymentProvider(),
    apiKey: env.PAYMENT_API_KEY,
    demoEnabled: demoEndpointsEnabled(env.NODE_ENV, env.PAYMENT_MODE),
    frontendOrigin: env.FRONTEND_ORIGIN,
    checkDatabaseHealth,
  });
  const server = app.listen(env.PORT, () => {
    console.log(`CryptoNet-Payments listening on port ${env.PORT}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down payment service`);
    server.close((error) => {
      void closeDatabase()
        .then(() => {
          if (error) {
            console.error('HTTP server shutdown failed', {
              message: error.message,
            });
            process.exitCode = 1;
          }
        })
        .catch((closeError: unknown) => {
          console.error('MongoDB shutdown failed', {
            message:
              closeError instanceof Error
                ? closeError.message
                : 'Unknown error',
          });
          process.exitCode = 1;
        });
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(async (error: unknown) => {
  console.error('Payment service startup failed', {
    message: error instanceof Error ? error.message : 'Unknown error',
  });
  await closeDatabase().catch(() => undefined);
  process.exitCode = 1;
});
