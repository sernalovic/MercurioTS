import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  `SELECT "Centro"::text AS centro, min("Fecha")::text AS fmin, max("Fecha")::text AS fmax, count(*)::text AS total
    FROM "Graficos" GROUP BY "Centro" ORDER BY "Centro"`,
);
console.log(JSON.stringify(r.rows, null, 1));
await c.end();
