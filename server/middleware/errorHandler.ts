import { Request, Response, NextFunction } from 'express';

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  console.error('[Error de Servidor]', err);

  const response: ApiErrorResponse = {
    ok: false,
    error: {
      code: errorCode,
      message: err.message || 'Ha ocurrido un error interno en el servidor.',
      details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    },
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(response);
}
