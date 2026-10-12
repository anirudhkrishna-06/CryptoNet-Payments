import type { ErrorRequestHandler } from 'express';
import { PaymentServiceError } from '../services/paymentSession.service.js';

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  void next;
  if (error instanceof PaymentServiceError) {
    response.status(error.statusCode).json({
      error: { code: 'PAYMENT_SERVICE_ERROR', message: error.message },
    });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
      },
    });
    return;
  }
  console.error('Unhandled payment service error', {
    message: error instanceof Error ? error.message : 'Unknown error',
  });
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal service error occurred',
    },
  });
};
