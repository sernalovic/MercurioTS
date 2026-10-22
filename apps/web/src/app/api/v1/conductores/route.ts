/**
 * `GET/POST/PUT/DELETE /api/v1/conductores` — rejilla de conductores del
 * escritorio (port de `ConductoresController`). Solo administradores.
 *
 * - GET    `?centro=N` (0 = Todos): listado ordenado por matrícula, con
 *          sus regulaciones.
 * - POST   lista de altas (Id 0; admite regulaciones anidadas nuevas).
 * - PUT    lista de cambios (con Id; regula las regulaciones por Id).
 * - DELETE cuerpo con lista de Id: bajas — la BD borra en cascada
 *          calendarios, regulaciones, reclamaciones, etc. (igual que el
 *          original avisaba al confirmar).
 *
 * La matrícula es única (índice de la BD, como el original).
 */
import { and, eq, inArray, ne } from "drizzle-orm";
import { conductores, regulaciones, type Db } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

interface EntradaRegulacion {
  id?: number;
  tipo: number;
  fecha: string;
  horas: string;
  dcs: number | string;
  dnds: number | string;
  motivo: string | null;
}

interface EntradaConductor {
  id: number;
  centro: number;
  categoria: number;
  situacion: number;
  matricula: number;
  isUsuario: boolean;
  fechaAntiguedad: string;
  porcentajeIrpf: number | string;
  numeroAfiliado: number;
  isReduccionJornada: boolean;
  porcentajeJornada: number;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
  acumuladasIniciales: string;
  dcsIniciales: number | string;
  dndsIniciales: number | string;
  plusDistancia: number | string;
  notas: string | null;
  regulaciones?: EntradaRegulacion[];
}

/** Entero validado; lanza con mensaje en español si no es un número. */
function entero(valor: unknown, campo: string): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) {
    throw new Error(`El campo «${campo}» debe ser un número.`);
  }
  return Math.trunc(n);
}

/** Decimal validado (los numéricos van como texto en la BD). */
function decimal(valor: unknown, campo: string): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) {
    throw new Error(`El campo «${campo}» debe ser un número.`);
  }
  return String(n);
}

function fecha(valor: unknown, campo: string): string {
  const texto = String(valor ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new Error(`El campo «${campo}» debe ser una fecha.`);
  }
  return texto;
}

/** Normaliza un conductor de entrada a los valores de la tabla. */
function valoresConductor(c: EntradaConductor, sesiónId: number, ahora: string) {
  if (!String(c.nombre ?? "").trim() || !String(c.apellidos ?? "").trim()) {
    throw new Error("Indica el nombre y los apellidos del conductor.");
  }
  const texto = (v: string | null | undefined): string | null => {
    const t = String(v ?? "").trim();
    return t.length > 0 ? t : null;
  };
  return {
    centro: entero(c.centro, "centro"),
    categoria: entero(c.categoria, "categoría"),
    situacion: entero(c.situacion, "situación"),
    matricula: entero(c.matricula, "matrícula"),
    isUsuario: c.isUsuario === true,
    fechaAntiguedad: fecha(c.fechaAntiguedad, "fecha de antigüedad"),
    porcentajeIrpf: decimal(c.porcentajeIrpf, "% IRPF"),
    numeroAfiliado: entero(c.numeroAfiliado, "nº de afiliado"),
    isReduccionJornada: c.isReduccionJornada === true,
    porcentajeJornada: entero(c.porcentajeJornada, "% de jornada"),
    nombre: String(c.nombre).trim(),
    apellidos: String(c.apellidos).trim(),
    telefono: texto(c.telefono),
    email: texto(c.email),
    acumuladasIniciales: `${String(c.acumuladasIniciales ?? "00:00").trim().slice(0, 8)}:00`,
    dcsIniciales: decimal(c.dcsIniciales, "DCs iniciales"),
    dndsIniciales: decimal(c.dndsIniciales, "DNDs iniciales"),
    plusDistancia: decimal(c.plusDistancia, "plus de distancia"),
    notas: texto(c.notas),
    modifiedDate: ahora,
    modifiedBy: sesiónId,
  };
}

/** Normaliza una regulación anidada a los valores de la tabla. */
function valoresRegulacion(r: EntradaRegulacion, conductorId: number, sesiónId: number, ahora: string) {
  return {
    conductorId,
    tipo: entero(r.tipo, "tipo de regulación"),
    fecha: fecha(r.fecha, "fecha de la regulación"),
    horas: `${String(r.horas ?? "00:00").trim().slice(0, 8)}:00`,
    dcs: decimal(r.dcs, "DCs"),
    dnds: decimal(r.dnds, "DNDs"),
    motivo: (String(r.motivo ?? "").trim() || null) as string | null,
    modifiedDate: ahora,
    modifiedBy: sesiónId,
  };
}

/** Transacción de drizzle (el mismo parámetro que recibe `db.transaction`). */
type Transaccion = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Lanza si la matrícula ya la usa otro conductor distinto. */
async function comprobarMatricula(
  tx: Transaccion,
  matricula: number,
  exceptoId: number,
): Promise<void> {
  const dupe = await tx
    .select({ id: conductores.id })
    .from(conductores)
    .where(exceptoId === 0 ? eq(conductores.matricula, matricula) : and(eq(conductores.matricula, matricula), ne(conductores.id, exceptoId)));
  if (dupe.length > 0) {
    throw new Error(`Ya existe un conductor con la matrícula ${matricula}.`);
  }
}

/** Comunes: sesión válida y cuerpo cargado. */
async function preparar(
  request: Request,
): Promise<{ entrada: EntradaConductor[]; sesiónId: number; ahora: string } | Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores gestionan conductores." }, { status: 403 });
  }
  let entrada: EntradaConductor[];
  try {
    entrada = (await request.json()) as EntradaConductor[];
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  if (!Array.isArray(entrada)) {
    return Response.json({ error: "Se esperaba una lista de conductores." }, { status: 400 });
  }
  return { entrada, sesiónId: sesion.id, ahora: new Date().toISOString().slice(0, 19).replace("T", " ") };
}

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores gestionan conductores." }, { status: 403 });
  }

  const centro = new URL(request.url).searchParams.get("centro");
  const db = getDb();
  const filas = await db
    .select({
      id: conductores.id,
      centro: conductores.centro,
      categoria: conductores.categoria,
      situacion: conductores.situacion,
      matricula: conductores.matricula,
      isUsuario: conductores.isUsuario,
      fechaAntiguedad: conductores.fechaAntiguedad,
      porcentajeIrpf: conductores.porcentajeIrpf,
      numeroAfiliado: conductores.numeroAfiliado,
      isReduccionJornada: conductores.isReduccionJornada,
      porcentajeJornada: conductores.porcentajeJornada,
      nombre: conductores.nombre,
      apellidos: conductores.apellidos,
      telefono: conductores.telefono,
      email: conductores.email,
      acumuladasIniciales: conductores.acumuladasIniciales,
      dcsIniciales: conductores.dcsIniciales,
      dndsIniciales: conductores.dndsIniciales,
      plusDistancia: conductores.plusDistancia,
      notas: conductores.notas,
    })
    .from(conductores)
    .where(centro !== null && centro !== "" && centro !== "0" ? eq(conductores.centro, Number(centro)) : undefined)
    .orderBy(conductores.matricula);

  return Response.json({ conductores: filas });
}

/** Guarda las altas: conductor nuevo (+ regulaciones nuevas anidadas). */
export async function POST(request: Request): Promise<Response> {
  const preparado = await preparar(request);
  if (preparado instanceof Response) return preparado;
  const { entrada, sesiónId, ahora } = preparado;
  const db = getDb();
  const ids: number[] = [];
  try {
    await db.transaction(async (tx) => {
      for (const c of entrada) {
        const valores = valoresConductor(c, sesiónId, ahora);
        await comprobarMatricula(tx, valores.matricula, 0);
        const [creado] = await tx.insert(conductores).values(valores).returning({ id: conductores.id });
        ids.push(creado.id);
        if (c.regulaciones?.length) {
          await tx.insert(regulaciones).values(
            c.regulaciones.filter((r) => !r.id).map((r) => valoresRegulacion(r, creado.id, sesiónId, ahora)),
          );
        }
      }
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  return Response.json({ ids });
}

/** Guarda los cambios de conductores existentes (+ upsert de regulaciones). */
export async function PUT(request: Request): Promise<Response> {
  const preparado = await preparar(request);
  if (preparado instanceof Response) return preparado;
  const { entrada, sesiónId, ahora } = preparado;
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      for (const c of entrada) {
        const idConductor = entero(c.id, "id");
        if (idConductor <= 0) {
          throw new Error("Los conductores modificados deben existir (Id > 0).");
        }
        const valores = valoresConductor(c, sesiónId, ahora);
        await comprobarMatricula(tx, valores.matricula, idConductor);
        await tx.update(conductores).set(valores).where(eq(conductores.id, idConductor));
        if (c.regulaciones?.length) {
          for (const r of c.regulaciones.filter((x) => !x.id)) {
            await tx.insert(regulaciones).values(valoresRegulacion(r, Number(c.id), sesiónId, ahora));
          }
          for (const r of c.regulaciones.filter((x) => x.id)) {
            await tx
              .update(regulaciones)
              .set(valoresRegulacion(r, Number(c.id), sesiónId, ahora))
              .where(and(eq(regulaciones.id, Number(r.id)), eq(regulaciones.conductorId, Number(c.id))));
          }
        }
      }
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  return Response.json({ ok: true });
}

/** Guarda las bajas: la BD borra en cascada los datos asociados. */
export async function DELETE(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores gestionan conductores." }, { status: 403 });
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
  const db = getDb();
  await db.delete(conductores).where(inArray(conductores.id, ids.map(Number)));
  return Response.json({ ok: true });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
