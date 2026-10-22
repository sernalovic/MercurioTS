/**
 * Repositorio de reclamaciones y nóminas del ESCRITORIO (port de los
 * `ReclamacionesController`/`ConceptosReclamadosController`/`NominasController`
 * + `ServicioCalendarios.GenerarNominaAsync` del original). El portal Orión 2
 * usa su propia capa (`lib/reclamaciones.ts`); el escritorio guarda
 * agregados completos desde el cliente y genera nóminas en el servidor con
 * `CalculosNomina` del dominio, igual que el original.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  aIntervalo, aNumerico, aTextoNumerico,
  calendarios, conceptosNomina, conceptosReclamados, conductores, convenios, diasCalendario,
  festivos, nominas, opcionesCentro, regulaciones, reclamaciones, resumenes, tablasSalariales,
  conceptosAFilas, conceptosNominaAFilas, conductorDesdeFila, convenioDesdeFilas,
  calendarioDesdeFila, nominaAFila, nominaDesdeFilas, reclamacionDesdeFilas, resumenDesdeFila,
  type Db,
} from "@mercurio/db";
import {
  TipoNomina, generarNomina as generarNominaDominio,
  type Nomina as NominaDominio, type Reclamacion as ReclamacionDominio,
} from "@mercurio/domain";

// ---- Reclamaciones (agregado con conceptos) ----

/** "AAAA-MM-01 00:00:00" — la Fecha de la reclamación siempre es el primer día del mes (`Preparar`). */
function primeroDeMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01 00:00:00`;
}

/** "AAAA-MM-DD" del dominio → "AAAA-MM-DD 00:00:00" de la BD. */
function fechaBD(fecha: string): string {
  return `${fecha.slice(0, 10)} 00:00:00`;
}

/** Columnas de la reclamación a guardar (sin auditoría). */
function columnasReclamacion(
  r: ReclamacionDominio,
): Omit<typeof reclamaciones.$inferInsert, "id" | "modifiedDate" | "modifiedBy"> {
  return {
    conductorId: r.conductorId,
    fecha: fechaBD(r.fecha),
    fechaEfecto: fechaBD(r.fechaEfecto),
    codigo: r.codigo,
    notas: r.notas,
    notaInterna: r.notaInterna,
    cerrada: r.cerrada,
  };
}

/** Filtra y normaliza la reclamación de entrada (admite conceptos con fecha ""). */
function validarReclamacion(entrada: unknown, conductorId: number): ReclamacionDominio {
  const r = entrada as ReclamacionDominio;
  if (!Number.isInteger(conductorId) || conductorId <= 0) {
    throw new Error("Indica el conductor de la reclamación.");
  }
  const fecha = String(r.fecha ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error("La fecha de la reclamación debe ser un mes (AAAA-MM-DD).");
  }
  return {
    ...r,
    conductorId,
    fecha,
    fechaEfecto: String(r.fechaEfecto ?? "").slice(0, 10),
    conceptosReclamados: r.conceptosReclamados.map((c) => ({
      ...c,
      tipo: c.tipo,
      fecha: String(c.fecha ?? "").slice(0, 10),
    })),
  };
}

/** Carga la reclamación `id` con sus conceptos como objeto del dominio. */
export async function cargarReclamacion(db: Db, id: number): Promise<ReclamacionDominio | null> {
  const filas = await db.select().from(reclamaciones).where(eq(reclamaciones.id, id)).limit(1);
  if (filas.length === 0) return null;
  const conceptos = await db
    .select()
    .from(conceptosReclamados)
    .where(eq(conceptosReclamados.reclamacionId, id))
    .orderBy(asc(conceptosReclamados.fecha), asc(conceptosReclamados.id));
  return reclamacionDesdeFilas(filas[0], conceptos);
}

/** `GET api/v1/reclamaciones?idConductor=N` — todas las del conductor, más reciente primero. */
export async function cargarReclamaciones(
  db: Db,
  idConductor: number,
): Promise<ReclamacionDominio[]> {
  const filas = await db
    .select()
    .from(reclamaciones)
    .where(eq(reclamaciones.conductorId, idConductor))
    .orderBy(desc(reclamaciones.fecha));
  if (filas.length === 0) return [];
  const conceptos = await db
    .select()
    .from(conceptosReclamados)
    .where(inArray(conceptosReclamados.reclamacionId, filas.map((f) => f.id)))
    .orderBy(asc(conceptosReclamados.fecha), asc(conceptosReclamados.id));
  return filas.map((f) =>
    reclamacionDesdeFilas(f, conceptos.filter((c) => c.reclamacionId === f.id)),
  );
}

/** `GET reclamaciones/porFecha` — la del conductor en ese mes, o null. */
export async function cargarReclamacionPorFecha(
  db: Db,
  fecha: string,
  idConductor: number,
): Promise<ReclamacionDominio | null> {
  const filas = await db
    .select()
    .from(reclamaciones)
    .where(and(eq(reclamaciones.conductorId, idConductor), eq(reclamaciones.fecha, fechaBD(fecha))))
    .limit(1);
  if (filas.length === 0) return null;
  const conceptos = await db
    .select()
    .from(conceptosReclamados)
    .where(eq(conceptosReclamados.reclamacionId, filas[0].id))
    .orderBy(asc(conceptosReclamados.fecha), asc(conceptosReclamados.id));
  return reclamacionDesdeFilas(filas[0], conceptos);
}

/** Alta del agregado completo (EF: `Db.Add(reclamación con conceptos)`). Devuelve el Id. */
export async function crearReclamacion(
  db: Db,
  entrada: unknown,
  sesionId: number,
  ahora: string,
): Promise<number> {
  const r = validarReclamacion(entrada, Number((entrada as ReclamacionDominio).conductorId));
  return db.transaction(async (tx) => {
    const [creada] = await tx.insert(reclamaciones)
      .values({
        ...columnasReclamacion(r),
        modifiedDate: ahora,
        modifiedBy: sesionId,
      })
      .returning({ id: reclamaciones.id });
    const conceptos = conceptosAFilas(r).map((c) => ({
      ...c,
      reclamacionId: creada.id,
      modifiedDate: ahora,
      modifiedBy: sesionId,
    }));
    if (conceptos.length > 0) await tx.insert(conceptosReclamados).values(conceptos);
    return creada.id;
  });
}

/**
 * `PUT api/v1/reclamaciones/:id` — guarda el agregado: columnas de la
 * reclamación, conceptos nuevos y modificados, y baja de los que ya no vienen
 * en el cuerpo (el original los borra aparte con `conceptosReclamados/lista`).
 */
export async function guardarReclamacion(
  db: Db,
  id: number,
  entrada: unknown,
  sesionId: number,
  ahora: string,
): Promise<void> {
  const r = validarReclamacion(entrada, Number((entrada as ReclamacionDominio).conductorId));
  await db.transaction(async (tx) => {
    const [existe] = await tx.select({ id: reclamaciones.id })
      .from(reclamaciones).where(eq(reclamaciones.id, id)).limit(1);
    if (existe === undefined) throw new Error(`No existe una reclamación con Id ${id}.`);
    await tx.update(reclamaciones)
      .set({ ...columnasReclamacion(r), modifiedDate: ahora, modifiedBy: sesionId })
      .where(eq(reclamaciones.id, id));
    const actuales = await tx.select({ id: conceptosReclamados.id })
      .from(conceptosReclamados).where(eq(conceptosReclamados.reclamacionId, id));
    const recibidos = r.conceptosReclamados.filter((c) => (c.id ?? 0) > 0).map((c) => c.id as number);
    const ausentes = actuales.filter((f) => !recibidos.includes(f.id)).map((f) => f.id);
    if (ausentes.length > 0) {
      await tx.delete(conceptosReclamados).where(inArray(conceptosReclamados.id, ausentes));
    }
    for (const c of r.conceptosReclamados) {
      const valores = {
        reclamacionId: id,
        fecha: c.fecha === "" ? "0001-01-01 00:00:00" : fechaBD(c.fecha),
        tipo: c.tipo,
        descripcion: c.descripcion,
        graficoTrabajado: c.graficoTrabajado,
        horasReales: aIntervalo(c.horasReales),
        horasCobradas: aIntervalo(c.horasCobradas),
        importeReal: aTextoNumerico(c.importeReal),
        importeCobrado: aTextoNumerico(c.importeCobrado),
        incidenciasReales: c.incidenciasReales,
        incidenciasCobradas: c.incidenciasCobradas,
        importeTotal: aTextoNumerico(c.importeTotal),
        resuelto: c.resuelto,
        modifiedDate: ahora,
        modifiedBy: sesionId,
      };
      const idConcepto = c.id ?? 0;
      if (idConcepto > 0) {
        await tx.update(conceptosReclamados).set(valores).where(eq(conceptosReclamados.id, idConcepto));
      } else {
        await tx.insert(conceptosReclamados).values(valores);
      }
    }
  });
}

/** `DELETE api/v1/conceptosReclamados/lista` — baja de conceptos por Id. */
export async function borrarConceptosReclamados(db: Db, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(conceptosReclamados).where(inArray(conceptosReclamados.id, ids));
}

// ---- Nóminas (agregado con conceptos) ----

/** Normaliza las fechas de la nómina de entrada. */
function validarNomina(entrada: unknown, conductorId: number): NominaDominio {
  const n = entrada as NominaDominio;
  if (!Number.isInteger(conductorId) || conductorId <= 0) {
    throw new Error("Indica el conductor de la nómina.");
  }
  const fecha = (v: string): string => {
    const f = String(v ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
      throw new Error("Las fechas de la nómina deben ser fechas (AAAA-MM-DD).");
    }
    return f;
  };
  return {
    ...n,
    conductorId,
    fecha: fecha(n.fecha),
    fechaInicio: fecha(n.fechaInicio),
    fechaFinal: fecha(n.fechaFinal),
    fechaAntiguedad: fecha(n.fechaAntiguedad),
  };
}

/** `GET api/v1/nominas?idConductor=N` — todas las nóminas, más reciente primero. */
export async function cargarNominas(db: Db, idConductor: number): Promise<NominaDominio[]> {
  const filas = await db
    .select()
    .from(nominas)
    .where(eq(nominas.conductorId, idConductor))
    .orderBy(desc(nominas.fecha));
  if (filas.length === 0) return [];
  const conceptos = await db
    .select()
    .from(conceptosNomina)
    .where(inArray(conceptosNomina.nominaId, filas.map((f) => f.id)))
    .orderBy(asc(conceptosNomina.id));
  return filas.map((f) =>
    nominaDesdeFilas(f, conceptos.filter((c) => c.nominaId === f.id)),
  );
}

/** `GET api/v1/nominas/id` — Id de la nómina mensual del conductor en ese mes, o 0. */
export async function idNominaDeFecha(
  db: Db,
  fecha: string,
  idConductor: number,
): Promise<number> {
  const [fila] = await db
    .select({ id: nominas.id })
    .from(nominas)
    .where(and(
      eq(nominas.conductorId, idConductor),
      eq(nominas.fecha, fechaBD(fecha)),
      eq(nominas.tipoNomina, TipoNomina.Mensual),
    ))
    .limit(1);
  return fila === undefined ? 0 : fila.id;
}

/** Carga la nómina `id` con sus conceptos (Ids reales de la BD). */
export async function cargarNomina(db: Db, id: number): Promise<NominaDominio | null> {
  const filas = await db.select().from(nominas).where(eq(nominas.id, id)).limit(1);
  if (filas.length === 0) return null;
  const conceptos = await db
    .select()
    .from(conceptosNomina)
    .where(eq(conceptosNomina.nominaId, id))
    .orderBy(asc(conceptosNomina.id));
  return nominaDesdeFilas(filas[0], conceptos);
}

/**
 * `PUT /api/v1/nominas/:id` — guarda el agregado: columnas de la nómina;
 * conceptos nuevos y modificados; baja de los que ya no vienen en el cuerpo.
 */
export async function guardarNomina(
  db: Db,
  id: number,
  entrada: unknown,
  sesionId: number,
  ahora: string,
): Promise<void> {
  const n = validarNomina(entrada, Number((entrada as NominaDominio).conductorId));
  await db.transaction(async (tx) => {
    const [existe] = await tx.select({ id: nominas.id }).from(nominas).where(eq(nominas.id, id)).limit(1);
    if (existe === undefined) throw new Error(`No existe una nómina con Id ${id}.`);
    await tx.update(nominas)
      .set({ ...nominaAFila(n), modifiedDate: ahora, modifiedBy: sesionId })
      .where(eq(nominas.id, id));
    const actuales = await tx.select({ id: conceptosNomina.id })
      .from(conceptosNomina).where(eq(conceptosNomina.nominaId, id));
    const recibidos = n.conceptos.filter((c) => (c.id ?? 0) > 0).map((c) => c.id as number);
    const ausentes = actuales.filter((f) => !recibidos.includes(f.id)).map((f) => f.id);
    if (ausentes.length > 0) {
      await tx.delete(conceptosNomina).where(inArray(conceptosNomina.id, ausentes));
    }
    for (const c of n.conceptos) {
      const valores = {
        nominaId: id,
        tipoConceptoNomina: c.tipoConceptoNomina,
        codigo: c.codigo,
        computaParaIrpf: c.computaParaIrpf,
        textoConcepto: c.textoConcepto,
        unidades: aTextoNumerico(c.unidades),
        importeBase: aNumerico(c.importeBase),
        devengado: aNumerico(c.devengado),
        deduccion: aNumerico(c.deduccion),
        modifiedDate: ahora,
        modifiedBy: sesionId,
      };
      const idConcepto = c.id ?? 0;
      if (idConcepto > 0) {
        await tx.update(conceptosNomina).set(valores).where(eq(conceptosNomina.id, idConcepto));
      } else {
        await tx.insert(conceptosNomina).values(valores);
      }
    }
  });
}

/** `DELETE api/v1/nominas/:id` (los conceptos se van por cascada). */
export async function borrarNomina(db: Db, id: number): Promise<void> {
  await db.delete(nominas).where(eq(nominas.id, id));
}

/**
 * `POST api/v1/nominas/generar?fecha=AAAA-MM-DD&idConductor=N` — port de
 * `ServicioCalendarios.GenerarNominaAsync`: nómina mensual calculada con
 * `CalculosNomina.Generar` (calendario del mes con resumen + convenio del año
 * con tablas y opciones). Borra la nómina mensual previa del mes antes de
 * insertar. Devuelve null si falta el calendario del mes o el convenio del año,
 * o si el convenio no tiene tabla salarial para la categoría del conductor
 * (el original insertaba una nómina vacía que violaba la FK de conductor).
 */
export async function generarNominaServidor(
  db: Db,
  fecha: string,
  idConductor: number,
  sesionId: number,
  ahora: string,
): Promise<NominaDominio | null> {
  const primero = primeroDeMes(fecha);
  const año = Number(fecha.slice(0, 4));

  const [filaCalendario] = await db
    .select()
    .from(calendarios)
    .where(and(eq(calendarios.conductorId, idConductor), eq(calendarios.fecha, primero)))
    .limit(1);
  if (filaCalendario === undefined) return null;

  const [filaConductor] = await db.select().from(conductores)
    .where(eq(conductores.id, idConductor)).limit(1);
  if (filaConductor === undefined) return null;
  const filasRegulaciones = await db.select().from(regulaciones)
    .where(eq(regulaciones.conductorId, idConductor)).orderBy(asc(regulaciones.fecha));
  const [filaConvenio] = await db.select().from(convenios)
    .where(eq(convenios.año, año)).limit(1);
  if (filaConvenio === undefined) return null;
  const [filasOpciones, filasTablas, filasFestivos] = await Promise.all([
    db.select().from(opcionesCentro),
    db.select().from(tablasSalariales).where(eq(tablasSalariales.convenioId, filaConvenio.id)),
    db.select().from(festivos),
  ]);
  const conductor = conductorDesdeFila(filaConductor, filasRegulaciones);
  const convenio = convenioDesdeFilas(filaConvenio, filasOpciones, filasFestivos, filasTablas);
  if (convenio.tablasSalariales.find((t) => t.categoria === conductor.categoria) === undefined) {
    return null;
  }
  if (convenio.opcionesCentro.find((o) => o.centro === conductor.centro) === undefined) {
    return null;
  }

  const [filasDias, filasResumen] = await Promise.all([
    db.select().from(diasCalendario)
      .where(eq(diasCalendario.calendarioId, filaCalendario.id)).orderBy(asc(diasCalendario.fecha)),
    db.select().from(resumenes).where(eq(resumenes.calendarioId, filaCalendario.id)).limit(1),
  ]);
  const calendario = calendarioDesdeFila(
    filaCalendario,
    filasDias,
    filasResumen.length === 0 ? null : resumenDesdeFila(filasResumen[0]),
    conductor,
  );

  const nomina = generarNominaDominio(calendario, convenio);
  await db.transaction(async (tx) => {
    const previas = await tx.select({ id: nominas.id }).from(nominas)
      .where(and(
        eq(nominas.conductorId, idConductor),
        eq(nominas.fecha, primero),
        eq(nominas.tipoNomina, TipoNomina.Mensual),
      ));
    if (previas.length > 0) {
      await tx.delete(nominas).where(inArray(nominas.id, previas.map((p) => p.id)));
    }
    const [creada] = await tx.insert(nominas)
      .values({ ...nominaAFila(nomina), modifiedDate: ahora, modifiedBy: sesionId })
      .returning({ id: nominas.id });
    const conceptos = conceptosNominaAFilas(nomina).map((c) => ({
      ...c,
      nominaId: creada.id,
      modifiedDate: ahora,
      modifiedBy: sesionId,
    }));
    if (conceptos.length > 0) await tx.insert(conceptosNomina).values(conceptos);
  });

  const idNomina = await idNominaDeFecha(db, fecha, idConductor);
  return idNomina === 0 ? null : cargarNomina(db, idNomina);
}
