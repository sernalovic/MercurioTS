/**
 * Prueba E2E del pegado de calendarios: crea un conductor de prueba, pega
 * líneas por él (y otra repetida y basura), verifica el calendario creado
 * con sus días y el resumen, y borra el conductor (cascada del calendario).
 *
 * Uso (en packages/db):
 *   node --experimental-transform-types --env-file ../../apps/web/.env.local scripts/probarPegado.ts
 */
import pg from "pg";

const SERVIDOR = "http://localhost:3000";
const MES = "2026-10";
const MATRICULA_PRUEBA = 999;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function api(ruta: string, metodo: "GET" | "POST" | "DELETE", token: string | null, cuerpo?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const r = await fetch(`${SERVIDOR}/api/v1/${ruta}`, {
    method: metodo,
    headers: {
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      ...(cuerpo === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  const texto = await r.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(texto) as Record<string, unknown>; } catch { json = { bruto: texto }; }
  return { status: r.status, json };
}

try {
  const login = await api("cuenta/entrar", "POST", null, { usuario: "prueba", clave: "Mercurio-2026!" });
  if (login.status !== 200) throw new Error(`login ${login.status}`);
  const token = String((login.json as { token?: string }).token);

  // limpieza previa de restos de una prueba anterior
  const restos = await pool.query(`SELECT "Id" FROM "Conductores" WHERE "Matricula" = $1`, [MATRICULA_PRUEBA]);
  for (const r of restos.rows) {
    const bajaResto = await api("conductores", "DELETE", token, [Number(r.Id)]);
    console.log(`resto eliminado (Id ${r.Id}): ${bajaResto.status}`);
  }

  // 1) conductor de prueba
  const alta = await api("conductores", "POST", token, [{
    centro: 1, categoria: 0, situacion: 0, matricula: MATRICULA_PRUEBA,
      isUsuario: false, fechaAntiguedad: "2020-01-01", porcentajeIrpf: "0",
      numeroAfiliado: 999, isReduccionJornada: false, porcentajeJornada: 100,
      nombre: "Prueba", apellidos: "Pegado Anchón",
      acumuladasIniciales: "00:00", dcsIniciales: "0", dndsIniciales: "0", plusDistancia: "0",
      telefono: null, email: null, notas: null,
}] as unknown) as never;
  if (alta.status !== 200) throw new Error(`alta conductores ${alta.status}: ${JSON.stringify(alta.json)}`);
  const lista = await api(`conductores?centro=0`, "GET", token);
  const filas = (lista.json as { conductores?: { id: number; matricula: number }[] } | { id: number; matricula: number }[]) as { conductores?: { id: number; matricula: number }[] } | { id: number; matricula: number }[];
  const filasListas = Array.isArray(filas) ? filas : (filas.conductores ?? []);
  const conductor = filasListas.find((c) => c.matricula === MATRICULA_PRUEBA);
  if (!conductor) throw new Error("no se encontró el conductor de prueba");
  console.log(`conductor de prueba: Id ${conductor.id}`);

  // 2) pegado: línea válida para 999 + repetida + basal + matrícula inexistente
  const linea999 = `${MATRICULA_PRUEBA}\t3503\t3503\tJD\t3503\tJD\tOVA\tE\tDC\tDND360\tPER\tF6D\tDF\t\t3503\tJD`;
  const pegado = await api("calendarios/pegar", "POST", token, {
    fecha: MES, centro: 1, confirmado: true,
    texto: ["esta línea no vale", linea999, linea999].join("\n"),
  });
  console.log(`pegar: ${pegado.status} ${JSON.stringify(pegado.json)}`);

  // 3) verificación en BD
  const cal = await pool.query(
    `SELECT "Id" FROM "Calendarios" WHERE "ConductorId" = $1 AND "Fecha" = $2`,
    [conductor.id, `${MES}-01`],
  );
  if (cal.rows.length !== 1) throw new Error(`calendarios creados: ${cal.rows.length}`);
  const calendarioId = Number(cal.rows[0].Id);
  const dias = await pool.query(`SELECT count(*)::int n FROM "DiasCalendario" WHERE "CalendarioId" = $1`, [calendarioId]);
  const primera = await pool.query(
    `SELECT "TrabajadoIncidencia" inc, "TrabajadoNumero" num FROM "DiasCalendario" WHERE "CalendarioId" = $1 ORDER BY "Fecha" LIMIT 1`,
    [calendarioId],
  );
  const resumen = await pool.query(`SELECT "DiasActivo" a, "DiasInactivo" i, "HorasTrabajadas"::text h FROM "Resumenes" WHERE "CalendarioId" = $1`, [calendarioId]);
  console.log(`BD: dia ${dias.rows[0].n} dias, primera celda inc=${primera.rows[0].inc} num=${primera.rows[0].num}, resumen ${JSON.stringify(resumen.rows[0])}`);

  // 4) lista por la API
  const basicos = await api(`calendarios/basicos?fecha=${MES}&centro=1`, "GET", token);
  const cals = (basicos.json.calendarios ?? []) as { matricula: number; dias: { situacion: string }[] }[];
  console.log(`basicos: ${basicos.status} → ${cals.map((c) => c.matricula + " (" + c.dias.length + "). primera: " + c.dias[0]?.situacion).join(" | ")}`);

  // 5) limpieza
  const baja = await api("conductores", "DELETE", token, [conductor.id]);
  console.log(`baja del conductor de prueba: ${baja.status}`);
  const restantes = await pool.query(
    `SELECT count(*)::int n FROM "Calendarios" WHERE "ConductorId" = $1`,
    [conductor.id],
  );
  console.log(`tras cascada, calendarios del conductor: ${restantes.rows[0].n}`);
} finally {
  await pool.end();
}
