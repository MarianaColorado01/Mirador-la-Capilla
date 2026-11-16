/* Reglas de Ajustes (RF-04), Usuarios (RF-07), Productos y categorías (RF-13 a RF-15) Mesas (RF-22) e Inventario (RF-48). Las usa la app para validar en vivo
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

const name = (max: number) => z.string({ error: 'Escribe el nombre' }).trim().min(1, 'Escribe el nombre').max(max, `Máximo ${max} caracteres`);
const pesos = (what: string) => number.int('Escribe un número entero').positive(`El ${what} debe ser mayor que 0`);

/** RF-13: el stock no está aquí; solo cambia con movimientos de inventario (RN-02). */
export const ProductSchema = z.object({
  name: name(60),
  categoryId: z.number({ error: 'Elige una categoría' }).int().positive('Elige una categoría'),
  price: pesos('precio'),
  cost: pesos('costo'),
  minStock: number.int('Escribe un número entero').min(0, 'No puede ser negativo'),
  // Vacío = sin imagen: la app muestra la imagen alternativa (RF-10).
  imageUrl: z
    .string()
    .trim()
    .max(500, 'Máximo 500 caracteres')
    .refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), 'Escribe una dirección que empiece por http:// o https://')
    .nullable()
    .optional(),
});

/** PATCH /products/:id: lo que cambie. Desactivar es `active: false` (RF-14, RN-04). */
export const ProductUpdateSchema = ProductSchema.partial().extend({ active: z.boolean().optional() });

/** RF-15: categorías con nombre único. */
export const CategorySchema = z.object({ name: name(30) });
export const CategoryUpdateSchema = CategorySchema.partial().extend({ active: z.boolean().optional() });

/** RF-22: mesas con número único y zona opcional. */
export const TableCreateSchema = z.object({
  number: number.int('Escribe un número entero').min(1, 'Debe ser al menos 1').max(999, 'Máximo 999'),
  zone: z.string().trim().max(30, 'Máximo 30 caracteres').nullable().optional(),
});
export const TableUpdateSchema = TableCreateSchema.pick({ zone: true }).extend({ active: z.boolean().optional() });

/**
 * RF-48: ajuste manual de inventario. entrada suma y salida resta `qty` (≥ 1). En «ajuste» (conteo físico)
 * `qty` es el stock real contado (≥ 0) y el servidor registra la diferencia contra el stock del sistema.
 */
export const STOCK_ADJUST_TYPES = ['entrada', 'salida', 'ajuste'] as const;
export const StockAdjustmentSchema = z
  .object({
    productId: z.number({ error: 'Elige un producto' }).int().positive('Elige un producto'),
    type: z.enum(STOCK_ADJUST_TYPES, { error: 'Elige el tipo de movimiento' }),
    qty: number.int('Escribe un número entero').min(0, 'No puede ser negativo').max(100000, 'Máximo 100000'),
    reason: z.string({ error: 'Escribe el motivo' }).trim().min(3, 'Escribe el motivo (mínimo 3 letras)').max(100, 'Máximo 100 caracteres'),
  })
  .refine((b) => b.type === 'ajuste' || b.qty >= 1, { message: 'Debe ser al menos 1', path: ['qty'] });

/** Primer mensaje de error por campo, para mostrarlo bajo cada campo del formulario. */
export function fieldErrors(error: z.ZodError | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error?.issues ?? []) out[String(i.path[0])] ??= i.message;
  return out;
}
