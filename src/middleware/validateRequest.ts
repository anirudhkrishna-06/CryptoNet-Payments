import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

export function validateRequest(schema: ZodType) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request validation failed',
          details: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      return;
    }
    request.body = result.data;
    next();
  };
}
