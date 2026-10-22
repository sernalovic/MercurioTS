/**
 * Volcado de datos reales: BD local `mercurio` (SOLO LECTURA) → BD Neon.
 * Copia con los mismos ids, en orden de dependencias (padres antes que
 * hijos), y ajusta las secuencias al final. NUNCA escribe en `mercurio`.
 *
 * Uso (PowerShell, env en la propia sesión):
 *   node --experimental-transform-types scripts/copiarProduccion.ts
 *
 *   MERCURIO_ORIGEN  cadena de la BD local mercurio (solo lectura)
 *   MERCURIO_DESTINO cadena de la BD Neon (la que se rellena)
 *
 *   argv "ver"    → solo recuentos por tabla (origen vs destino).
 *   argv "fuerza" → trunca el destino completo (orden inverso, CASCADE)
 *                   y copia todo otra vez. Sin él, si una tabla ya tiene
 *                   filas: se salta si coincide el recuento, y se avisa
 *                   (sin copiar) si está a medias.
 */
import pg from "pg";

const origen = new pg.Pool({ connectionString: process.env.MERCURIO_ORIGEN });
const destino = new pg.Pool({ connectionString: process.env.MERCURIO_DESTINO });
if (process.env.MERCURIO_ORIGEN === undefined || process.env.MERCURIO_DESTINO === undefined) {
  throw new Error("Faltan MERCURIO_ORIGEN o MERCURIO_DESTINO en el entorno.");
}

pg.types.setTypeParser(1114, (v) => v); // timestamp sin tz → string tal cual
pg.types.setTypeParser(1184, (v) => v); // timestamp con tz → string tal cual

/** Orden de copia respetando las FKs del esquema. */
const ORDEN = [
  "AspNetRoles", "AspNetUsers", "AspNetRoleClaims", "AspNetUserClaims",
  "AspNetUserLogins", "AspNetUserRoles", "AspNetUserTokens",
  "Convenios", "OpcionesCentro", "TablasSalariales", "Festivos",
  "Lineas", "Itinerarios", "Paradas", "Graficos", "ItinerariosGraficos",
  "Conductores", "Regulaciones", "Nominas", "ConceptosNomina",
  "Calendarios", "DiasCalendario", "Resumenes",
  "Reclamaciones", "ConceptosReclamados",
];

const columnasDe = async (pool: pg.Pool, tabla: string): Promise<string[]> => {
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [tabla],
  );
  return r.rows.map((d) => String(d.column_name));
};

const recuentoDe = async (pool: pg.Pool, tabla: string): Promise<number> =>
  (await pool.query(`SELECT COUNT(*)::bigint AS n FROM "${tabla}"`)).rows[0].n as number;

if (process.argv.slice(2).includes("ver")) {
  for (const tabla of ORDEN) {
    console.log(tabla.padEnd(22), "origen", String(await recuentoDe(origen, tabla)).padStart(7),
      "destino", String(await recuentoDe(destino, tabla)).padStart(7));
  }
  await origen.end();
  await destino.end();
  process.exit(0);
}

// Tablas del original fuera de la lista: aviso (no falla).
const demas = (await origen.query(
  `SELECT table_name AS t FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
)).rows.map((d) => String(d.t));
const fuera = demas.filter((t) => !ORDEN.includes(t) && t !== "__EFMigrationsHistory");
if (fuera.length > 0) console.log("AVISO — tablas del origen fuera de la lista (no se copian):", fuera.join(", "));

if (process.argv.slice(2).includes("fuerza")) {
  console.log("Modo fuerza: se trunca el destino completo…");
  for (const tabla of [...ORDEN].reverse()) {
    await destino.query(`TRUNCATE TABLE "${tabla}" CASCADE`);
  }
}

const parciales: string[] = [];
for (const tabla of ORDEN) {
  const enDestino = await recuentoDe(destino, tabla);
  if (enDestino > 0) {
    const enOrigen = await recuentoDe(origen, tabla);
    if (enDestino === enOrigen) {
      console.log(tabla.padEnd(22), "ya copiada", enDestino);
      continue;
    }
    console.log(tabla.padEnd(22), `parcial (${enDestino} ≠ ${enOrigen}): se trunca y recopia…`);
    try {
      await destino.query(`TRUNCATE TABLE "${tabla}"`);
    } catch (e) {
      parciales.push(`${tabla}: destino ${enDestino} ≠ origen ${enOrigen} (no se pudo truncar: ${String(e).slice(0, 120)})`);
      continue;
    }
  }

  const colsOrigen = await columnasDe(origen, tabla);
  const colsDestino = await columnasDe(destino, tabla);
  const faltan = colsOrigen.filter((c) => !colsDestino.includes(c));
  if (faltan.length > 0) throw new Error(`${tabla}: columnas que faltan en el destino: ${faltan.join(", ")}`);

  const conId = colsOrigen.includes("Id");
  const lista = colsOrigen.map((c) => `"${c}"`).join(", ");
  // Con pocas columnas, páginas grandes; con muchas (DiasCalendario), medianas
  // para que los placeholders no pasen del límite de parámetros (65535).
  const porPagina = colsOrigen.length > 40 ? 4000 : 20000;
  const porGrupo = Math.min(300, Math.floor(60000 / colsOrigen.length));

  let cantidad = 0;
  let desdeId = 0;
  let lleno = true;
  while (lleno) {
    const sql = conId && desdeId > 0
      ? `SELECT ${lista} FROM "${tabla}" WHERE "Id" > $1 ORDER BY "Id" LIMIT ${porPagina}`
      : conId
        ? `SELECT ${lista} FROM "${tabla}" ORDER BY "Id" LIMIT ${porPagina}`
        : `SELECT ${lista} FROM "${tabla}" LIMIT ${porPagina}`;
    const r = await origen.query({ text: sql, values: conId && desdeId > 0 ? [desdeId] : [], rowMode: "array" });
    const filas = r.rows as unknown[][];
    if (filas.length === 0) { lleno = false; break; }

    for (let inicio = 0; inicio < filas.length; inicio += porGrupo) {
      const grupo = filas.slice(inicio, inicio + porGrupo);
      const valores: unknown[] = [];
      const terrain = grupo.map((fila) => `(${fila.map((v, i) => { void i; return `$${valores.push(v)}`; }).join(", ")})`);
      await destino.query(
        `INSERT INTO "${tabla}" (${lista}) VALUES ${terrain.join(", ")}`,
        valores,
      );
    }
    cantidad += filas.length;
    desdeId = conId ? Number((filas[filas.length - 1] as unknown[])[colsOrigen.indexOf("Id")]) : 0;
    lleno = filas.length === porPagina;
  }
  console.log(tabla.padEnd(22), "copiado", String(cantidad).padStart(7));
}

// ---- Secuencias al máximo Id de cada tabla ----
for (const tabla of ORDEN) {
  const cols = await columnasDe(destino, tabla);
  if (!cols.includes("Id")) continue;
  const r = await destino.query<{ mx: number | null }>(`SELECT MAX("Id") AS mx FROM "${tabla}"`);
  const max = r.rows[0].mx;
  if (max !== null) {
    await destino.query(
      `SELECT setval(pg_get_serial_sequence('"${tabla}"', 'Id'), $1, true)`,
      [max],
    );
  }
}

// ---- Verificación de recuentos ----
console.log("---- Recuentos destino ----");
for (const tabla of ORDEN) {
  console.log(tabla.padEnd(22), String(await recuentoDe(destino, tabla)).padStart(7));
}
if (parciales.length > 0) console.log("PENDIENTES:", parciales.join("; "));

await origen.end();
await destino.end();
