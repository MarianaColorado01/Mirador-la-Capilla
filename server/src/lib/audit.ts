import type { DB } from '../db/index';

/** RF-37: todo cambio deja usuario, fecha y detalle; nunca se borra. */
export function audit(db: DB, userId: number | null, action: string, entity: string, entityId: number | bigint | null, detail?: unknown) {
  db.prepare('INSERT INTO audit_log(user_id, action, entity, entity_id, detail) VALUES(?, ?, ?, ?, ?)').run(
    userId,
    action,
    entity,
    entityId,
    detail === undefined ? null : JSON.stringify(detail),
  );
}
