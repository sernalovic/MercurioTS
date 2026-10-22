/**
 * Prueba E2E del módulo de gráficos (`/api/v1/graficos`, `itinerariosGraficos`
 * y `convenios`) contra la BD local de desarrollo: alta de un grupo, lectura
 * de grupos e entreFechas, cambios con itinerarios anidados, bajas individuales,
 * borrado del grupo y validaciones. Deja la BD como estaba (solo escritura
 * de filas que elimina al final por sí misma).
 *
 * Uso (PowerShell, en packages/db):
 *   node --experimental-transform-types --env-file ../../apps/web/.env.local scripts/probarGraficos.ts
 *
 * Requiere el dev server del web (`pnpm --filter @mercurio/web dev`) en 3000
 * y el usuario `prueba` (clave Mercurio-2026!) con esAdmin.
 */
import pg from "pg";

const SERVIDOR = "http://localhost:3000";
const FECHA = "2026-11-01";
const CENTRO = 1;

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

function graficoEjemplo(numero: number, ini: number, fin: number): Record<string, unknown> {
  return {
    centro: CENTRO,
    fecha: FECHA,
    numero,
    categoria: numero === 1 ? 0 : 1,
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
    cena: numero === 1 ? 0.75 : 0,
    plusCena: numero === 1 ? 80 : 0,
    itinerarios: numero === 1
      ? [{ inicio: ini, final: fin - 60, itinerario: "11", descripcion: "Alza-Peña", tiempoTotal: fin - 60 - ini, id: undefined, graficoId: undefined }]
      : [],
    id: undefined,
  };
}

type FilaG = Record<string, unknown>;
type GraficoJson = FilaG & { itinerarios: FilaG[] };

async function main(): Promise<void> {
  console.log("== Gráficos: E2E contra la BD local ==");
  const t = await token();
  const cuentaInicial = await pool.query(`SELECT COUNT(*)::int AS n FROM "Graficos"`);

  // 0 · Sin sesión: 401 en ruta nueva.
  const sinSesion = await pedir("", "graficos/grupos?centro=1", "GET");
  comprobar("grupos sin sesión → 401", sinSesion.estado === 401, String(sinSesion.datos.error));

  // 0b · OPTIONS con CORS.
  const op = await fetch(`${SERVIDOR}/api/v1/graficos/grupos?centro=1`, { method: "OPTIONS" });
  const acao = op.headers.get("Access-Control-Allow-Origin");
  comprobar("OPTIONS grupos → 204 con CORS", op.status === 204 && acao === "*", `status=${op.status} ACAO=${acao}`);

  // 1 · Convenios en formato de dominio.
  { const r = await pedir(t, "convenios", "GET");
    const cs = (r.datos.convenios ?? []) as FilaG[];
    comprobar("GET convenios → 200 con lista", r.estado === 200 && cs.length > 0, `${cs.length} convenios`);
    if (cs.length > 0) {
      const c = cs[0] as FilaG & { opcionesCentro?: unknown[] };
      comprobar("convenio tiene opcionesCentro y jornada en minutos", Array.isArray(c.opcionesCentro) && typeof c.jornadaMedia === "number");
    }
  }

  // 2 · Grupos inicial (BD limpia → vacío).
  { const r = await pedir(t, `graficos/grupos?centro=${CENTRO}`, "GET");
    comprobar(`GET grupos inicial → []`, r.estado === 200 && (r.datos.grupos as string[]).length === 0);
  }

  // 3 · Alta en lote (POST).
  { const r = await pedir(t, "graficos", "POST", [graficoEjemplo(1, 360, 840)]);
    comprobar("POST altas → ok 2", r.estado === 200 && r.datos.ok === true, String(r.datos.error ?? ""));
  }
  { const r = await pedir(t, "graficos", "POST", [graficoEjemplo(2, 900, 1110)]);
    comprobar("POST alta segundo → ok", r.estado === 200 && r.datos.ok === true);
  }
  { const bad = await pedir(t, "graficos", "POST", [{ ...graficoEjemplo(9, 0, 0), fecha: "no" }]);
    comprobar("POST con fecha no válida → 400", bad.estado === 400, String(bad.datos.error));
  }
  { const bad = await pedir(t, "graficos", "POST", [{ ...graficoEjemplo(9, "x" as unknown as number, 0) }]);
    comprobar("POST con hora no numérica → 400", bad.estado === 400, String(bad.datos.error));
  }

  // 4 · Grupos tras el alta.
  { const r = await pedir(t, `graficos/grupos?centro=${CENTRO}`, "GET");
    const gs = (r.datos.grupos ?? []) as string[];
    comprobar("GET grupos → [FECHA]", r.estado === 200 && gs.length === 1 && gs[0] === FECHA, JSON.stringify(gs));
  }

  // 5 · entreFechas: valores en minutos/céntimos e itinerarios anidados.
  let idG1 = 0; let idG2 = 0; let its = 0;
  let idItineraioNuevo = 0;
  { const r = await pedir(t, `graficos/entreFechas?desde=${FECHA}&hasta=${FECHA}&centro=${CENTRO}`, "GET");
    const gs = (r.datos.graficos ?? []) as GraficoJson[];
    comprobar("entreFechas → 2 gráficos ordenados por número",
      r.estado === 200 && gs.length === 2 && gs[0].numero === 1 && gs[1].numero === 2);
    idG1 = Number(gs[0]?.id ?? 0);
    idG2 = Number(gs[1]?.id ?? 0);
    its = gs[0]?.itinerarios.length ?? 0;
    const g1 = gs[0] as GraficoJson & { inicio?: number; plusCena?: number; cena?: number; tiempoTotal?: number };
    comprobar("gráfico 1: inicio 06:00 (360), trabajadas 480, plusCena 80 céntimos, cena 0.75",
      g1.inicio === 360 && g1.tiempoTotal === 480 && g1.plusCena === 80 && g1.cena === 0.75,
      `inicio=${g1.inicio} total=${g1.tiempoTotal} plusCena=${g1.plusCena} cena=${g1.cena}`);
    comprobar("gráfico 1: 1 itinerario con minutos", its === 1 &&
      Number((gs[0]?.itinerarios[0] as FilaG | undefined)?.inicio) === 360 &&
      Number((gs[0]?.itinerarios[0] as FilaG | undefined)?.tiempoTotal) === 420,
      `itinerarios=${its} inicio=${gs[0]?.itinerarios[0]?.inicio} total=${gs[0]?.itinerarios[0]?.tiempoTotal}`);
    const g2 = gs[1] as GraficoJson & { itinerarios: FilaG[] };
    comprobar("gráfico 2: sin itinerarios", g2.itinerarios.length === 0);
  }

  // 6 · Cambios (PUT) con itinerarios anidados: modificación + alta anidada.
  const g1Actual = ((await pedir(t, `graficos/entreFechas?desde=${FECHA}&hasta=${FECHA}&centro=${CENTRO}`, "GET")).datos.graficos ?? []) as GraficoJson[];
  const g1Base = JSON.parse(JSON.stringify(g1Actual[0])) as GraficoJson & { id: number };
  g1Base.final = 870; // 14:30
  g1Base.turno = 2;   // tarde
  g1Base.itinerarios[0].inicio = 365; // cambia el inexistente → existente
  g1Base.itinerarios.push({
    id: undefined, graficoId: undefined, inicio: 780, final: 810,
    itinerario: "12", descripcion: "vuelta", tiempoTotal: 30,
  });
  { const r = await pedir(t, "graficos", "PUT", [g1Base]);
    comprobar("PUT cambios → ok", r.estado === 200 && r.datos.ok === true, String(r.datos.error ?? ""));
  }
  { const gs = ((await pedir(t, `graficos/entreFechas?desde=${FECHA}&hasta=${FECHA}&centro=${CENTRO}`, "GET")).datos.graficos ?? []) as GraficoJson[];
    const g1 = gs[0] as GraficoJson & { final?: number; turno?: number; cena?: number };
    comprobar("PUT persistió: final 14:30 (870) y turno 2",
      g1.final === 870 && g1.turno === 2, `final=${g1.final} turno=${g1.turno}`);
    comprobar("PUT itinerarios: existente cambiado + nuevo insertado",
      g1.itinerarios.length === 2 && Number(g1.itinerarios[0].inicio) === 365 &&
      g1.itinerarios.every((i) => Number(i.id) > 0),
      `n=${g1.itinerarios.length} inicio0=${g1.itinerarios[0]?.inicio}`);
    idItineraioNuevo = Number(g1.itinerarios[1].id ?? 0);
  }

  // 7 · Baja única entre dos.
  { const r = await pedir(t, "graficos", "DELETE", [idG2]);
    comprobar("DELETE lote [id2] → ok", r.estado === 200 && r.datos.ok === true, String(r.datos.error ?? ""));
  }
  { const gs = ((await pedir(t, `graficos/entreFechas?desde=${FECHA}&hasta=${FECHA}&centro=${CENTRO}`, "GET")).datos.graficos ?? []) as GraficoJson[];
    comprobar("solo queda el gráfico 1 con sus 2 itinerarios", gs.length === 1 && gs[0].itinerarios.length === 2);
  }

  // 8 · Baja de itinerario (ruta propia, con el Id del itinerario insertado en el PUT).
  { const r = await pedir(t, "itinerariosGraficos", "DELETE", [idItineraioNuevo]);
    comprobar("DELETE itinerariosGraficos → ok", r.estado === 200 && r.datos.ok === true, String(r.datos.error ?? ""));
  }
  { const gs = ((await pedir(t, `graficos/entreFechas?desde=${FECHA}&hasta=${FECHA}&centro=${CENTRO}`, "GET")).datos.graficos ?? []) as GraficoJson[];
    comprobar("itinerario borrado en cascada leída", gs.length === 1 && gs[0].itinerarios.length === 1);
  }

  // 9 · Borrar grupo por fecha.
  { const r = await pedir(t, `graficos/porFecha?fecha=${FECHA}&centro=${CENTRO}`, "DELETE");
    comprobar("DELETE porFecha → ok", r.estado === 200 && r.datos.ok === true, String(r.datos.error ?? ""));
  }
  { const gs = (await pedir(t, `graficos/grupos?centro=${CENTRO}`, "GET")).datos.grupos as string[];
    comprobar("grupos queda vacío", gs.length === 0);
  }

  // 10 · La BD queda como estaba.
  const cuentaFinal = await pool.query(`SELECT COUNT(*)::int AS n FROM "Graficos"`);
  comprobar("tabla Graficos como al principio",
    Number(cuentaInicial.rows[0].n) === Number(cuentaFinal.rows[0].n),
    `antes=${cuentaInicial.rows[0].n} después=${cuentaFinal.rows[0].n}`);

  await pool.end();
  if (fallos > 0) {
    console.log(`\n== ${fallos} comprobaciones fallidas ==`);
    process.exitCode = 1;
  } else {
    console.log("\n== Todo correcto ==");
  }
}

await main();
