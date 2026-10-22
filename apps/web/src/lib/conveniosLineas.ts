/**
 * Repositorio de convenios y líneas del ESCRITORIO (port de los
 * `ConveniosController`/`LineasController`/`ItinerariosController`/
 * `ParadasController` del original). Igual que en reclamaciones, el cliente
 * guarda agregados completos: PUT inserta los hijos nuevos (Id = 0) y
 * actualiza los existentes; las bajas van aparte (`festivos/lista`,
 * `itinerarios/lista`, `paradas/lista`) o por cascada al borrar la entidad.
 */
import { asc, eq, inArray } from "drizzle-orm";
import {
  aIntervalo, aMinutos, aTextoNumerico,
  convenios, festivos, itinerarios, lineas, opcionesCentro, paradas, tablasSalariales,
  convenioDesdeFilas,
  type Db,
} from "@mercurio/db";
import type {
  Convenio as ConvenioDominio,
  Linea as LineaDominio,
  Itinerario as ItinerarioDominio,
  Parada as ParadaDominio,
} from "@mercurio/domain";

/** Auditoría en cada escritura (copias de los valores de la fila). */
type Sel = { modifiedDate: string; modifiedBy: number };

/** Mensaje completo de un error de drizzle/pg (la causa va en `e.cause`). */
export function mensaje(e: unknown): string {
  if (e instanceof Error) {
    const causa = (e as { cause?: unknown }).cause;
    const textoCausa = causa instanceof Error ? ` — ${causa.message}` : causa !== undefined ? ` — ${String(causa)}` : "";
    return `${e.message}${textoCausa}`;
  }
  return String(e);
}

// ---- Convenios (agregado con tablas + opciones + festivos) ----

/** Carga el convenio `id` como objeto del dominio, o null. */
export async function cargarConvenio(db: Db, id: number): Promise<ConvenioDominio | null> {
  const [fila] = await db.select().from(convenios).where(eq(convenios.id, id)).limit(1);
  if (fila === undefined) return null;
  const [filasOpciones, filasFestivos, filasTablas] = await Promise.all([
    db.select().from(opcionesCentro),
    db.select().from(festivos),
    db.select().from(tablasSalariales),
  ]);
  return convenioDesdeFilas(fila, filasOpciones, filasFestivos, filasTablas);
}

/** Columnas del convenio a guardar (duraciones interval + importes numeric, sin auditoría). */
function columnasConvenio(c: ConvenioDominio): Omit<typeof convenios.$inferInsert, "id" | "modifiedDate" | "modifiedBy"> {
  return {
    año: c.año,
    jornadaMedia: aIntervalo(c.jornadaMedia),
    importeDietas: aTextoNumerico(c.importeDietas / 100),
    jornadaAnual: c.jornadaAnual,
    diasTrabajoAnuales: c.diasTrabajoAnuales,
    diasDescansoAnuales: c.diasDescansoAnuales,
    descansosSueltosAnuales: c.descansosSueltosAnuales,
    diasVacacionesAnuales: c.diasVacacionesAnuales,
    findesCompletosAnuales: c.findesCompletosAnuales,
    diasTrabajadosSeguidos: c.diasTrabajadosSeguidos,
    descansosSueltosMes: c.descansosSueltosMes,
    minimoDescansosMes: c.minimoDescansosMes,
    maximoDescansosMes: c.maximoDescansosMes,
    maximoFindesSeguidos: c.maximoFindesSeguidos,
    jornadaMaxima: aIntervalo(c.jornadaMaxima),
    jornadaMaximaFindes: aIntervalo(c.jornadaMaximaFindes),
    jornadaMaximaPartida: aIntervalo(c.jornadaMaximaPartida),
    tiempoPartidoMaximo: aIntervalo(c.tiempoPartidoMaximo),
    inicioNocturnas: aIntervalo(c.inicioNocturnas),
    finalNocturnas: aIntervalo(c.finalNocturnas),
    limiteDesayuno: aIntervalo(c.limiteDesayuno),
    inicioComidaContinuo: aIntervalo(c.inicioComidaContinuo),
    finalComidaContinuo: aIntervalo(c.finalComidaContinuo),
    inicioComidaPartido: aIntervalo(c.inicioComidaPartido),
    finalComidaPartido: aIntervalo(c.finalComidaPartido),
    inicioCena: aIntervalo(c.inicioCena),
    finalCena: aIntervalo(c.finalCena),
    limitePlusCena: aIntervalo(c.limitePlusCena),
    porcentajeDesayuno: c.porcentajeDesayuno,
    porcentajePlusCena: c.porcentajePlusCena,
    maximoLimpiezas: c.maximoLimpiezas,
    importePlusFestivos: aTextoNumerico(c.importePlusFestivos / 100),
    importePlusSabados: aTextoNumerico(c.importePlusSabados / 100),
    importePlusMenorDescanso: aTextoNumerico(c.importePlusMenorDescanso / 100),
    importePlusLimpieza: aTextoNumerico(c.importePlusLimpieza / 100),
    importePlusPaqueteria: aTextoNumerico(c.importePlusPaqueteria / 100),
    importePlusNocturnidad: aTextoNumerico(c.importePlusNocturnidad / 100),
    importePlusNocturnidadDiario: aTextoNumerico(c.importePlusNocturnidadDiario / 100),
    importePlusNavidad: aTextoNumerico(c.importePlusNavidad / 100),
    importeRefuerzos: aTextoNumerico(c.importeRefuerzos / 100),
  };
}

/**
 * El cliente mantiene los importes en céntimos exactos; se acepta como tal
 * con una normalización mínima de fechas/ids. (Los campos numéricos del
 * dominio ya viajan en céntimos desde las pantallas.)
 */
export function validarConvenio(entrada: unknown): ConvenioDominio {
  const c = entrada as ConvenioDominio;
  const año = Math.trunc(Number(c.año));
  if (!Number.isInteger(año) || año < 2000 || año > 2100) {
    throw new Error("El año de validez del convenio no es válido.");
  }
  return {
    ...c,
    año,
    opcionesCentro: (c.opcionesCentro ?? []).map((o) => ({
      ...o,
      festivos: (o.festivos ?? []).map((f) => ({ ...f, fecha: String(f.fecha ?? "").slice(0, 10) })),
    })),
    tablasSalariales: c.tablasSalariales ?? [],
  };
}

/**
 * Alta del agregado completo (EF: `Db.Add(convenio con hijos)`): convenio,
 * tablas salariales, opciones de centro y festivos de cada opción nueva.
 */
export async function crearConvenio(
  db: Db,
  entrada: unknown,
  sesionId: number,
  ahora: string,
): Promise<number> {
  const c = validarConvenio(entrada);
  const audit: Sel = { modifiedDate: ahora, modifiedBy: sesionId };
  return db.transaction(async (tx) => {
    const [creado] = await tx.insert(convenios)
      .values({ ...columnasConvenio(c), ...audit })
      .returning({ id: convenios.id });
    const tablas = c.tablasSalariales.map((t) => ({
      convenioId: creado.id,
      categoria: t.categoria,
      sueldoBaseDiario: aTextoNumerico(t.sueldoBaseDiario / 100),
      sueldoBaseMensual: aTextoNumerico(t.sueldoBaseMensual / 100),
      sueldoBaseAnual: aTextoNumerico(t.sueldoBaseAnual / 100),
      complementoSalarial: aTextoNumerico(t.complementoSalarial / 100),
      baseAntiguedad: aTextoNumerico(t.baseAntiguedad / 100),
      precioHoraExtra: aTextoNumerico(t.precioHoraExtra / 100),
      precioQuebrantoMoneda: aTextoNumerico(t.precioQuebrantoMoneda / 100),
      pagaSeptiembre: aTextoNumerico(t.pagaSeptiembre / 100),
      importeDndCobrado: aTextoNumerico(t.importeDndCobrado / 100),
      seguroAccidentes: aTextoNumerico(t.seguroAccidentes / 100),
      porcentajeSeguridadSocial: aTextoNumerico(t.porcentajeSeguridadSocial / 100),
      porcentajeDesempleo: aTextoNumerico(t.porcentajeDesempleo / 100),
      ...audit,
    }));
    if (tablas.length > 0) await tx.insert(tablasSalariales).values(tablas);
    const opciones = c.opcionesCentro.map((o) => ({
      convenioId: creado.id,
      centro: o.centro,
      numerosL: o.numerosL,
      numerosV: o.numerosV,
      numerosS: o.numerosS,
      numerosF: o.numerosF,
      numerosR: o.numerosR,
      limpiezasMes: o.limpiezasMes,
      pagarPlusViaje: o.pagarPlusViaje,
      importePlusViaje: aTextoNumerico(o.importePlusViaje / 100),
      ...audit,
    }));
    if (opciones.length > 0) {
      const creadas = await tx.insert(opcionesCentro).values(opciones).returning({
        id: opcionesCentro.id,
      });
      const filasFestivos = c.opcionesCentro.flatMap((o, i) =>
        o.festivos
          .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.fecha))
          .map((f) => ({
            opcionesCentroId: creadas[i].id,
            fecha: `${f.fecha} 00:00:00`,
            ...audit,
          })),
      );
      if (filasFestivos.length > 0) await tx.insert(festivos).values(filasFestivos);
    }
    return creado.id;
  });
}

/**
 * `PUT api/v1/convenios/:id` — guarda el agregado igual que EF `Update`:
 * columnas del convenio, hijos nuevos insertados (Id = 0), hijos existentes
 * actualizados y **baja de los hijos que ya no vienen en el cuerpo** (para
 * tablas y opciones — con los festivos el borrado va aparte por
 * `festivos/lista`, pero aquí también se barre por seguridad).
 */
export async function guardarConvenio(
  db: Db,
  id: number,
  entrada: unknown,
  sesionId: number,
  ahora: string,
): Promise<void> {
  const c = validarConvenio(entrada);
  const audit: Sel = { modifiedDate: ahora, modifiedBy: sesionId };
  await db.transaction(async (tx) => {
    const [existe] = await tx.select({ id: convenios.id }).from(convenios).where(eq(convenios.id, id)).limit(1);
    if (existe === undefined) throw new Error(`No existe un convenio con Id ${id}.`);
    await tx.update(convenios).set({ ...columnasConvenio(c), ...audit }).where(eq(convenios.id, id));

    // --- Tablas salariales: upsert + baja de ausentes ---
    const actualesTablas = await tx.select({ id: tablasSalariales.id })
      .from(tablasSalariales).where(eq(tablasSalariales.convenioId, id));
    const recibidasTablas = c.tablasSalariales.filter((t) => (t.id ?? 0) > 0).map((t) => t.id as number);
    const ausentesTablas = actualesTablas.filter((f) => !recibidasTablas.includes(f.id)).map((f) => f.id);
    if (ausentesTablas.length > 0) {
      await tx.delete(tablasSalariales).where(inArray(tablasSalariales.id, ausentesTablas));
    }
    for (const t of c.tablasSalariales) {
      const valores = {
        convenioId: id,
        categoria: t.categoria,
        sueldoBaseDiario: aTextoNumerico(t.sueldoBaseDiario / 100),
        sueldoBaseMensual: aTextoNumerico(t.sueldoBaseMensual / 100),
        sueldoBaseAnual: aTextoNumerico(t.sueldoBaseAnual / 100),
        complementoSalarial: aTextoNumerico(t.complementoSalarial / 100),
        baseAntiguedad: aTextoNumerico(t.baseAntiguedad / 100),
        precioHoraExtra: aTextoNumerico(t.precioHoraExtra / 100),
        precioQuebrantoMoneda: aTextoNumerico(t.precioQuebrantoMoneda / 100),
        pagaSeptiembre: aTextoNumerico(t.pagaSeptiembre / 100),
        importeDndCobrado: aTextoNumerico(t.importeDndCobrado / 100),
        seguroAccidentes: aTextoNumerico(t.seguroAccidentes / 100),
        porcentajeSeguridadSocial: aTextoNumerico(t.porcentajeSeguridadSocial / 100),
        porcentajeDesempleo: aTextoNumerico(t.porcentajeDesempleo / 100),
        ...audit,
      };
      if (t.id !== undefined && t.id > 0) {
        await tx.update(tablasSalariales).set(valores).where(eq(tablasSalariales.id, t.id));
      } else {
        await tx.insert(tablasSalariales).values(valores);
      }
    }

    // --- Opciones de centro: borrar las ausentes; crear nuevas para poder colgarles festivos ---
    const actualesOpciones = await tx.select({ id: opcionesCentro.id })
      .from(opcionesCentro).where(eq(opcionesCentro.convenioId, id));
    const recibidasOp = c.opcionesCentro.filter((o) => (o.id ?? 0) > 0).map((o) => o.id as number);
    const ausentesOp = actualesOpciones.filter((f) => !recibidasOp.includes(f.id)).map((f) => f.id);
    if (ausentesOp.length > 0) {
      await tx.delete(opcionesCentro).where(inArray(opcionesCentro.id, ausentesOp));
    }
    for (const o of c.opcionesCentro) {
      const valores = {
        convenioId: id,
        centro: o.centro,
        numerosL: o.numerosL,
        numerosV: o.numerosV,
        numerosS: o.numerosS,
        numerosF: o.numerosF,
        numerosR: o.numerosR,
        limpiezasMes: o.limpiezasMes,
        pagarPlusViaje: o.pagarPlusViaje,
        importePlusViaje: aTextoNumerico(o.importePlusViaje / 100),
        ...audit,
      };
      let idOpciones = o.id ?? 0;
      if (idOpciones > 0) {
        await tx.update(opcionesCentro).set(valores).where(eq(opcionesCentro.id, idOpciones));
        // Festivos de la opción: alta de nuevos (la baja del cliente va por
        // festivos/lista; también se barre cualquier ausente por seguridad).
        const actualesFest = await tx.select({ id: festivos.id })
          .from(festivos).where(eq(festivos.opcionesCentroId, idOpciones));
        const recibidosFest = o.festivos.filter((f) => (f.id ?? 0) > 0).map((f) => f.id as number);
        const ausentesFest = actualesFest.filter((f) => !recibidosFest.includes(f.id)).map((f) => f.id);
        if (ausentesFest.length > 0) {
          await tx.delete(festivos).where(inArray(festivos.id, ausentesFest));
        }
        for (const f of o.festivos) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) continue;
          const valoresFest = {
            opcionesCentroId: idOpciones,
            fecha: `${f.fecha} 00:00:00`,
            ...audit,
          };
          if ((f.id ?? 0) > 0) {
            await tx.update(festivos).set(valoresFest).where(eq(festivos.id, f.id as number));
          } else {
            await tx.insert(festivos).values(valoresFest);
          }
        }
      } else {
        const [creada] = await tx.insert(opcionesCentro).values(valores).returning({ id: opcionesCentro.id });
        idOpciones = creada.id;
        const filasFest = o.festivos
          .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.fecha))
          .map((f) => ({ opcionesCentroId: idOpciones, fecha: `${f.fecha} 00:00:00`, ...audit }));
        if (filasFest.length > 0) await tx.insert(festivos).values(filasFest);
      }
    }
  });
}

/** `DELETE api/v1/convenios/:id` — hijos por cascada. Devuelve true si existía. */
export async function borrarConvenio(db: Db, id: number): Promise<boolean> {
  const borrados = await db.delete(convenios).where(eq(convenios.id, id)).returning({ id: convenios.id });
  return borrados.length > 0;
}

/** `DELETE api/v1/convenios/festivos/lista` — baja de festivos por Id. */
export async function borrarFestivos(db: Db, ids: number[]): Promise<void> {
  if (ids.length > 0) await db.delete(festivos).where(inArray(festivos.id, ids));
}

// ---- Líneas (agregado con itinerarios + paradas) ----

/** `GET api/v1/lineas` — todas las líneas con itinerarios y paradas, por nombre. */
export async function cargarLineas(db: Db): Promise<LineaDominio[]> {
  const [filasL, filasI, filasP] = await Promise.all([
    db.select().from(lineas).orderBy(asc(lineas.nombre)),
    db.select().from(itinerarios).orderBy(asc(itinerarios.id)),
    db.select().from(paradas).orderBy(asc(paradas.orden), asc(paradas.id)),
  ]);
  return filasL.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    descripcion: l.descripcion,
    itinerarios: filasI
      .filter((i) => i.lineaId === l.id)
      .map((i) => ({
        id: i.id,
        lineaId: i.lineaId,
        nombre: i.nombre,
        descripcion: i.descripcion,
        tiempoReal: i.tiempoReal,
        tiempoPago: i.tiempoPago,
        paradas: filasP
          .filter((p) => p.itinerarioId === i.id)
          .map((p) => ({
            id: p.id,
            itinerarioId: p.itinerarioId,
            orden: p.orden,
            descripcion: p.descripcion,
            tiempo: aMinutos(p.tiempo),
          })),
      })),
  }));
}

function validarLinea(entrada: unknown): LineaDominio {
  const l = entrada as LineaDominio;
  if (typeof l.nombre !== "string" || l.nombre.trim() === "") {
    throw new Error("La línea necesita un nombre.");
  }
  return { ...l, itinerarios: (l.itinerarios ?? []) as ItinerarioDominio[] };
}

function columnasItinerario(i: ItinerarioDominio, idLinea: number, audit: Sel) {
  return {
    lineaId: idLinea,
    nombre: i.nombre,
    descripcion: i.descripcion,
    tiempoReal: Math.trunc(Number(i.tiempoReal)) || 0,
    tiempoPago: Math.trunc(Number(i.tiempoPago)) || 0,
    ...audit,
  };
}

function columnasParada(p: ParadaDominio, idItinerario: number, audit: Sel) {
  return {
    itinerarioId: idItinerario,
    orden: Math.trunc(Number(p.orden)) || 0,
    descripcion: p.descripcion,
    tiempo: aIntervalo(p.tiempo),
    ...audit,
  };
}

/** `POST api/v1/lineas` (o `lineas/lista` con varias) — alta del agregado completo. */
export async function crearLineas(
  db: Db,
  entradas: unknown[],
  sesionId: number,
  ahora: string,
): Promise<number[]> {
  const lineasValidas = entradas.map(validarLinea);
  const audit: Sel = { modifiedDate: ahora, modifiedBy: sesionId };
  return db.transaction(async (tx) => {
    const ids: number[] = [];
    for (const l of lineasValidas) {
      const [creada] = await tx.insert(lineas)
        .values({ nombre: l.nombre, descripcion: l.descripcion, ...audit })
        .returning({ id: lineas.id });
      ids.push(creada.id);
      for (const i of l.itinerarios) {
        const [creadoIt] = await tx.insert(itinerarios)
          .values(columnasItinerario(i, creada.id, audit))
          .returning({ id: itinerarios.id });
        const paradasNuevas = i.paradas.map((p) => columnasParada(p, creadoIt.id, audit));
        if (paradasNuevas.length > 0) await tx.insert(paradas).values(paradasNuevas);
      }
    }
    return ids;
  });
}

/**
 * `PUT api/v1/lineas/:id` — guarda el agregado: upsert de itinerarios y de
 * sus paradas, y baja de los que ya no vienen en el cuerpo.
 */
export async function guardarLinea(
  db: Db,
  id: number,
  entrada: unknown,
  sesionId: number,
  ahora: string,
): Promise<void> {
  const l = validarLinea(entrada);
  const audit: Sel = { modifiedDate: ahora, modifiedBy: sesionId };
  await db.transaction(async (tx) => {
    const [existe] = await tx.select({ id: lineas.id }).from(lineas).where(eq(lineas.id, id)).limit(1);
    if (existe === undefined) throw new Error(`No existe una línea con Id ${id}.`);
    await tx.update(lineas).set({ nombre: l.nombre, descripcion: l.descripcion, ...audit }).where(eq(lineas.id, id));

    const actualesIt = await tx.select({ id: itinerarios.id })
      .from(itinerarios).where(eq(itinerarios.lineaId, id));
    const recibidosIt = l.itinerarios.filter((i) => (i.id ?? 0) > 0).map((i) => i.id as number);
    const ausentesIt = actualesIt.filter((f) => !recibidosIt.includes(f.id)).map((f) => f.id);
    if (ausentesIt.length > 0) {
      await tx.delete(itinerarios).where(inArray(itinerarios.id, ausentesIt));
    }
    for (const i of l.itinerarios) {
      const valoresIt = columnasItinerario(i, id, audit);
      const idIt = i.id ?? 0;
      if (idIt > 0) {
        await tx.update(itinerarios).set(valoresIt).where(eq(itinerarios.id, idIt));
        const actualesP = await tx.select({ id: paradas.id })
          .from(paradas).where(eq(paradas.itinerarioId, idIt));
        const recibidosP = i.paradas.filter((p) => (p.id ?? 0) > 0).map((p) => p.id as number);
        const ausentesP = actualesP.filter((f) => !recibidosP.includes(f.id)).map((f) => f.id);
        if (ausentesP.length > 0) {
          await tx.delete(paradas).where(inArray(paradas.id, ausentesP));
        }
        for (const p of i.paradas) {
          const valoresP = columnasParada(p, idIt, audit);
          if ((p.id ?? 0) > 0) {
            await tx.update(paradas).set(valoresP).where(eq(paradas.id, p.id as number));
          } else {
            await tx.insert(paradas).values(valoresP);
          }
        }
      } else {
        const [creadoIt] = await tx.insert(itinerarios).values(valoresIt).returning({ id: itinerarios.id });
        const paradasNuevas = i.paradas.map((p) => columnasParada(p, creadoIt.id, audit));
        if (paradasNuevas.length > 0) await tx.insert(paradas).values(paradasNuevas);
      }
    }
  });
}

/** `DELETE api/v1/lineas/:id` — itinerarios y paradas por cascada. Devuelve true si existía. */
export async function borrarLinea(db: Db, id: number): Promise<boolean> {
  const borrados = await db.delete(lineas).where(eq(lineas.id, id)).returning({ id: lineas.id });
  return borrados.length > 0;
}

/** `DELETE api/v1/paradas/lista` — baja por Id. */
export async function borrarParadas(db: Db, ids: number[]): Promise<void> {
  if (ids.length > 0) await db.delete(paradas).where(inArray(paradas.id, ids));
}

/** `DELETE api/v1/itinerarios/lista` — baja por Id. */
export async function borrarItinerarios(db: Db, ids: number[]): Promise<void> {
  if (ids.length > 0) await db.delete(itinerarios).where(inArray(itinerarios.id, ids));
}
