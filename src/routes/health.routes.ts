import { Router } from 'express';

export function createHealthRouter(
  checkDatabaseHealth: () => Promise<boolean>,
): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    let healthy = false;
    try {
      healthy = await checkDatabaseHealth();
    } catch {
      healthy = false;
    }
    const database = healthy ? 'connected' : 'disconnected';
    response.status(healthy ? 200 : 503).json({
      data: {
        service: 'CryptoNet-Payments',
        status: healthy ? 'healthy' : 'unhealthy',
        database,
      },
    });
  });

  return router;
}
