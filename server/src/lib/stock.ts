/** RF-50: el movimiento dejó el stock en o bajo el mínimo y antes estaba por encima (se avisa una sola vez al cruzar). */
export const crossedMin = (before: number, after: number, min: number) => before > min && after <= min;
