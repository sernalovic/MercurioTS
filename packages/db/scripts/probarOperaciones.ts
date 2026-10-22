/**
 * Prueba de las operaciones del mes (`POST /api/v1/calendarios/operaciones`)
 * contra la BD local de desarrollo, con snapshot y restauración: ejecuta
 * cada operación sobre la October del centro 1, muestra qué cambió y al
 * final devuelve las filas a su estado inicial.
 *
 * Uso (PowerShell, en packages/db):
 *   node --experimental-transform-types --env-file ../../apps/web/.env.local scripts/probarOperaciones.ts
 *
 * Requiere el dev server del web (`pnpm --filter @mercurio/web dev`) en 3000
 * y el usuario `prueba` (clave Mercurio-2026!) con esAdmin.
 */
import pg from "pg";

const SERVIDOR = "http://localhost:3000";
const MES = "2026-10-01";
const CENTRO = 1;

/** Campos de día y resumen que se comparan y restauran. */
const CAMPOS_DIA = [
  "EsFestivo", "IsRemoteUpdated",
  "TrabajadoIncidencia", "TrabajadoNumero", "TrabajadoCodigo", "TrabajadoTurno",
  "TrabajadoInicio", "TrabajadoFinal", "TrabajadoInicioPartido", "TrabajadoFinalPartido",
  "TrabajadoTrabajadas", "TrabajadoAcumuladas", "TrabajadoNocturnas",
  "TrabajadoDesayuno", "TrabajadoComida", "TrabajadoCena", "TrabajadoTipoDia",
  "VirtualIncidencia", "VirtualNumero", "VirtualTurno",
  "VirtualInicio", "VirtualFinal",
  "VirtualTrabajadas", "VirtualAcumuladas", "VirtualNocturnas",
] as const;
const CAMPOS_RESUMEN = [
  "DiasActivo", "DiasInactivo", "DiasTrabajo", "DiasJD", "DiasFN", "DiasDS", "DiasDC", "DiasOV", "DiasE",
  "HorasTrabajadas", "HorasAcumuladas", "HorasNocturnas", "ImportePlusViaje", "ImporteQuebrantoMoneda",
] as const;

type FilaDia = Record<string, unknown>;
type FilaResumen = Record<string, unknown>;
type Snapshot = { dias: FilaDia[]; resumen: FilaResumen[] };

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function snapshot(): Promise<Snapshot> {
  const d = await pool.query(
    `SELECT "Id", ${CAMPOS_DIA.map((f) => `"${f}"`).join(", ")} FROM "DiasCalendario"
      WHERE "CalendarioId" IN (SELECT "Id" FROM "Calendarios" WHERE "Fecha" = $1 AND "Centro" = $2)
      ORDER BY "CalendarioId", "Fecha"`,
    [MES, CENTRO],
  );
  const r = await pool.query(
    `SELECT "Id", ${CAMPOS_RESUMEN.map((f) => `"${f}"`).join(", ")} FROM "Resumenes"
      WHERE "CalendarioId" IN (SELECT "Id" FROM "Calendarios" WHERE "Fecha" = $1 AND "Centro" = $2)
      ORDER BY "Id"`,
    [MES, CENTRO],
  );
  return { dias: d.rows, resumen: r.rows };
}

function mostrar(nombre: string, campos: readonly string[], antes: FilaDia[], despues: FilaDia[]): number {
  let cambios = 0;
  const muestras: string[] = [];
  const porId = new Map(antes.map((f) => [f.Id, f]));
  for (const fila of despues) {
    const original = porId.get(fila.Id);
    if (original === undefined) continue;
    for (const campo of campos) {
      const va = String(original[campo]);
      const vb = String(fila[campo]);
      if (va !== vb) {
        cambios++;
        if (muestras.length < 6) muestras.push(`  · ${campo} ${va} → ${vb}`);
      }
    }
  }
  console.log(`  ${nombre}: ${cambios} cambios${muestras.length > 0 ? "\n" + muestras.join("\n") : ""}`);
  return cambios;
}

async function aplicar(operacion: string, token: string, base: Snapshot): Promise<void> {
  const r = await fetch(`${SERVIDOR}/api/v1/calendarios/operaciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ operacion, fecha: MES, centro: CENTRO }),
  });
  const json = (await r.json()) as { ok?: boolean; total?: number; error?: string };
  if (!r.ok) {
    console.log(`  ${operacion}: HTTP ${r.status} — ${json.error ?? "?"}`);
    return;
  }
  const despues = await snapshot();
  mostrar("días", CAMPOS_DIA, base.dias, despues.dias);
  mostrar("resúmenes", CAMPOS_RESUMEN, base.resumen, despues.resumen);
  console.log(`  (calendarios tocados: ${json.total})`);
}

async function restaurar(base: Snapshot): Promise<void> {
  for (const fila of base.dias) {
    await pool.query(
      `UPDATE "DiasCalendario" SET ${CAMPOS_DIA.map((f, i) => `"${f}" = $${i + 1}`).join(", ")} WHERE "Id" = $${CAMPOS_DIA.length + 1}`,
      [...CAMPOS_DIA.map((f) => fila[f]), fila.Id],
    );
  }
  for (const fila of base.resumen) {
    await pool.query(
      `UPDATE "Resumenes" SET ${CAMPOS_RESUMEN.map((f, i) => `"${f}" = $${i + 1}`).join(", ")} WHERE "Id" = $${CAMPOS_RESUMEN.length + 1}`,
      [...CAMPOS_RESUMEN.map((f) => fila[f]), fila.Id],
    );
  }
}

try {
  const entrar = await fetch(`${SERVIDOR}/api/v1/cuenta/entrar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: "prueba", clave: "Mercurio-2026!" }),
  });
  if (!entrar.ok) {
    console.error(`No se pudo entrar en ${SERVIDOR}: HTTP ${entrar.status}`);
    process.exit(1);
  }
  const { token } = (await entrar.json()) as { token: string };

  const base = await snapshot();
  console.log(`Snapshot: ${base.dias.length} días, ${base.resumen.length} resúmenes (calendarios de ${MES} centro ${CENTRO})`);

  console.log("\n— ajustarJds —");
  await aplicar("ajustarJds", token, base);
  console.log("\n— marcarFestivos —");
  await aplicar("marcarFestivos", token, base);
  console.log("\n— recalcularResumenes —");
  await aplicar("recalcularResumenes", token, base);
  console.log("\n— regenerarTodos —");
  await aplicar("regenerarTodos", token, base);

  console.log("\nRestaurando estado inicial…");
  await restaurar(base);
  const final = await snapshot();
  const dOk = JSON.stringify(final.dias) === JSON.stringify(base.dias);
  const rOk = JSON.stringify(final.resumen) === JSON.stringify(base.resumen);
  console.log(`Restauración: días ${dOk ? "OK" : "CON DIFERENCIAS"}, resúmenes ${rOk ? "OK" : "CON DIFERENCIAS"}`);
  if (!dOk || !rOk) process.exit(2);
} finally {
  await pool.end();
}
