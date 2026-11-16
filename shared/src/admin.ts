/* Reglas de Ajustes (RF-04) y Usuarios (RF-07). Las usa la app para validar en vivo
   y el servidor para decidir: los mensajes son los mismos en ambos lados. */
import { z } from 'zod';

export const ROLES = ['todo', 'mesero', 'barra', 'caja', 'dueno'] as const;

const number = z.number({ error: 'Escribe un número' });
const percent = number.min(0, 'No puede ser negativo').max(100, 'Máximo 100 %');
const whole = (max: number) => number.int('Escribe un número entero').min(1, 'Debe ser al menos 1').max(max, `Máximo ${max}`);

export const SettingsSchema = z.object({
  businessName: z.string().trim().min(2, 'Escribe el nombre del negocio').max(60, 'Máximo 60 caracteres'),
  taxPercent: percent,
  suggestedTipPercent: percent,
  singleOperator: z.boolean(),
  maxPinAttempts: whole(10),
  lockMinutes: whole(120),
  idleLogoutMinutes: whole(240),
  barLat: number.min(-90, 'La latitud va de -90 a 90').max(90, 'La latitud va de -90 a 90'),
  barLng: number.min(-180, 'La longitud va de -180 a 180').max(180, 'La longitud va de -180 a 180'),
});

/** PATCH /settings: cualquier subconjunto de los ajustes. */
export const SettingsPatchSchema = SettingsSchema.partial();

export const UserCreateSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 letras').max(30, 'Máximo 30 caracteres'),
  role: z.enum(ROLES, { error: 'Elige un rol' }),
  pin: z.string().regex(/^\d{4}$/, 'El PIN debe tener 4 dígitos'),
});

/** PATCH /users/:id: lo que cambie; el PIN solo si se escribe uno nuevo. Desactivar es `active: false` (RN-04). */
export const UserUpdateSchema = UserCreateSchema.partial().extend({ active: z.boolean().optional() });

/** Primer mensaje de error por campo, para mostrarlo bajo cada campo del formulario. */
export function fieldErrors(error: z.ZodError | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error?.issues ?? []) out[String(i.path[0])] ??= i.message;
  return out;
}
