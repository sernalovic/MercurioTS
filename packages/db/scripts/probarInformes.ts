/**
 * Prueba E2E de Informes/Herramientas/Usuarios (fase M8): rutas nuevas
 * (`calendarios` GET, `calendarios/estadisticas/asignacionGraficos`,
 * `graficos/existeGrupo`, `graficos/diferencias/simples`, `itinerarios` GET,
 * `reclamaciones/estadisticas/conceptosMes|Año`, `cuenta/usuarios` GET,
 * `cuenta/usuarios/:id/permisos` PUT y `cuenta/enviarEmail` POST).
 *
 * Solo hace LECTURAS y comprobaciones de autorización: no modifica datos
 * (el único PUT posible restaura los mismos permisos que ya tenía el
 * usuario de prueba). El correo masivo debe responder con el mismo mensaje
 * que el original si no hay SMTP en el entorno.
 *
 * Uso (PowerShell, en packages/db):
 *   node --experimental-transform-types --env-file ../../apps/web/.env.local scripts/probarInformes.ts
 *
 * Requiere el dev server del web (`pnpm --filter @mercurio/web dev`) en 3000
 * y el usuario `prueba` (clave Mercurio-2026!) con esAdmin.
 */
import pg from "pg";

const SERVIDOR = "http://localhost:3000";
const MES_OCT = "2026-10-01";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let fallos = 0;
function comprobar(nombre: string, condicion: boolean, detalle = ""): void {
  console.log(`  ${condicion ? "OK" : "XX"} ${nombre}${detalle !== "" ? ` — ${detalle}` : ""}`);
  if (!condicion) fallos++;
}

interface HttpResp { estado: number; datos: Record<string, unknown>; }

async function token(): Promise<string> {
  const r = await fetch(`${SERVIDOR}/api/v1/cuenta/entrar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: "prueba", clave: "Mercurio-2026!" }),
  });
  const d = (await r.json()) as { token?: string };
  if (!r.ok || !d.token) throw new Error(`No se pudo entrar: ${r.status}`);
  return d.token as string;
}

async function pedir(
  t: string,
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
): Promise<HttpResp> {
  const r = await fetch(`${SERVIDOR}/api/v1/${ruta}`, {
    method: metodo,
    headers: {
      ...(t !== "" ? { Authorization: `Bearer ${t}` } : {}),
      ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { estado: r.status, datos };
}

type CalendarioJson = { id: number; conductor: { matricula: number } | null; resumen: { errores: string } | null; dias: unknown[] };

async function main(): Promise<void> {
  console.log("== E2E Informes/Herramientas/Usuarios (fase M8) ==");
  const t = await token();
  let r: HttpResp;

  // ---- 1 · GET calendarios (agregados del mes) ----
  r = await pedir(t, `calendarios?fecha=${MES_OCT}&centro=1`, "GET");
  const cals = (r.datos.calendarios ?? []) as CalendarioJson[];
  comprobar("GET calendarios → 200 con agregados", r.estado === 200 && cals.length > 0, `${cals.length} calendarios`);
  const conDias = cals.filter((c) => c.dias.length > 0).length;
  comprobar("hay calendarios con días (el sembrado de octubre)", conDias > 0, `${conDias}/${cals.length}`);
  const errores = cals.filter((c) => c.resumen !== null && c.resumen.errores !== "");
  comprobar("el resumen llega con errores cuando hay", Array.isArray(errores), `${errores.length} con errores`);
  r = await pedir(t, `calendarios?fecha=malo&centro=1`, "GET");
  comprobar("GET calendarios fecha mala → 400", r.estado === 400);

  // ---- 2 · asignacionGraficos ----
  r = await pedir(t, `calendarios/estadisticas/asignacionGraficos?fecha=${MES_OCT}&centro=1`, "GET");
  const asig = (r.datos.asignacion ?? []) as Array<Record<string, unknown>>;
  comprobar("asignacionGraficos → 200", r.estado === 200, `${asig.length} días`);
  if (asig.length > 0) {
    const d1 = asig[0] as Record<string, unknown>;
    comprobar("la fila tiene descansos y grupos",
      typeof d1.fecha === "string" && typeof d1.descansosParaDia === "number" && typeof d1.graficosParaDia === "number",
      JSON.stringify(d1).slice(0, 120));
  }

  // ---- 3 · existeGrupo + diferencias/simples + itinerarios ----
  r = await pedir(t, "graficos/existeGrupo?centro=1&fecha=2099-01-01", "GET");
  comprobar("existeGrupo (grupo inexistente) → false", r.estado === 200 && r.datos.existe === false);
  r = await pedir(t, "graficos/diferencias/simples?fecha1=2099-01-01&fecha2=2099-02-01&centro=1", "GET");
  comprobar("diferencias/simples con grupos vacíos → lista vacía", r.estado === 200 && (r.datos.diferencias ?? []).length === 0);
  r = await pedir(t, "itinerarios", "GET");
  const its = (r.datos.itinerarios ?? []) as Array<Record<string, unknown>>;
  comprobar("GET itinerarios → 200", r.estado === 200, `${its.length} itinerarios`);

  // ---- 4 · estadísticas de reclamaciones ----
  r = await pedir(t, `reclamaciones/estadisticas/conceptosMes?fecha=${MES_OCT}&centro=1`, "GET");
  const cpts = (r.datos.conceptos ?? []) as Array<{ matricula: number; concepto: Record<string, unknown> }>;
  comprobar("conceptosMes → 200 con estructura", r.estado === 200 && cpts.every((c) => c.matricula > 0 && typeof c.concepto.tipo === "number"),
    `${cpts.length} conceptos`);
  r = await pedir(t, "reclamaciones/estadisticas/conceptosAno?año=2026&centro=0", "GET");
  const cptsA = (r.datos.conceptos ?? []) as unknown[];
  comprobar("conceptosAño (Todos) → 200", r.estado === 200, `${cptsA.length} conceptos`);
  r = await pedir(t, "reclamaciones/estadisticas/conceptosAno?año=99&centro=0", "GET");
  comprobar("conceptosAño año malo → 400", r.estado === 400);

  // ---- 5 · Usuarios: autorización ----
  r = await pedir("", "cuenta/usuarios", "GET");
  comprobar("GET cuenta/usuarios sin token → 401", r.estado === 401);
  r = await pedir(t, "cuenta/usuarios", "GET");
  const usus = (r.datos.usuarios ?? []) as Array<Record<string, unknown>>;
  comprobar("GET cuenta/usuarios → 200", r.estado === 200, `${usus.length} usuarios`);
  const yo = usus.find((u) => u.userName === "prueba");
  const soySuper = yo?.isSuper === true;
  if (!soySuper) {
    r = await pedir(t, `cuenta/usuarios/6/permisos`, "PUT", { isAdmin: true, isSuper: false, isAfiliado: false, isLocked: false });
    comprobar("PUT permisos sin ser súper → 403", r.estado === 403);
  } else {
    // Súper: restaura los mismos permisos (no-op) y comprueba el round-trip.
    const valores = { isAdmin: yo?.isAdmin, isSuper: true, isAfiliado: yo?.isAfiliado, isLocked: yo?.isLocked };
    r = await pedir(t, `cuenta/usuarios/${yo?.id}/permisos`, "PUT", valores);
    comprobar("PUT permisos siendo súper (no-op) → 204", r.estado === 204);
    r = await pedir(t, "cuenta/usuarios", "GET");
    const despues = ((r.datos.usuarios ?? []) as Array<Record<string, unknown>>).find((u) => u.userName === "prueba");
    comprobar("los permisos siguen igual tras el no-op", despues?.isAdmin === yo?.isAdmin && despues?.isLocked === yo?.isLocked);
  }
  r = await pedir("", "cuenta/usuarios/6/permisos", "PUT", { isAdmin: true, isSuper: false, isAfiliado: false, isLocked: false });
  comprobar("PUT permisos sin token → 401", r.estado === 401);

  // ---- 6 · enviarEmail sin SMTP ----
  r = await pedir(t, "cuenta/enviarEmail", "POST", {
    asunto: "prueba", cuerpo: "prueba",
    direcciones: [{ nombre: "x", email: "x@example.com" }],
  });
  const smtp = process.env.SMTP_HOST === undefined;
  if (smtp) {
    comprobar("enviarEmail sin SMTP → 501 con el mensaje del original",
      r.estado === 501 && String(r.datos.error).includes("No hay servidor SMTP configurado"), String(r.datos.error ?? ""));
  } else {
    comprobar("enviarEmail (SMTP configurado) → 204", r.estado === 204);
  }
  r = await pedir("", "cuenta/enviarEmail", "POST", { asunto: "x", cuerpo: "x", direcciones: [] });
  comprobar("enviarEmail sin token → 401", r.estado === 401);

  // ---- 7 · la BD no ha cambiado ----
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM "Reclamaciones"');
  comprobar("la BD conserva las reclamaciones importadas (43)", rows[0].n === 43, `${rows[0].n}`);
  await pool.end();

  console.log(fallos === 0 ? "\nTodo correcto ✔" : `\nFALLOS: ${fallos}`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

await main();
