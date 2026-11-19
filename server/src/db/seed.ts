import bcrypt from 'bcryptjs';
import type { DB } from './index';

/** PIN de prueba de todos los perfiles semilla. Cámbienlo desde Usuarios (RF-07). */
export const DEMO_PIN = '1234';

/** Datos de ejemplo, los mismos de los mockups. Solo se cargan si la base está vacía. */
export function seed(db: DB): boolean {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (n > 0) return false;

  const hash = bcrypt.hashSync(DEMO_PIN, 10);
  db.transaction(() => {
    const user = db.prepare('INSERT INTO users(name, role, pin_hash) VALUES(?, ?, ?)');
    for (const [name, role] of [
      ['Ana', 'mesero'], ['Luis', 'mesero'], ['Operador', 'todo'],
      ['Preparador', 'barra'], ['Cajero', 'caja'], ['Dueño', 'dueno'],
    ]) user.run(name, role, hash);

    const cat = db.prepare('INSERT INTO categories(name) VALUES(?)');
    const cats: Record<string, number | bigint> = {};
    for (const c of ['Café', 'Cervezas', 'Licores', 'Cócteles', 'Comidas', 'Sin alcohol']) cats[c] = cat.run(c).lastInsertRowid;

    const owner = (db.prepare("SELECT id FROM users WHERE role = 'dueno'").get() as { id: number }).id;
    const prod = db.prepare('INSERT INTO products(name, category_id, price, cost, stock, min_stock) VALUES(?, ?, ?, ?, 0, ?)');
    const move = db.prepare("INSERT INTO stock_movements(product_id, type, qty, reason, reference, user_id) VALUES(?, 'entrada', ?, 'Inventario inicial', 'semilla', ?)");
    const setStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    const products: [string, string, number, number, number, number][] = [
      ['Águila 330 ml', 'Cervezas', 4000, 2500, 48, 12],
      ['Club Colombia', 'Cervezas', 5000, 3000, 30, 10],
      ['Aguardiente 1/2', 'Licores', 45000, 30000, 2, 5],
      ['Ron botella', 'Licores', 55000, 38000, 1, 3],
      ['Tinto', 'Café', 2500, 600, 120, 20],
      ['Café de origen', 'Café', 6000, 1800, 40, 10],
      ['Michelada', 'Cócteles', 8000, 3500, 20, 5],
      ['Mojito', 'Cócteles', 12000, 5000, 0, 5],
      ['Arepa con chorizo', 'Comidas', 12000, 5500, 18, 6],
      ['Agua 600 ml', 'Sin alcohol', 3000, 1200, 24, 6],
    ];
    for (const [name, c, price, cost, stock, min] of products) {
      const id = prod.run(name, cats[c], price, cost, min).lastInsertRowid;
      // RN-02: el stock inicial también entra como movimiento
      if (stock > 0) { move.run(id, stock, owner); setStock.run(stock, id); }
    }

    const table = db.prepare('INSERT INTO tables(number, zone) VALUES(?, ?)');
    for (let i = 1; i <= 8; i++) table.run(i, i <= 4 ? 'Terraza' : 'Salón');

    db.prepare("INSERT INTO suppliers(name, phone, notes) VALUES('Distribuidora X', '300 000 0101', 'Datos de ejemplo')").run();
  })();
  return true;
}
