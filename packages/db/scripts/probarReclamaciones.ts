/**
 * Prueba E2E del apartado Reclamaciones/Nóminas (fase M6): rutas nuevas
 * (`reclamaciones` GET/POST/PUT/DELETE, `reclamaciones/porFecha`,
 * `conceptosReclamados/lista` DELETE, `nominas` GET, `nominas/id`,
 * `nominas/generar` POST, `nominas/:id` PUT/DELETE) y el round-trip completo
 * de agregados (conceptos con partidos Resuelto/fecha "").
 *
 * En la BD de desarrollo el conductor 450 (Id 6) tiene dos reclamaciones
 * REALES (septiembre Id 6 y octubre Id 5) que NO se tocan: las pruebas usan
 * agosto (sin reclamación) y diciembre, y borran la nómina que generan
 * (no había ninguna). Todo lo creado por el test se elimina al final.
 *
 * Uso (PowerShell, en packages/db):
 *   node --experimental-transform-types --env-file ../../apps/web/.env.local scripts/probarReclamaciones.ts
 *
 * Requiere el dev server del web (`pnpm --filter @mercurio/web dev`) en 3000
 * y el usuario `prueba` (clave Mercurio-2026!) con esAdmin.
 */
import pg from "pg";

const SERVIDOR = "http://localhost:3000";
const ID_CONDUCTOR = 6; // 450, centro Donosti
const FECHA_DIC = "2026-12-01";
const FECHA_AGO = "2026-08-01";
const FECHA_OCT = "2026-10-01";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let fallos = 0;
function comprobar(nombre: string, condicion: boolean, detalle = ""): void {
  console.log(`  ${condicion ? "✓" : "✗"} ${nombre}${detalle !== "" ? ` — ${detalle}` : ""}`);
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

/* Cuerpos de prueba */

function cuerpoDic(resuelto = false): Record<string, unknown> {
  return {
    id: 0,
    conductorId: ID_CONDUCTOR,
    fecha: FECHA_DIC,
    fechaEfecto: "2026-10-22",
    codigo: "202612450",
    notas: "prueba E2E",
    notaInterna: "interna E2E",
    cerrada: false,
    conceptosReclamados: [
      {
        id: 0,
        reclamacionId: 0,
        fecha: "", // concepto mensual → sentinel DateTime.MinValue
        tipo: 26, // OtraImporte
        descripcion: "Concepto mensual de prueba",
        graficoTrabajado: 0,
        horasReales: 0,
        horasCobradas: 0,
        importeReal: 1234, // céntimos en los tipos de importe
        importeCobrado: 123,
        incidenciasReales: 0,
        incidenciasCobradas: 0,
        importeTotal: 1111,
        resuelto,
      },
    ],
  };
}

function cuerpoAgo(dc = 2, dnd = 1, cerrada = false): Record<string, unknown> {
  return {
    id: 0,
    conductorId: ID_CONDUCTOR,
    fecha: FECHA_AGO,
    fechaEfecto: "2026-10-22",
    codigo: "202608450",
    notas: null,
    notaInterna: null,
    cerrada,
    conceptosReclamados: [
      {
        id: 0, reclamacionId: 0, fecha: "", tipo: 0, // TotalDc (unidades)
        descripcion: "DCs pendientes", graficoTrabajado: 0,
        horasReales: 0, horasCobradas: 0,
        importeReal: dc, importeCobrado: 0,
        incidenciasReales: 0, incidenciasCobradas: 0, importeTotal: 0, resuelto: false,
      },
      {
        id: 0, reclamacionId: 0, fecha: "", tipo: 1, // TotalDnd (unidades)
        descripcion: "DNDs pendientes", graficoTrabajado: 0,
        horasReales: 0, horasCobradas: 0,
        importeReal: dnd, importeCobrado: 0,
        incidenciasReales: 0, incidenciasCobradas: 0, importeTotal: 0, resuelto: false,
      },
    ],
  };
}

async function limpiar(t: string, ids: number[], idsNominas: number[]): Promise<void> {
  for (const id of ids) await pedir(t, `reclamaciones/${id}`, "DELETE");
  for (const id of idsNominas) await pedir(t, `nominas/${id}`, "DELETE");
}

async function main(): Promise<void> {
  console.log("== E2E Reclamaciones/Nóminas (fase M6) ==");
  const t = await token();

  // El estado inicial debe ser limpio para las fechas de prueba y conocido
  // en ónminas (0) para poder restaurarlo.
  let r = await pedir(t, `reclamaciones?idConductor=${ID_CONDUCTOR}`, "GET");
  const iniciales = (r.datos["reclamaciones"] as Record<string, unknown>[]) ?? [];
  const cuentanEnAgo = iniciales.some((x) => String(x["fecha"]).slice(0, 10) === FECHA_AGO);
  const cuentanEnDic = iniciales.some((x) => String(x["fecha"]).slice(0, 10) === FECHA_DIC);
  if (cuentanEnAgo || cuentanEnDic) {
    console.log("La BD ya tiene reclamaciones de agosto o diciembre 2026 (no debería en dev limpio). Se detiene para no estropear datos.");
    await pool.end();
    return;
  }
  r = await pedir(t, `nominas?idConductor=${ID_CONDUCTOR}`, "GET");
  const nominasIniciales = ((r.datos["nominas"] as Record<string, unknown>[]) ?? [])
    .filter((x) => String(x["fecha"]).slice(0, 10) === FECHA_OCT);
  if (nominasIniciales.length !== 0) {
    console.log("La BD ya tiene nómina de octubre del conductor (no debería en dev limpio). Se detiene.");
    await pool.end();
    return;
  }

  let idsCreados: number[] = [];
  let idsNominasCreados: number[] = [];

  try {
    // ---- GET vacío de porFecha ----
    r = await pedir(t, `reclamaciones/porFecha?fecha=${FECHA_DIC}&idConductor=${ID_CONDUCTOR}`, "GET");
    comprobar("porFecha sin reclamación devuelve null", r.estado === 200 && r.datos["reclamacion"] === null);

    // ---- POST de una reclamación con concepto mensual (fecha "") ----
    r = await pedir(t, "reclamaciones", "POST", cuerpoDic());
    const idDic = Number(r.datos["id"] ?? 0);
    comprobar("POST reclamación crea el agregado", r.estado === 200 && idDic > 0, `id=${idDic}`);
    idsCreados.push(idDic);

    // ---- GET porFecha vuelto tras el POST: conceptos y fechas intactas ----
    r = await pedir(t, `reclamaciones/porFecha?fecha=${FECHA_DIC}&idConductor=${ID_CONDUCTOR}`, "GET");
    const rec = r.datos["reclamacion"] as Record<string, unknown> | null;
    const con = rec === null ? [] : (rec["conceptosReclamados"] as Record<string, unknown>[]);
    comprobar("porFecha devuelve la reclamación", rec !== null);
    comprobar("la fecha mensual de la reclamación es el primer día", String(rec?.["fecha"]).slice(0, 10) === FECHA_DIC);
    comprobar("la fecha de efecto viaja solo con fecha", /^\d{4}-\d{2}-\d{2}$/.test(String(rec?.["fechaEfecto"])));
    comprobar("la fecha \"\" del concepto mensual se conserva", con.length === 1 && con[0]!["fecha"] === "");
    comprobar("el importe entra como números", Number(con[0]?.["importeTotal"]) === 1111);
    comprobar("resuelto en false al crear", con[0]?.["resuelto"] === false);

    // ---- PUT: marcar resuelto + cambiar notas (round-trip de Resuelto) ----
    const recDic = cuerpoDic(true) as Record<string, unknown> & { conceptosReclamados: Record<string, unknown>[] };
    recDic["id"] = idDic;
    recDic["conceptosReclamados"]![0]!["id"] = Number(con[0]!["id"]);
    recDic["notas"] = "marcado resuelto por E2E";
    r = await pedir(t, `reclamaciones/${idDic}`, "PUT", recDic);
    r = await pedir(t, `reclamaciones/porFecha?fecha=${FECHA_DIC}&idConductor=${ID_CONDUCTOR}`, "GET");
    const con2 = ((r.datos["reclamacion"] as Record<string, unknown>)?.["conceptosReclamados"] ?? []) as Record<string, unknown>[];
    comprobar("PUT resuelto=true y se persiste", con2.length === 1 && con2[0]!["resuelto"] === true);
    comprobar("PUT de notas se persisten", (r.datos["reclamacion"] as Record<string, unknown>)?.["notas"] === "marcado resuelto por E2E");

    // ---- GET lista: la nueva está y el orden es el más reciente primero ----
    r = await pedir(t, `reclamaciones?idConductor=${ID_CONDUCTOR}`, "GET");
    const lista = (r.datos["reclamaciones"] as Record<string, unknown>[]) ?? [];
    const fechas = lista.map((x) => String(x["fecha"]).slice(0, 10));
    comprobar("la lista incluye la nueva", fechas.includes(FECHA_DIC));
    comprobar("la lista está en desc por fecha (dic > oct > sep):", fechas[0] === FECHA_DIC, fechas.join(", "));

    // ---- DCs/DNDs reclamados en curso (agosto abierta con pendientes) ----
    // (baseline: reclamaciones abiertas anteriores del conductor ya cuentan)
    r = await pedir(t, `reclamaciones/dcsReclamados?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "GET");
    const baseDcs = Number(r.datos["importe"]);
    r = await pedir(t, `reclamaciones/dndsReclamados?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "GET");
    const baseDnds = Number(r.datos["importe"]);
    r = await pedir(t, "reclamaciones", "POST", cuerpoAgo());
    const idAgo = Number(r.datos["id"] ?? 0);
    idsCreados.push(idAgo);
    r = await pedir(t, `reclamaciones/dcsReclamados?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "GET");
    comprobar("dcsReclamados suma la de agosto en curso", Number(r.datos["importe"]) === baseDcs + 2, `${baseDcs} → ${r.datos["importe"]}`);
    r = await pedir(t, `reclamaciones/dndsReclamados?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "GET");
    comprobar("dndsReclamados idem para DNDs", Number(r.datos["importe"]) === baseDnds + 1, `${baseDnds} → ${r.datos["importe"]}`);

    // ---- cerrar la de agosto: deja de contar como en curso ----
    r = await pedir(t, `reclamaciones/${idAgo}`, "GET");
    const datosAgo = r.datos["reclamacion"] as Record<string, unknown>;
    r = await pedir(t, `reclamaciones/${idAgo}`, "PUT", { ...datosAgo, cerrada: true });
    r = await pedir(t, `reclamaciones/dcsReclamados?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "GET");
    comprobar("al marcar cerrada deja de contar", Number(r.datos["importe"]) === baseDcs, String(r.datos["importe"]));

    // ---- PUT que deja fuera un concepto: baja del que no viene ----
    const sinConceptos = { ...datosAgo, cerrada: false, conceptosReclamados: [] };
    r = await pedir(t, `reclamaciones/${idAgo}`, "PUT", sinConceptos);
    r = await pedir(t, `reclamaciones/${idAgo}`, "GET");
    const conAgo = (r.datos["reclamacion"] as Record<string, unknown>)?.["conceptosReclamados"] as unknown[];
    comprobar("PUT sin conceptos los borra (baja ausentes)", Array.isArray(conAgo) && conAgo.length === 0);

    // ---- DELETE de una reclamación ----
    await pedir(t, `reclamaciones/${idAgo}`, "DELETE");
    idsCreados = idsCreados.filter((x) => x !== idAgo);
    r = await pedir(t, `reclamaciones/porFecha?fecha=${FECHA_AGO}&idConductor=${ID_CONDUCTOR}`, "GET");
    comprobar("DELETE deja porFecha en null", r.estado === 200 && r.datos["reclamacion"] === null);

    // ---- Nóminas: id antes de generar ----
    r = await pedir(t, `nominas/id?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "GET");
    comprobar("nominas/id sin nómina devuelve 0", r.estado === 200 && Number(r.datos["id"]) === 0, String(r.datos["id"]));

    // ---- generar (calcula con CalculosNomina) ----
    r = await pedir(t, `nominas/generar?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "POST");
    const nomina = r.datos["nomina"] as Record<string, unknown> | null;
    const conceptosNomina = nomina?.["conceptos"] as Record<string, unknown>[] | undefined;
    comprobar("generar devuelve la nómina", r.estado === 200 && nomina !== null);
    comprobar("concerta fecha y conductor de la nómina", nomina !== null && String(nomina["fecha"]).slice(0, 10) === FECHA_OCT && Number(nomina["conductorId"]) === ID_CONDUCTOR);
    comprobar("tipoNomina Mensual (0)", nomina !== null && Number(nomina["tipoNomina"]) === 0);
    comprobar("conceptos generados", (conceptosNomina?.length ?? 0) > 0, `${conceptosNomina?.length ?? 0} conceptos`);
    const salarioBase = conceptosNomina?.find((c) => Number(c["tipoConceptoNomina"]) === 0);
    comprobar("el salario base se genera con 30 unidades", salarioBase !== undefined && Number(salarioBase["unidades"]) === 30);
    const nominaId = Number(nomina?.["id"] ?? 0);
    idsNominasCreados.push(nominaId);

    // ---- GET lista + nominas/id ----
    r = await pedir(t, `nominas?idConductor=${ID_CONDUCTOR}`, "GET");
    const listasNom = (r.datos["nominas"] as Record<string, unknown>[]) ?? [];
    comprobar("GET nominas la devuelve", listasNom.some((n) => Number(n["id"]) === nominaId));
    r = await pedir(t, `nominas/id?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "GET");
    comprobar("nominas/id ahora devuelve el id", Number(r.datos["id"]) === nominaId);

    // ---- PUT: recalcular con nuevo % IRPF (como Cambiar % IRPF del escritorio) ----
    r = await pedir(t, "convenios", "GET");
    const convenios = (r.datos["convenios"] as Record<string, unknown>[]) ?? [];
    const convenio26 = convenios.find((c) => Number(c["año"]) === 2026);
    const tablas = (convenio26?.["tablasSalariales"] as Record<string, unknown>[]) ?? [];
    const tabla = tablas.find((x) => Number(x["categoria"]) === 0);
    if (!tabla) {
      comprobar("convenio 2026 con tabla salarial para la categoría", false);
    } else {
      // Recálculo del escritorio: cambia el % IRPF y recalcula el agregado en
      // el cliente (aquí se emula aritméticamente; `recalcularNomina` del
      // dominio va en el paquete `@mercurio/desktop`).
      const nominaIrpf = nomina as Record<string, unknown>;
      const baseIrpfActual = Number(nominaIrpf["baseIrpf"] ?? 0);
      const ss = Number(nominaIrpf["descuentoSeguridadSocial"] ?? 0);
      const des = Number(nominaIrpf["descuentoDesempleo"] ?? 0);
      nominaIrpf["porcentajeIrpf"] = 10;
      nominaIrpf["descuentoIrpf"] = Math.round(baseIrpfActual * 0.1);
      nominaIrpf["totalDeducciones"] = Math.round(baseIrpfActual * 0.1) + ss + des;
      nominaIrpf["totalLiquido"] = Number(nominaIrpf["totalDevengado"]) -
        (Math.round(baseIrpfActual * 0.1) + ss + des);
      r = await pedir(t, `nominas/${nominaId}`, "PUT", nominaIrpf);
      comprobar("PUT nómina de recálculo ok", r.estado === 200);
      r = await pedir(t, `nominas/${nominaId}`, "GET");
      const despues = r.datos["nomina"] as Record<string, unknown> | null;
      const descuento = Number(despues?.["descuentoIrpf"] ?? -1);
      const base = Number(despues?.["baseIrpf"] ?? 0);
      comprobar("la base IRPF es positiva", base > 0, String(base));
      comprobar("IRPF recalculado al 10 %", Math.abs(descuento - base * 0.1) < 2, `${base} * 10% = ${base * 0.1} vs ${descuento}`);
      comprobar("los conceptos siguen tras el PUT (round-trip)", ((despues?.["conceptos"] as unknown[]) ?? []).length === conceptosNomina?.length);
    }

    // ---- regenerar: la previa se borra (una sola nómina mensual del mes) ----
    r = await pedir(t, `nominas/generar?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "POST");
    const nomina2 = r.datos["nomina"] as Record<string, unknown> | null;
    const id2 = Number(nomina2?.["id"] ?? 0);
    comprobar("regenerar devuelve una nómina", r.estado === 200 && id2 > 0);
    r = await pedir(t, `nominas?idConductor=${ID_CONDUCTOR}`, "GET");
    const trasRegen = ((r.datos["nominas"] as Record<string, unknown>[]) ?? [])
      .filter((n) => String(n["fecha"]).slice(0, 10) === FECHA_OCT);
    comprobar("regenerada sustituye a la previa (solo una)", trasRegen.length === 1 && Number(trasRegen[0]?.["id"]) === id2);
    if (nominaId !== id2) idsNominasCreados = idsNominasCreados.filter((x) => x !== nominaId);
    idsNominasCreados.push(id2);

    // ---- DELETE de nómina ----
    await pedir(t, `nominas/${id2}`, "DELETE");
    r = await pedir(t, `nominas/id?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "GET");
    comprobar("DELETE de nómina", Number(r.datos["id"]) === 0);

    // ---- DELETE de la reclamación de diciembre (vuelta al estado inicial) ----
    await limpiar(t, idsCreados, []);
    r = await pedir(t, `reclamaciones?idConductor=${ID_CONDUCTOR}`, "GET");
    const final = (r.datos["reclamaciones"] as Record<string, unknown>[]) ?? [];
    comprobar("la BD queda como estaba (solo las de antes del test)", final.length === iniciales.length &&
      final.every((x) => iniciales.some((y) => y["id"] === x["id"])), `${final.length} reclamaciones`);
    r = await pedir(t, `nominas/id?fecha=${FECHA_OCT}&idConductor=${ID_CONDUCTOR}`, "GET");
    comprobar("sin nómina de octubre al terminar", Number(r.datos["id"]) === 0);
  } finally {
    await limpiar(t, idsCreados, idsNominasCreados);
    await pool.end();
  }

  console.log(fallos === 0 ? "\nTodo correcto ✔" : `\nFallos: ${fallos}`);
  if (fallos > 0) process.exitCode = 1;
}

await main();
