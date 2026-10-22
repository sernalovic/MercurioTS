/**
 * Prueba E2E de Convenios y Líneas (fase M7): rutas nuevas
 * (`convenios` POST, `convenios/:id` PUT/DELETE, `convenios/festivos/lista`
 * DELETE, `lineas` GET/POST, `lineas/:id` PUT/DELETE, `itinerarios/lista`
 * y `paradas/lista` DELETE) con el round-trip completo de agregados.
 *
 * En la BD de desarrollo hay convenios REALES (2021–2026) y NO se tocan:
 * el test crea el convenio del año 2199 (copia normalizada del 2026 en el
 * cliente, como hace la pantalla), lo edita, prueba festivos, tablas y
 * opciones, y crea una línea "PRUEBA-E2E" con itinerarios y paradas. Todo
 * lo creado por el test se elimina al final.
 *
 * Uso (PowerShell, en packages/db):
 *   node --experimental-transform-types --env-file ../../apps/web/.env.local scripts/probarConveniosLineas.ts
 *
 * Requiere el dev server del web (`pnpm --filter @mercurio/web dev`) en 3000
 * y el usuario `prueba` (clave Mercurio-2026!) con esAdmin.
 */
import pg from "pg";

const SERVIDOR = "http://localhost:3000";
const AÑO = 2099;

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

type ConvenioJson = Record<string, any> & { opcionesCentro?: any[]; tablasSalariales?: any[] };
type LineaJson = Record<string, any> & { itinerarios?: any[] };

async function main(): Promise<void> {
  console.log("— Convenios y Líneas (M7) —");
  const t = await token();
  let idCreado: number | null = null;
  const idsLinea: number[] = [];

  try {
    // ---- 1 · GET convenios (ya existente) ----
    let r = await pedir(t, "convenios", "GET");
    const existentes = (r.datos.convenios ?? []) as ConvenioJson[];
    comprobar("GET convenios → 200 con lista", r.estado === 200 && existentes.length > 0, `${existentes.length} convenios`);
    const origen = existentes[existentes.length - 1] as ConvenioJson & { id: number };

    // ---- 2 · GET lineas ----
    r = await pedir(t, "lineas", "GET");
    const lineas0 = (r.datos.lineas ?? []) as LineaJson[];
    comprobar("GET lineas → 200", r.estado === 200, `${lineas0.length} líneas`);

    // ---- 3 · Copia del 2026 → convenio test ----
    // (como Copiar/Añadir del ViewModel: ids a 0, sin festivos, opciones
    //  y tablas completas; importes ya en céntimos como viajan al servidor)
    const copia: ConvenioJson = JSON.parse(JSON.stringify(origen));
    delete copia.id;
    copia.año = AÑO;
    copia.tablasSalariales = (copia.tablasSalariales ?? []).map((tb: any) => ({ ...tb, id: 0 }));
    copia.opcionesCentro = (copia.opcionesCentro ?? []).map((o: any) => ({ ...o, id: 0, festivos: [] }));
    r = await pedir(t, "convenios", "POST", copia);
    idCreado = Number(r.datos.id) || null;
    comprobar("POST convenios → 200 con id", r.estado === 200 && idCreado !== null, `id=${idCreado}`);

    // ---- 4 · GET convenios: el nuevo está con hijos ----
    r = await pedir(t, "convenios", "GET");
    let creado = ((r.datos.convenios ?? []) as ConvenioJson[]).find((c) => c.año === AÑO) as (ConvenioJson & { id: number }) | undefined;
    comprobar("convenio test creado con tablas y opciones",
      creado !== undefined && (creado.tablasSalariales?.length ?? 0) === (copia.tablasSalariales?.length ?? 0)
      && (creado.opcionesCentro?.length ?? 0) === (copia.opcionesCentro?.length ?? 0),
      `tablas=${creado?.tablasSalariales?.length} opciones=${creado?.opcionesCentro?.length}`);
    if (creado === undefined) throw new Error("sin convenio de prueba");

    // ---- 5 · PUT: cambia importes, edita tabla y añade festivo ----
    creado.importeDietas = 1234;
    creado.opcionesCentro[0].limpiezasMes = 9;
    creado.opcionesCentro[0].festivos.push({ id: 0, fecha: `${AÑO}-06-13` });
    creado.tablasSalariales[0].sueldoBaseDiario = 4567;
    r = await pedir(t, `convenios/${creado.id}`, "PUT", creado);
    comprobar("PUT convenios/:id → 204", r.estado === 204);
    r = await pedir(t, "convenios", "GET");
    creado = ((r.datos.convenios ?? []) as ConvenioJson[]).find((c) => c.año === AÑO) as ConvenioJson & { id: number };
    comprobar("round-trip céntimos: importeDietas=1234",
      creado.importeDietas === 1234, `valor=${creado.importeDietas}`);
    comprobar("tabla salarial editada persiste (4567)",
      creado.tablasSalariales[0].sueldoBaseDiario === 4567, `valor=${creado.tablasSalariales[0].sueldoBaseDiario}`);
    comprobar("opción editada persiste (limpiezas 9)",
      creado.opcionesCentro[0].limpiezasMes === 9, `valor=${creado.opcionesCentro[0].limpiezasMes}`);

    // ---- 6 · Festivos listados + borrar uno con festivos/lista ----
    const festivos = creado.opcionesCentro[0].festivos as Array<Record<string, any>>;
    const f13 = festivos.find((f) => String(f.fecha).startsWith(`${AÑO}-06-13`));
    comprobar("festivo añadido en el PUT", f13 !== undefined && String(f13.fecha).startsWith(`${AÑO}-06-13`));
    if (f13 !== undefined) {
      r = await pedir(t, "convenios/festivos/lista", "DELETE", [{ id: f13.id }]);
      comprobar("DELETE festivos/lista → 204", r.estado === 204);
      r = await pedir(t, "convenios", "GET");
      creado = ((r.datos.convenios ?? []) as ConvenioJson[]).find((c) => c.año === AÑO) as ConvenioJson & { id: number };
      const quedan = (creado.opcionesCentro[0].festivos as any[]).filter((f) => String(f.fecha).startsWith(`${AÑO}-06-13`));
      comprobar("el festivo borrado ya no está", quedan.length === 0);
    }

    // ---- 7 · Propagar festivos = copia al resto de opciones (port VM) ----
    const conFestivos = creado.opcionesCentro[0] as any;
    conFestivos.festivos = [{ id: 0, fecha: `${AÑO}-12-08` }];
    for (const o of creado.opcionesCentro.slice(1) as any[]) o.festivos = [{ id: 0, fecha: `${AÑO}-12-08` }];
    r = await pedir(t, `convenios/${creado.id}`, "PUT", creado);
    r = await pedir(t, "convenios", "GET");
    creado = ((r.datos.convenios ?? []) as ConvenioJson[]).find((c) => c.año === AÑO) as ConvenioJson & { id: number };
    const todosPropagados = (creado.opcionesCentro as any[]).every((o) =>
      (o.festivos as any[]).some((f) => String(f.fecha).startsWith(`${AÑO}-12-08`)));
    comprobar(("propagar festivos: todas las opciones tienen el festivo"), todosPropagados);

    // ---- 8 · POST lineas + PUT con itinerarios y paradas ----
    const linea: LineaJson = { id: 0, nombre: "PRUEBA-E2E L1", descripcion: "linea del test", itinerarios: [] };
    r = await pedir(t, "lineas", "POST", linea);
    const idLinea = Number(r.datos.id) || 0;
    if (r.estado === 200 && idLinea > 0) idsLinea.push(idLinea);
    comprobar("POST lineas → 200 con id", r.estado === 200 && idLinea > 0, `id=${idLinea}`);
    const lineaPut: LineaJson = {
      id: idLinea, nombre: "PRUEBA-E2E L1", descripcion: "editada",
      itinerarios: [{
        id: 0, lineaId: idLinea, nombre: "I-A", descripcion: "ida", tiempoReal: 35, tiempoPago: 30,
        paradas: [
          { id: 0, itinerarioId: 0, orden: 1, descripcion: "Cochera", tiempo: 5 },
          { id: 0, itinerarioId: 0, orden: 2, descripcion: "Plaza", tiempo: 30 },
        ],
      }],
    };
    r = await pedir(t, `lineas/${idLinea}`, "PUT", lineaPut);
    comprobar("PUT lineas/:id → 204", r.estado === 204, "");
    r = await pedir(t, "lineas", "GET");
    const leida = ((r.datos.lineas ?? []) as LineaJson[]).find((l) => l.id === idLinea);
    const it = leida?.itinerarios?.[0];
    comprobar("round-trip línea con itinerario y paradas",
      leida !== undefined && it?.tiempoReal === 35 && it?.paradas?.length === 2 &&
      it.paradas[0].tiempo === 5 && it.paradas[1].tiempo === 30,
      `paradas=${it?.paradas?.length} t=${it?.paradas?.map((p: any) => p.tiempo)?.join(",")}`);

    // ---- 9 · Bajas: parada → paradas/lista; itinerario → itinerarios/lista ----
    if (it !== undefined) {
      r = await pedir(t, "paradas/lista", "DELETE", [{ id: it.paradas[0].id }]);
      comprobar("DELETE paradas/lista → 204", r.estado === 204);
      r = await pedir(t, "itinerarios/lista", "DELETE", [{ id: it.id }]);
      comprobar("DELETE itinerarios/lista → 204", r.estado === 204);
      r = await pedir(t, "lineas", "GET");
      const l2 = ((r.datos.lineas ?? []) as LineaJson[]).find((l) => l.id === idLinea);
      comprobar("el itinerario borrado ya no está", l2 !== undefined && (l2.itinerarios?.length ?? 0) === 0);
    }

    // ---- 10 · Authorization: sin token → 401; no admin no hay (solo prueba) ----
    r = await pedir("", "convenios", "POST", copia);
    comprobar("POST convenios sin token → 401", r.estado === 401);
    r = await pedir("", "lineas", "GET");
    comprobar("GET lineas sin token → 401", r.estado === 401);
  } finally {
    // ---- limpieza: borrar todo lo del test ----
    if (idCreado !== null) await pedir(t, `convenios/${idCreado}`, "DELETE");
    await pool.query("DELETE FROM \"Convenios\" WHERE \"Año\" = $1", [AÑO]);
    for (const id of idsLinea) await pedir(t, `lineas/${id}`, "DELETE");
    await pool.query("DELETE FROM \"Lineas\" WHERE \"Nombre\" LIKE 'PRUEBA-E2E%'");
    await pool.end();
  }

  console.log(fallos === 0 ? "\nTodo correcto ✔" : `\nFALLOS: ${fallos}`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

await main();
