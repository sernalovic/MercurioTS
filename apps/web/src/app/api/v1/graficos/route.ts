/**
 * Altas, cambios y bajas de gráficos del escritorio (port de
 * `GuardarListaAsync` sobre `api/v1/graficos`):
 * - `POST` — lista de gráficos nuevos (Id 0), con itinerarios anidados.
 * - `PUT`  — lista de cambios (por Id); los itinerarios anidados se
 *   actualizan por Id o se insertan si no tienen Id.
 * - `DELETE` con cuerpo — lista de Ids a dar de baja (los itinerarios se
 *   borran en cascada).
 *
 * El formato de entrada es el del dominio (horas en minutos, dinero en
 * céntimos); las fechas van como "AAAA-MM-DD" y las horas nulas como null.
 */
import { eq, inArray } from "drizzle-orm";
import {
  graficos, itinerariosGraficos, aIntervalo, aNumerico, aTextoNumerico,
} from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import type { CentroTrabajo } from "@mercurio/domain";

interface EntradaItinerario {
  id?: number;
  graficoId?: number;
  inicio: number | null;
  final: number | null;
  itinerario: string | null;
  descripcion: string | null;
  tiempoTotal: number;
}

interface EntradaGrafico {
  id?: number;
  centro: number;
  fecha: string;
  numero: number;
  categoria: number;
  tipoDia: number;
  turno: number;
  noCalcular?: boolean;
  tienePlusPaqueteria?: boolean;
  tieneErrorTiempoPartido?: boolean;
  inicio: number | null;
  final: number | null;
  inicioPartido: number | null;
  finalPartido: number | null;
  valoracion: number;
  tiempoTotal: number;
  tiempoPartido: number;
  trabajadas: number;
  trabajadasConvenio: number;
  tiempoVacio: number;
  acumuladas: number;
  nocturnas: number;
  desayuno: number;
  comida: number;
  cena: number;
  plusCena: number;
  itinerarios?: EntradaItinerario[];
}

/** Entero validado (los minutos y las cantidades unitarias van en minutos/unidades enteras). */
function entero(valor: unknown, campo: string): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) {
    throw new Error(`El campo «${campo}» debe ser un número.`);
  }
  return Math.round(n);
}

/** Duración entera no nula: 0 por defecto (las columnas de duración no admiten nulos). */
function duracion(valor: unknown, campo: string): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  return entero(valor, campo);
}

/** Cantidad decimal no nula: las dietas (0.75) no son minutos. */
function cantidad(valor: unknown, campo: string): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`El campo «${campo}» debe ser un número.`);
  }
  return n;
}

/** Minutos nulos: null o "" significan sin dato (colunas de intervalo nulas). */
function minutosNulos(valor: unknown, campo: string): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  return aIntervalo(entero(valor, campo));
}

function texto(valor: unknown): string | null {
  const t = String(valor ?? "").trim();
  return t.length > 0 ? t : null;
}

function valoresGrafico(g: EntradaGrafico, sesionId: number, ahora: string) {
  const fecha = String(g.fecha ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error("Indica la fecha de validez del gráfico.");
  }
  return {
    centro: entero(g.centro, "centro") as CentroTrabajo,
    fecha: `${fecha} 00:00:00`,
    numero: entero(g.numero, "número de gráfico"),
    categoria: entero(g.categoria, "categoría"),
    tipoDia: entero(g.tipoDia, "tipo de día"),
    turno: entero(g.turno, "turno"),
    noCalcular: g.noCalcular === true,
    tienePlusPaqueteria: g.tienePlusPaqueteria === true,
    tieneErrorTiempoPartido: g.tieneErrorTiempoPartido === true,
    inicio: minutosNulos(g.inicio, "inicio"),
    final: minutosNulos(g.final, "final"),
    inicioPartido: minutosNulos(g.inicioPartido, "inicio partido"),
    finalPartido: minutosNulos(g.finalPartido, "final partido"),
    valoracion: aIntervalo(duracion(g.valoracion, "valoración")),
    tiempoTotal: aIntervalo(duracion(g.tiempoTotal, "tiempo total")),
    tiempoPartido: aIntervalo(duracion(g.tiempoPartido, "tiempo partido")),
    trabajadas: aIntervalo(duracion(g.trabajadas, "trabajadas")),
    trabajadasConvenio: aIntervalo(duracion(g.trabajadasConvenio, "trabajadas de convenio")),
    tiempoVacio: aIntervalo(duracion(g.tiempoVacio, "tiempo vacío")),
    acumuladas: aIntervalo(duracion(g.acumuladas, "acumuladas")),
    nocturnas: aIntervalo(duracion(g.nocturnas, "nocturnas")),
    desayuno: aTextoNumerico(cantidad(g.desayuno, "desayuno")),
    comida: aTextoNumerico(cantidad(g.comida, "comida")),
    cena: aTextoNumerico(cantidad(g.cena, "cena")),
    plusCena: aNumerico(duracion(g.plusCena, "plus de cena")),
    modifiedDate: ahora,
    modifiedBy: sesionId,
  };
}

function valoresItinerario(i: EntradaItinerario, graficoId: number, sesionId: number, ahora: string) {
  return {
    graficoId,
    inicio: minutosNulos(i.inicio, "inicio del itinerario"),
    final: minutosNulos(i.final, "final del itinerario"),
    itinerario: texto(i.itinerario),
    descripcion: texto(i.descripcion),
    tiempoTotal: aIntervalo(duracion(i.tiempoTotal, "duración del itinerario")),
    modifiedDate: ahora,
    modifiedBy: sesionId,
  };
}

type Preparado = { entrada: EntradaGrafico[]; sesionId: number; ahora: string };

async function pedirLista(request: Request): Promise<Preparado | Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden guardar gráficos." }, { status: 403 });
  }
  let entrada: EntradaGrafico[];
  try {
    entrada = (await request.json()) as EntradaGrafico[];
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  if (!Array.isArray(entrada)) {
    return Response.json({ error: "Se esperaba una lista de gráficos." }, { status: 400 });
  }
  if (entrada.length === 0) {
    return Response.json({ ok: true });
  }
  return { entrada, sesionId: sesion.id, ahora: new Date().toISOString().slice(0, 19).replace("T", " ") };
}

/** `POST` — altas en lote. */
export async function POST(request: Request): Promise<Response> {
  const preparado = await pedirLista(request);
  if (preparado instanceof Response) return preparado;
  const { entrada, sesionId, ahora } = preparado;
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      for (const g of entrada) {
        const [creado] = await tx
          .insert(graficos)
          .values(valoresGrafico(g, sesionId, ahora))
          .returning({ id: graficos.id });
        if (g.itinerarios !== undefined && g.itinerarios.length > 0) {
          await tx.insert(itinerariosGraficos).values(
            g.itinerarios.map((i) => valoresItinerario(i, creado.id, sesionId, ahora)),
          );
        }
      }
    });
    return Response.json({ ok: true, total: entrada.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** `PUT` — cambios por Id, con upsert de itinerarios anidados. */
export async function PUT(request: Request): Promise<Response> {
  const preparado = await pedirLista(request);
  if (preparado instanceof Response) return preparado;
  const { entrada, sesionId, ahora } = preparado;
  const db = getDb();
  const sinId = entrada.filter((g) => !Number.isInteger(Number(g.id)) || Number(g.id) <= 0);
  if (sinId.length > 0) {
    return Response.json({ error: "Los cambios requieren el Id del gráfico." }, { status: 400 });
  }
  try {
    await db.transaction(async (tx) => {
      for (const g of entrada) {
        const id = Number(g.id);
        await tx.update(graficos).set(valoresGrafico(g, sesionId, ahora)).where(eq(graficos.id, id));
        const its = g.itinerarios ?? [];
        for (const i of its) {
          const idIt = Number(i.id ?? 0);
          if (Number.isInteger(idIt) && idIt > 0) {
            await tx
              .update(itinerariosGraficos)
              .set(valoresItinerario(i, id, sesionId, ahora))
              .where(eq(itinerariosGraficos.id, idIt));
          } else {
            await tx.insert(itinerariosGraficos).values(valoresItinerario(i, id, sesionId, ahora));
          }
        }
      }
    });
    return Response.json({ ok: true, total: entrada.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** `DELETE` con cuerpo de Ids — bajas en lote (cascada de itinerarios). */
export async function DELETE(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden borrar gráficos." }, { status: 403 });
  }
  let ids: number[];
  try {
    ids = (await request.json()) as number[];
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "Se esperaba una lista de Ids." }, { status: 400 });
  }
  const validos = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (validos.length === 0) {
    return Response.json({ error: "Ningún Id de gráfico válido." }, { status: 400 });
  }
  await getDb().delete(graficos).where(inArray(graficos.id, validos));
  return Response.json({ ok: true, total: validos.length });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
