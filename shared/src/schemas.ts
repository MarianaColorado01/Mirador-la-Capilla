/* Validaciones de formularios compartidas: la app muestra el error en el campo
   y el servidor rechaza lo mismo (RF-13, RF-48, RF-52, RF-53, RF-57). */
import { z } from 'zod';

const money = (label: string) =>
  z.coerce.number({ error: `${label}: escribe solo números` }).int(`${label}: sin decimales`).positive(`${label} debe ser mayor que 0`);

export const ProductInput = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del producto').max(60, 'Máximo 60 caracteres'),
  categoryId: z.coerce.number({ error: 'Elige una categoría' }).int().positive('Elige una categoría'),
  price: money('El precio'),
  cost: money('El costo'),
  minStock: z.coerce.number({ error: 'Stock mínimo: escribe solo números' }).int('Stock mínimo: sin decimales').min(0, 'El stock mínimo debe ser 0 o más'),
  active: z.boolean().default(true),
});
export type ProductInput = z.infer<typeof ProductInput>;

export const CategoryInput = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre de la categoría').max(30),
  active: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof CategoryInput>;

/** entrada y salida mueven `qty` unidades; ajuste fija el stock contado en `qty`. */
export const AdjustmentInput = z.object({
  productId: z.coerce.number().int().positive('Elige un producto'),
  type: z.enum(['entrada', 'salida', 'ajuste']),
  qty: z.coerce.number({ error: 'Cantidad: escribe solo números' }).int('La cantidad debe ser entera').min(0, 'La cantidad no puede ser negativa'),
  reason: z.string().trim().min(3, 'Escribe el motivo').max(200),
});
export type AdjustmentInput = z.infer<typeof AdjustmentInput>;

const coord = (min: number, max: number, label: string) =>
  z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number({ error: `${label}: escribe solo números` }).min(min).max(max).nullable());

export const SupplierInput = z
  .object({
    name: z.string().trim().min(2, 'Escribe el nombre del proveedor').max(60),
    phone: z.string().trim().max(30).optional().default(''),
    notes: z.string().trim().max(200).optional().default(''),
    address: z.string().trim().max(120).optional().default(''),
    lat: coord(-90, 90, 'Latitud'),
    lng: coord(-180, 180, 'Longitud'),
    active: z.boolean().default(true),
  })
  .refine((s) => (s.lat == null) === (s.lng == null), { message: 'Escribe latitud y longitud juntas', path: ['lng'] });
export type SupplierInput = z.infer<typeof SupplierInput>;

export const PurchaseInput = z.object({
  supplierId: z.coerce.number({ error: 'Elige un proveedor' }).int().positive('Elige un proveedor'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato AAAA-MM-DD'),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive('Elige un producto'),
        qty: z.coerce.number({ error: 'Cantidad: escribe solo números' }).int('La cantidad debe ser entera').positive('La cantidad debe ser mayor que 0'),
        unitCost: money('El costo unitario'),
      }),
    )
    .min(1, 'Agrega al menos un producto'),
});
export type PurchaseInput = z.infer<typeof PurchaseInput>;

export const ExpenseInput = z.object({
  concept: z.string().trim().min(3, 'Escribe el concepto').max(80),
  amount: money('El monto'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato AAAA-MM-DD'),
});
export type ExpenseInput = z.infer<typeof ExpenseInput>;

export const DateRange = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inicial inválida'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha final inválida'),
  })
  .refine((r) => r.from <= r.to, { message: 'La fecha inicial no puede ser posterior a la final', path: ['from'] });

/** Primer error de zod como { campo: mensaje } para pintarlo en el formulario. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join('.') || '_';
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
