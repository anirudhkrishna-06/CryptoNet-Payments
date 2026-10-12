import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function authenticate(apiKey: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const authorization = request.header('authorization') ?? '';
    const supplied = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    const expectedBuffer = Buffer.from(apiKey);
    const suppliedBuffer = Buffer.from(supplied);
    const valid =
      expectedBuffer.length === suppliedBuffer.length &&
      timingSafeEqual(expectedBuffer, suppliedBuffer);

    if (!valid) {
      response.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid bearer token required',
        },
      });
      return;
    }
    next();
  };
}
