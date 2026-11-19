/* Interfaces y mapper (RF-10, RF-12): lo que manda el servidor (DTO) → el modelo que usa la app. */
import type { Product, ProductOwnerView } from '@mirador/shared';

/** DTO de GET /products y /products/:id: el dueño recibe además costo y margen. */
export type ProductDTO = Product | ProductOwnerView;

/** Modelo interno: los cálculos de stock se hacen una vez aquí y no en cada pantalla. */
export interface ProductModel extends Product {
  /** URL de la imagen, o null para mostrar la imagen alternativa (RF-10). */
  imageSource: string | null;
  /** Solo el dueño; null para los demás roles. */
  cost: number | null;
  margin: number | null;
  outOfStock: boolean;
  /** Quedan pocas: en o bajo el stock mínimo, sin estar agotado. */
  lowStock: boolean;
}

export function toProductModel(dto: ProductDTO): ProductModel {
  const owner = 'cost' in dto;
  return {
    ...dto,
    imageSource: dto.imageUrl?.trim() || null,
    cost: owner ? dto.cost : null,
    margin: owner ? dto.margin : null,
    outOfStock: dto.stock <= 0,
    lowStock: dto.stock > 0 && dto.stock <= dto.minStock,
  };
}
