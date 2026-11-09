import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@mirador/shared';
import { DATA_DIR } from '../db/index';
import { httpError } from './http';

export interface TokenUser {
  id: number;
  name: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenUser;
  }
}

/** Secreto del JWT: variable de entorno o uno aleatorio guardado en data/ la primera vez. */
function loadSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = join(DATA_DIR, '.jwt-secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  mkdirSync(DATA_DIR, { recursive: true });
  const secret = randomBytes(32).toString('hex');
  writeFileSync(file, secret);
  return secret;
}

let secret: string | null = null;
const getSecret = () => (secret ??= loadSecret());

export const signToken = (u: TokenUser) => jwt.sign(u, getSecret(), { expiresIn: '12h' });

export function verifyToken(token: string): TokenUser {
  const p = jwt.verify(token, getSecret()) as TokenUser & jwt.JwtPayload;
  return { id: p.id, name: p.name, role: p.role };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(httpError(401, 'Inicia sesión para continuar'));
  try {
    req.user = verifyToken(h.slice(7));
    next();
  } catch {
    next(httpError(401, 'La sesión expiró. Vuelve a ingresar.'));
  }
}

/** RN-09: cada endpoint verifica el rol del token antes de ejecutar la acción. */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(httpError(401, 'Inicia sesión para continuar'));
    if (req.user.role !== 'dueno' && !roles.includes(req.user.role))
      return next(httpError(403, 'Tu perfil no tiene permiso para esta acción'));
    next();
  };
