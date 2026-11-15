import { defineConfig } from 'vitest/config';

// Cada prueba inicia sesión con los 6 perfiles (bcrypt): en un PC cargado supera los 5 s por defecto.
export default defineConfig({
  test: { testTimeout: 20000, hookTimeout: 20000 },
});
