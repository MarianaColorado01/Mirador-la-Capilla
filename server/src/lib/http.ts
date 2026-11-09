import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public field?: string) {
    super(message);
  }
}

export const httpError = (status: number, message: string, field?: string) => new HttpError(status, message, field);

/** Envuelve un handler para que los errores lleguen al manejador central. */
export const route =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const out = fn(req, res, next);
      if (out instanceof Promise) out.catch(next);
    } catch (e) {
      next(e);
    }
  };

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, field: err.field });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({ error: first?.message ?? 'Datos inválidos', field: first?.path.join('.') });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
};
