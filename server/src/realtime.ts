import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Role, ServerEvents } from '@mirador/shared';
import { verifyToken } from './lib/auth';

/** Socket.IO con el mismo token de la API. Cada celular entra a la sala de su rol. */
export function attachRealtime(http: HttpServer) {
  const io = new Server(http, { cors: { origin: '*' } });

  io.use((socket, next) => {
    try {
      const user = verifyToken(String(socket.handshake.auth?.token ?? ''));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('No autorizado'));
    }
  });

  io.on('connection', (socket) => {
    const { role, id } = socket.data.user as { role: Role; id: number };
    socket.join(`rol:${role}`);
    socket.join(`usuario:${id}`);
  });

  /** Emite un evento a los roles indicados (el dueño siempre lo recibe). */
  function emit<E extends keyof ServerEvents>(event: E, payload: ServerEvents[E], roles: Role[] = ['todo', 'mesero', 'barra', 'caja']) {
    const rooms = [...new Set([...roles, 'dueno' as Role])].map((r) => `rol:${r}`);
    // Socket.IO tipa los eventos como funciones; aquí se envía el payload tal cual.
    (io.to(rooms).emit as (ev: string, p: unknown) => boolean)(event, payload);
  }

  return { io, emit };
}
