import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import type { Profile } from '@mirador/shared';
import { getSettings, type DB } from '../db/index';
import { signToken } from '../lib/auth';
import { httpError, route } from '../lib/http';

const LoginBody = z.object({
  userId: z.number().int().positive(),
  pin: z.string().regex(/^\d{4}$/, 'El PIN debe tener 4 dígitos'),
});

interface UserRow { id: number; name: string; role: Profile['role']; pin_hash: string; failed_attempts: number; locked_until: string | null }

export function authRoutes(db: DB) {
  const r = Router();

  // Perfiles activos para la pantalla de login (sin datos sensibles).
  r.get('/profiles', route((_req, res) => {
    const rows = db.prepare('SELECT id, name, role FROM users WHERE active = 1 ORDER BY id').all() as Profile[];
    res.json(rows);
  }));

  // RF-05 login con PIN · RF-08 bloqueo tras intentos fallidos
  r.post('/login', route((req, res) => {
    const { userId, pin } = LoginBody.parse(req.body);
    const u = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(userId) as UserRow | undefined;
    if (!u) throw httpError(404, 'Perfil no encontrado');

    const now = Date.now();
    if (u.locked_until && Date.parse(u.locked_until) > now) {
      const secs = Math.ceil((Date.parse(u.locked_until) - now) / 1000);
      res.status(423).json({ error: 'Perfil bloqueado temporalmente', retryAfterSeconds: secs });
      return;
    }

    const s = getSettings(db);
    if (!bcrypt.compareSync(pin, u.pin_hash)) {
      const attempts = u.failed_attempts + 1;
      if (attempts >= s.maxPinAttempts) {
        const until = new Date(now + s.lockMinutes * 60_000).toISOString();
        db.prepare('UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?').run(until, u.id);
        res.status(423).json({ error: 'Perfil bloqueado temporalmente', retryAfterSeconds: s.lockMinutes * 60 });
        return;
      }
      db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(attempts, u.id);
      res.status(401).json({ error: 'PIN incorrecto', attemptsLeft: s.maxPinAttempts - attempts });
      return;
    }

    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(u.id);
    const profile: Profile = { id: u.id, name: u.name, role: u.role };
    res.json({ ...profile, token: signToken(profile) });
  }));

  return r;
}
