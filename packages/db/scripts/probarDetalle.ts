/**
 * Prueba E2E del detalle de calendario (`/api/v1/calendarios/:id` GET/PUT,
 * `diasCalendario/dia`, `graficos/paraFecha`, `resumenes/hastaMes`,
 * `resumenes/hastaNoviembreAnoAnterior` y `reclamaciones/{dcs,dnds}Reclamados`)
 * contra la BD local de desarrollo. El calendario de octubre 2026 del
 * conductor de pruebas se modifica con un PUT (nota marcada como remota) y se
 * restaura después con los datos originales; el gráfico de prueba se borra al
 * final. En la BD dev solo el calendario de octubre tiene días, así que los
 * vecinos de septiembre y noviembre deben salir null.
 *
 * Uso (PowerShell, en packages/db):
 *   node --experimental-transform-types --env-file ../../apps/web/.env.local scripts/probarDetalle.ts
 *
 * Requiere el dev server del web (`pnpm --filter @mercurio/web dev`) en 3000
 * y el usuario `prueba` (clave Mercurio-2026!) con esAdmin.
 */
import pg from "pg";

const SERVIDOR = "http://localhost:3000";
const AÑO = "2026";
const MATRICULA = 450; // conductor de pruebas de la BD dev

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let fallos = 0;
function comprobar(nombre: string, condicion: boolean, detalle = ""): void {
  console.log(`  ${condicion ? "✓" : "✗"} ${nombre}${detalle !== "" ? ` — ${detalle}` : ""}`);
  if (!condicion) fallos++;
}

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
  token_: string,
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
): Promise<{ estado: number; datos: Record<string, unknown> }> {
  const r = await fetch(`${SERVIDOR}/api/v1/${ruta}`, {
    method: metodo,
    headers: {
      ...(token_ !== "" ? { Authorization: `Bearer ${token_}` } : {}),
      ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { estado: r.status, datos };
}

/** La rejilla del detalle y una copia de la fila de un día concreto (para comparar después). */
interface Versiones {
  calendario: Record<string, unknown>;
  dia: Record<string, unknown>;
}

function diaDe(c: Record<string, unknown>, fecha: string): Record<string, unknown> {
  return (c["dias"] as Record<string, unknown>[]).find(
    (d) => String(d["fecha"]).slice(0, 10) === fecha,
  ) as Record<string, unknown>;
}

async function cargar(t: string, id: number): Promise<Versiones | null> {
  const { estado, datos } = await pedir(t, `calendarios/${id}`, "GET");
  if (estado !== 200) return null;
  const calendario = datos["calendario"] as Record<string, unknown>;
  return { calendario, dia: diaDe(calendario, `${AÑO}-10-15`) };
}

function graficoPrueba(): Record<string, unknown> {
  const ini = 360; // 06:00
  const fin = 792; // 13:12
  return {
    id: 0,
    centro: 1,
    fecha: `${AÑO}-10-01`,
    numero: 3503,
    categoria: 0,
    tipoDia: 0,
    turno: 1,
    noCalcular: false,
    tienePlusPaqueteria: false,
    tieneErrorTiempoPartido: false,
    inicio: ini,
    final: fin,
    inicioPartido: null,
    finalPartido: null,
    valoracion: fin - ini,
    tiempoTotal: fin - ini,
    tiempoPartido: 0,
    trabajadas: fin - ini,
    trabajadasConvenio: 0,
    tiempoVacio: 0,
    acumuladas: fin - ini,
    nocturnas: 0,
    desayuno: 0,
    comida: 0,
    cena: 0,
    plusCena: 0,
    itinerarios: [],
  };
}

async function main(): Promise<void> {
  console.log("== Detalle de calendario: API ==");

  const t = await token();

  // Id del calendario de octubre del conductor de pruebas.
  const { rows: filasId } = await pool.query<{ id: number }>(
    `select "Id" as id from "Calendarios" where "ConductorId" = 6 and "Fecha" = $1`,
    [`${AÑO}-10-01 00:00:00`],
  );
  const id = filasId[0]!.id;
  console.log(`Calendario de octubre: Id ${id}`);

  // 1. Carga completa.
  let v = await cargar(t, id);
  comprobar("GET cargó el calendario", v !== null);
  if (v !== null) {
    const dias = v.calendario["dias"] as Record<string, unknown>[];
    const conductor = v.calendario["conductor"] as Record<string, unknown>;
    const regulaciones = conductor["regulaciones"] as unknown[];
    comprobar("Los 31 días de octubre", Array.isArray(dias) && dias.length === 31, `${dias.length}`);
    comprobar("Conductor con matrícula 450", Number(conductor["matricula"]) === MATRICULA);
    comprobar("El conductor lleva regulaciones", Array.isArray(regulaciones));
    comprobar("El día lleva id", Number(v.dia["id"]) > 0);
    comprobar("El día lleva calendarioId", Number(v.dia["calendarioId"]) === id);
    comprobar(
      "Los tres servicios del día",
      v.dia["servicioAnual"] !== undefined && v.dia["servicioTrabajado"] !== undefined &&
        v.dia["servicioVirtual"] !== undefined,
    );
  }

  // 2. Vecinos: en la BD dev solo octubre tiene días.
  const rPrev = await pedir(t, `calendarios/diasCalendario/dia?fecha=${AÑO}-09-30&idConductor=6`, "GET");
  comprobar("Vecino de septiembre (sin días) → null", rPrev.estado === 200 && rPrev.datos["dia"] === null);
  const rVecinoPos = await pedir(t, `calendarios/diasCalendario/dia?fecha=${AÑO}-10-15&idConductor=6`, "GET");
  const diaVecino = rVecinoPos.datos["dia"] as Record<string, unknown> | null;
  comprobar("Día de octubre con conductora real", rVecinoPos.estado === 200 && diaVecino !== null &&
    String(diaVecino["fecha"]).slice(0, 10) === `${AÑO}-10-15`);
  const rVacio = await pedir(t, `calendarios/diasCalendario/dia?fecha=${AÑO}-10-15&idConductor=999`, "GET");
  comprobar("Día sin calendario → null", rVacio.estado === 200 && rVacio.datos["dia"] === null);

  // 3. Gráfico por fecha: se crea el de prueba, se consulta y se borra.
  let rG: { estado: number; datos: Record<string, unknown> } | null = null;
  try {
    const rAlta = await pedir(t, `graficos`, "POST", [graficoPrueba()]);
    comprobar("Alta del gráfico de prueba", rAlta.estado === 200, `estado ${rAlta.estado}`);
    rG = await pedir(t, `graficos/paraFecha?numero=3503&fecha=${AÑO}-10-15&centro=1`, "GET");
    const grafico = rG.datos["grafico"] as Record<string, unknown> | null;
    comprobar("Gráfico 3503 de octubre 2026", rG.estado === 200 && grafico !== null &&
      Number(grafico["numero"]) === 3503, grafico !== null ? `turno ${grafico["turno"]} inicio ${grafico["inicio"]}` : "");
  } finally {
    const rBaja = await pedir(t, `graficos/porFecha?fecha=${AÑO}-10-01&centro=1`, "DELETE");
    comprobar("Baja del gráfico de prueba", rBaja.estado === 200);
  }
  const rG2 = await pedir(t, `graficos/paraFecha?numero=9999&fecha=${AÑO}-10-15&centro=1`, "GET");
  comprobar("Gráfico inexistente → null", rG2.estado === 200 && rG2.datos["grafico"] === null);

  // 4. Saldos: resúmenes y reclamados.
  const rH = await pedir(t, `resumenes/hastaMes?matricula=${MATRICULA}&hasta=${AÑO}-10-01`, "GET");
  comprobar("hastaMes responde", rH.estado === 200 && "resumen" in rH.datos,
    `resumen: ${rH.datos["resumen"] === null ? "null" : "datos"}`);
  const rN = await pedir(t, `resumenes/hastaNoviembreAnoAnterior?matricula=${MATRICULA}&hasta=${AÑO}-10-01`, "GET");
  comprobar("hastaNoviembreAnoAnterior responde", rN.estado === 200 && "resumen" in rN.datos);
  const rD = await pedir(t, `reclamaciones/dcsReclamados?fecha=${AÑO}-10-01&idConductor=6`, "GET");
  comprobar("dcsReclamados responde", rD.estado === 200 && Number(rD.datos["importe"]) >= 0, `importe ${rD.datos["importe"]}`);
  const rDnd = await pedir(t, `reclamaciones/dndsReclamados?fecha=${AÑO}-10-01&idConductor=6`, "GET");
  comprobar("dndsReclamados responde", rDnd.estado === 200 && Number(rDnd.datos["importe"]) >= 0);

  if (v === null) {
    await pool.end();
    console.log(`\nResultado: ${fallos} fallo(s)`);
    process.exit(1);
  }

  // 5. PUT idempotente (guardar sin cambios debe conservar los datos).
  const congelar = (d: Record<string, unknown> | undefined): string =>
    d === undefined ? "" : JSON.stringify({
      t: d["servicioTrabajado"], v: d["servicioVirtual"], a: d["servicioAnual"],
      e: d["esFestivo"], r: d["refuerzos"], dnd: d["dndCobrado"], dc: d["dndsCobradosPorDescanso"],
    });
  const rPut = await pedir(t, `calendarios/${id}`, "PUT", v.calendario);
  comprobar("PUT sin cambios → 200", rPut.estado === 200, `estado ${rPut.estado}`);
  const v2 = await cargar(t, id);
  comprobar("El PUT conservó los días", v2 !== null &&
    (v2!.calendario["dias"] as unknown[]).length === 31);
  comprobar("Los servicios no cambiaron", congelar(v2?.dia) === congelar(v.dia));

  // 6. PUT con cambio remoto (nota + isRemoteUpdated) y restauración con el original.
  const cambiado = structuredClone(v.calendario) as Record<string, unknown>;
  const d15 = diaDe(cambiado, `${AÑO}-10-15`);
  d15["notas"] = "prueba E2E detalle";
  d15["isRemoteUpdated"] = true;
  const rPut2 = await pedir(t, `calendarios/${id}`, "PUT", cambiado);
  comprobar("PUT con cambio → 200", rPut2.estado === 200);
  const v3 = await cargar(t, id);
  const d15b = v3?.dia;
  comprobar("La nota se guardó", d15b !== undefined && d15b["notas"] === "prueba E2E detalle");
  comprobar("El marcado remoto se guardó", d15b !== undefined && d15b["isRemoteUpdated"] === true);
  const rPut3 = await pedir(t, `calendarios/${id}`, "PUT", structuredClone(v.calendario));
  const v4 = await cargar(t, id);
  comprobar("Restauración y limpieza", rPut3.estado === 200 && v4 !== null &&
    v4.dia["notas"] === null && v4.dia["isRemoteUpdated"] === false &&
    congelar(v4.dia) === congelar(v.dia));

  // 7. Validaciones: calendario inexistente.
  const r404 = await pedir(t, `calendarios/99999`, "PUT", v.calendario);
  comprobar("PUT calendario inexistente → 404", r404.estado === 404, `estado ${r404.estado}`);
  const r404g = await pedir(t, `calendarios/99999`, "GET");
  comprobar("GET calendario inexistente → 404", r404g.estado === 404);

  // 8. Sin sesión → 401.
  const rAnon = await fetch(`${SERVIDOR}/api/v1/calendarios/${id}`);
  comprobar("GET sin sesión → 401", rAnon.status === 401);

  // Estado final de la BD: el calendario debe quedar como estaba.
  const { rows: filasDespues } = await pool.query<{ n: string }>(
    `select count(*)::text n from "DiasCalendario" where "CalendarioId" = $1`, [id]);
  comprobar("Sin duplicados de días", Number(filasDespues[0]!.n) === 31, `${filasDespues[0]!.n} días`);
  const { rows: filasGraficos } = await pool.query<{ n: string }>(
    `select count(*)::text n from "Graficos"`);
  comprobar("Sin gráficos de prueba", Number(filasGraficos[0]!.n) === 0, `${filasGraficos[0]!.n} filas`);

  await pool.end();
  console.log(`\nResultado: ${fallos === 0 ? "todo correcto" : `${fallos} fallo(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
