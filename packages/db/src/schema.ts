/**
 * Port del esquema de `Mercurio.Api` (EF Core + Npgsql) a Drizzle ORM.
 * Los nombres de tablas y columnas son EXACTOS al original para que las
 * migraciones y cualquier herramienta sobre la BD sean equivalentes:
 * - Horas → `interval` (convierte minutos con `convertir.ts`)
 * - Dinero y decimales → `numeric` (los importes van en céntimos en el dominio)
 * - Enums → `integer` con `.$type<>()` del dominio
 * - Borrados en cascada y índices únicos igual que la migración inicial
 */
import {
  index, integer, interval, numeric, pgTable, primaryKey,
  timestamp, uniqueIndex, varchar, boolean, text,
} from "drizzle-orm/pg-core";
import type {
  CategoriaGrafico, CategoriaTrabajador, CentroTrabajo, CodigoIncidencia,
  Incidencia, SituacionTrabajador, TipoConceptoNomina, TipoDia, TipoNomina,
  TipoReclamacion, TipoRegulacion, Turno,
} from "@mercurio/domain";

/** `Id` identity-by-default, como NpgsqlValueGenerationStrategy.IdentityByDefaultColumn. */
const id = () => integer("Id").primaryKey().generatedByDefaultAsIdentity();

/** Auditoría común de las tablas de negocio. */
const auditoria = () => ({
  modifiedDate: timestamp("ModifiedDate", { mode: "string" }).notNull(),
  modifiedBy: integer("ModifiedBy").notNull(),
});

// ---- Identidad (ASP.NET Core Identity, esqueleto compatible) ----

export const aspNetRoles = pgTable(
  "AspNetRoles",
  {
    id: id(),
    name: varchar("Name", { length: 256 }),
    normalizedName: varchar("NormalizedName", { length: 256 }),
    concurrencyStamp: text("ConcurrencyStamp"),
  },
  (t) => [uniqueIndex("RoleNameIndex").on(t.normalizedName)],
);

export const aspNetUsers = pgTable(
  "AspNetUsers",
  {
    id: id(),
    matricula: integer("Matricula").notNull(),
    nombre: text("Nombre").notNull(),
    apellidos: text("Apellidos").notNull(),
    fechaAlta: timestamp("FechaAlta", { mode: "string" }).notNull(),
    isAfiliado: boolean("IsAfiliado").notNull(),
    isAdmin: boolean("IsAdmin").notNull(),
    isSuper: boolean("IsSuper").notNull(),
    userName: varchar("UserName", { length: 256 }),
    normalizedUserName: varchar("NormalizedUserName", { length: 256 }),
    email: varchar("Email", { length: 256 }),
    normalizedEmail: varchar("NormalizedEmail", { length: 256 }),
    emailConfirmed: boolean("EmailConfirmed").notNull(),
    passwordHash: text("PasswordHash"),
    securityStamp: text("SecurityStamp"),
    concurrencyStamp: text("ConcurrencyStamp"),
    phoneNumber: text("PhoneNumber"),
    phoneNumberConfirmed: boolean("PhoneNumberConfirmed").notNull(),
    twoFactorEnabled: boolean("TwoFactorEnabled").notNull(),
    lockoutEnd: timestamp("LockoutEnd", { mode: "string", withTimezone: true }),
    lockoutEnabled: boolean("LockoutEnabled").notNull(),
    accessFailedCount: integer("AccessFailedCount").notNull(),
  },
  (t) => [
    uniqueIndex("UserNameIndex").on(t.normalizedUserName),
    index("EmailIndex").on(t.normalizedEmail),
  ],
);

export const aspNetRoleClaims = pgTable("AspNetRoleClaims", {
  id: id(),
  roleId: integer("RoleId").notNull().references(() => aspNetRoles.id, { onDelete: "cascade" }),
  claimType: text("ClaimType"),
  claimValue: text("ClaimValue"),
}, (t) => [index("IX_AspNetRoleClaims_RoleId").on(t.roleId)]);

export const aspNetUserClaims = pgTable("AspNetUserClaims", {
  id: id(),
  userId: integer("UserId").notNull().references(() => aspNetUsers.id, { onDelete: "cascade" }),
  claimType: text("ClaimType"),
  claimValue: text("ClaimValue"),
}, (t) => [index("IX_AspNetUserClaims_UserId").on(t.userId)]);

export const aspNetUserLogins = pgTable("AspNetUserLogins", {
  loginProvider: text("LoginProvider").notNull(),
  providerKey: text("ProviderKey").notNull(),
  providerDisplayName: text("ProviderDisplayName"),
  userId: integer("UserId").notNull().references(() => aspNetUsers.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ name: "PK_AspNetUserLogins", columns: [t.loginProvider, t.providerKey] }),
  index("IX_AspNetUserLogins_UserId").on(t.userId),
]);

export const aspNetUserRoles = pgTable("AspNetUserRoles", {
  userId: integer("UserId").notNull().references(() => aspNetUsers.id, { onDelete: "cascade" }),
  roleId: integer("RoleId").notNull().references(() => aspNetRoles.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ name: "PK_AspNetUserRoles", columns: [t.userId, t.roleId] }),
  index("IX_AspNetUserRoles_RoleId").on(t.roleId),
]);

export const aspNetUserTokens = pgTable("AspNetUserTokens", {
  userId: integer("UserId").notNull().references(() => aspNetUsers.id, { onDelete: "cascade" }),
  loginProvider: text("LoginProvider").notNull(),
  name: text("Name").notNull(),
  value: text("Value"),
}, (t) => [
  primaryKey({ name: "PK_AspNetUserTokens", columns: [t.userId, t.loginProvider, t.name] }),
]);

// ---- Dominio ----

export const conductores = pgTable(
  "Conductores",
  {
    id: id(),
    centro: integer("Centro").$type<CentroTrabajo>().notNull(),
    categoria: integer("Categoria").$type<CategoriaTrabajador>().notNull(),
    situacion: integer("Situacion").$type<SituacionTrabajador>().notNull(),
    matricula: integer("Matricula").notNull(),
    isUsuario: boolean("IsUsuario").notNull(),
    fechaAntiguedad: timestamp("FechaAntiguedad", { mode: "string" }).notNull(),
    porcentajeIrpf: numeric("PorcentajeIrpf").notNull(),
    numeroAfiliado: integer("NumeroAfiliado").notNull(),
    isReduccionJornada: boolean("IsReduccionJornada").notNull(),
    porcentajeJornada: integer("PorcentajeJornada").notNull(),
    nombre: text("Nombre").notNull(),
    apellidos: text("Apellidos").notNull(),
    telefono: text("Telefono"),
    email: text("Email"),
    acumuladasIniciales: interval("AcumuladasIniciales").notNull(),
    dcsIniciales: numeric("DcsIniciales").notNull(),
    dndsIniciales: numeric("DndsIniciales").notNull(),
    plusDistancia: numeric("PlusDistancia").notNull(),
    notas: text("Notas"),
    ...auditoria(),
  },
  (t) => [uniqueIndex("IX_Conductores_Matricula").on(t.matricula)],
);

export const convenios = pgTable(
  "Convenios",
  {
    id: id(),
    año: integer("Año").notNull(),
    jornadaMedia: interval("JornadaMedia").notNull(),
    importeDietas: numeric("ImporteDietas").notNull(),
    jornadaAnual: integer("JornadaAnual").notNull(),
    diasTrabajoAnuales: integer("DiasTrabajoAnuales").notNull(),
    diasDescansoAnuales: integer("DiasDescansoAnuales").notNull(),
    descansosSueltosAnuales: integer("DescansosSueltosAnuales").notNull(),
    diasVacacionesAnuales: integer("DiasVacacionesAnuales").notNull(),
    findesCompletosAnuales: integer("FindesCompletosAnuales").notNull(),
    diasTrabajadosSeguidos: integer("DiasTrabajadosSeguidos").notNull(),
    descansosSueltosMes: integer("DescansosSueltosMes").notNull(),
    minimoDescansosMes: integer("MinimoDescansosMes").notNull(),
    maximoDescansosMes: integer("MaximoDescansosMes").notNull(),
    maximoFindesSeguidos: integer("MaximoFindesSeguidos").notNull(),
    jornadaMaxima: interval("JornadaMaxima").notNull(),
    jornadaMaximaFindes: interval("JornadaMaximaFindes").notNull(),
    jornadaMaximaPartida: interval("JornadaMaximaPartida").notNull(),
    tiempoPartidoMaximo: interval("TiempoPartidoMaximo").notNull(),
    inicioNocturnas: interval("InicioNocturnas").notNull(),
    finalNocturnas: interval("FinalNocturnas").notNull(),
    limiteDesayuno: interval("LimiteDesayuno").notNull(),
    inicioComidaContinuo: interval("InicioComidaContinuo").notNull(),
    finalComidaContinuo: interval("FinalComidaContinuo").notNull(),
    inicioComidaPartido: interval("InicioComidaPartido").notNull(),
    finalComidaPartido: interval("FinalComidaPartido").notNull(),
    inicioCena: interval("InicioCena").notNull(),
    finalCena: interval("FinalCena").notNull(),
    limitePlusCena: interval("LimitePlusCena").notNull(),
    porcentajeDesayuno: integer("PorcentajeDesayuno").notNull(),
    porcentajePlusCena: integer("PorcentajePlusCena").notNull(),
    maximoLimpiezas: integer("MaximoLimpiezas").notNull(),
    importePlusFestivos: numeric("ImportePlusFestivos").notNull(),
    importePlusSabados: numeric("ImportePlusSabados").notNull(),
    importePlusMenorDescanso: numeric("ImportePlusMenorDescanso").notNull(),
    importePlusLimpieza: numeric("ImportePlusLimpieza").notNull(),
    importePlusPaqueteria: numeric("ImportePlusPaqueteria").notNull(),
    importePlusNocturnidad: numeric("ImportePlusNocturnidad").notNull(),
    importePlusNocturnidadDiario: numeric("ImportePlusNocturnidadDiario").notNull(),
    importePlusNavidad: numeric("ImportePlusNavidad").notNull(),
    importeRefuerzos: numeric("ImporteRefuerzos").notNull(),
    ...auditoria(),
  },
  (t) => [uniqueIndex("IX_Convenios_Año").on(t.año)],
);

export const opcionesCentro = pgTable("OpcionesCentro", {
  id: id(),
  convenioId: integer("ConvenioId").notNull().references(() => convenios.id, { onDelete: "cascade" }),
  centro: integer("Centro").$type<CentroTrabajo>().notNull(),
  numerosL: text("NumerosL"),
  numerosV: text("NumerosV"),
  numerosS: text("NumerosS"),
  numerosF: text("NumerosF"),
  numerosR: text("NumerosR"),
  limpiezasMes: integer("LimpiezasMes").notNull(),
  pagarPlusViaje: boolean("PagarPlusViaje").notNull(),
  importePlusViaje: numeric("ImportePlusViaje").notNull(),
  ...auditoria(),
}, (t) => [index("IX_OpcionesCentro_ConvenioId").on(t.convenioId)]);

export const tablasSalariales = pgTable("TablasSalariales", {
  id: id(),
  convenioId: integer("ConvenioId").notNull().references(() => convenios.id, { onDelete: "cascade" }),
  categoria: integer("Categoria").$type<CategoriaTrabajador>().notNull(),
  sueldoBaseDiario: numeric("SueldoBaseDiario").notNull(),
  sueldoBaseMensual: numeric("SueldoBaseMensual").notNull(),
  sueldoBaseAnual: numeric("SueldoBaseAnual").notNull(),
  complementoSalarial: numeric("ComplementoSalarial").notNull(),
  baseAntiguedad: numeric("BaseAntiguedad").notNull(),
  precioHoraExtra: numeric("PrecioHoraExtra").notNull(),
  precioQuebrantoMoneda: numeric("PrecioQuebrantoMoneda").notNull(),
  pagaSeptiembre: numeric("PagaSeptiembre").notNull(),
  importeDndCobrado: numeric("ImporteDndCobrado").notNull(),
  seguroAccidentes: numeric("SeguroAccidentes").notNull(),
  porcentajeSeguridadSocial: numeric("PorcentajeSeguridadSocial").notNull(),
  porcentajeDesempleo: numeric("PorcentajeDesempleo").notNull(),
  ...auditoria(),
}, (t) => [index("IX_TablasSalariales_ConvenioId").on(t.convenioId)]);

export const festivos = pgTable("Festivos", {
  id: id(),
  opcionesCentroId: integer("OpcionesCentroId").notNull().references(() => opcionesCentro.id, { onDelete: "cascade" }),
  fecha: timestamp("Fecha", { mode: "string" }).notNull(),
  ...auditoria(),
}, (t) => [index("IX_Festivos_OpcionesCentroId").on(t.opcionesCentroId)]);

/**
 * Los tres servicios de un día del calendario comparten las mismas columnas
 * (Horario + Servicio) con los prefijos Anual / Trabajado / Virtual.
 * Se escriben con claves LITERALES por servicio: las claves calculadas tipo
 * `[`${p}X`]` colisionan entre los tres spreads y drizzle pierde estos campos
 * en `$inferInsert`/`$inferSelect`.
 */
function servicioAnual() {
  const p = "Anual" as const;
  return {
    AnualIncidencia: integer(`${p}Incidencia`).$type<Incidencia>().notNull(),
    AnualCodigo: integer(`${p}Codigo`).$type<CodigoIncidencia>().notNull(),
    AnualPlusPaqueteria: numeric(`${p}PlusPaqueteria`).notNull(),
    AnualFacturadoPaqueteria: numeric(`${p}FacturadoPaqueteria`).notNull(),
    AnualLimpieza: numeric(`${p}Limpieza`).notNull(),
    AnualPlusMenorDescanso: numeric(`${p}PlusMenorDescanso`).notNull(),
    AnualNoCalcular: boolean(`${p}NoCalcular`).notNull(),
    AnualCategoria: integer(`${p}Categoria`).$type<CategoriaGrafico>().notNull(),
    AnualNumero: integer(`${p}Numero`).notNull(),
    AnualTipoDia: integer(`${p}TipoDia`).$type<TipoDia>().notNull(),
    AnualTurno: integer(`${p}Turno`).$type<Turno>().notNull(),
    AnualInicio: interval(`${p}Inicio`),
    AnualFinal: interval(`${p}Final`),
    AnualInicioPartido: interval(`${p}InicioPartido`),
    AnualFinalPartido: interval(`${p}FinalPartido`),
    AnualValoracion: interval(`${p}Valoracion`).notNull(),
    AnualTiempoTotal: interval(`${p}TiempoTotal`).notNull(),
    AnualTiempoPartido: interval(`${p}TiempoPartido`).notNull(),
    AnualTrabajadas: interval(`${p}Trabajadas`).notNull(),
    AnualTrabajadasConvenio: interval(`${p}TrabajadasConvenio`).notNull(),
    AnualTiempoVacio: interval(`${p}TiempoVacio`).notNull(),
    AnualAcumuladas: interval(`${p}Acumuladas`).notNull(),
    AnualNocturnas: interval(`${p}Nocturnas`).notNull(),
    AnualDesayuno: numeric(`${p}Desayuno`).notNull(),
    AnualComida: numeric(`${p}Comida`).notNull(),
    AnualCena: numeric(`${p}Cena`).notNull(),
    AnualTienePlusPaqueteria: boolean(`${p}TienePlusPaqueteria`).notNull(),
  };
}

function servicioTrabajado() {
  const p = "Trabajado" as const;
  return {
    TrabajadoIncidencia: integer(`${p}Incidencia`).$type<Incidencia>().notNull(),
    TrabajadoCodigo: integer(`${p}Codigo`).$type<CodigoIncidencia>().notNull(),
    TrabajadoPlusPaqueteria: numeric(`${p}PlusPaqueteria`).notNull(),
    TrabajadoFacturadoPaqueteria: numeric(`${p}FacturadoPaqueteria`).notNull(),
    TrabajadoLimpieza: numeric(`${p}Limpieza`).notNull(),
    TrabajadoPlusMenorDescanso: numeric(`${p}PlusMenorDescanso`).notNull(),
    TrabajadoNoCalcular: boolean(`${p}NoCalcular`).notNull(),
    TrabajadoCategoria: integer(`${p}Categoria`).$type<CategoriaGrafico>().notNull(),
    TrabajadoNumero: integer(`${p}Numero`).notNull(),
    TrabajadoTipoDia: integer(`${p}TipoDia`).$type<TipoDia>().notNull(),
    TrabajadoTurno: integer(`${p}Turno`).$type<Turno>().notNull(),
    TrabajadoInicio: interval(`${p}Inicio`),
    TrabajadoFinal: interval(`${p}Final`),
    TrabajadoInicioPartido: interval(`${p}InicioPartido`),
    TrabajadoFinalPartido: interval(`${p}FinalPartido`),
    TrabajadoValoracion: interval(`${p}Valoracion`).notNull(),
    TrabajadoTiempoTotal: interval(`${p}TiempoTotal`).notNull(),
    TrabajadoTiempoPartido: interval(`${p}TiempoPartido`).notNull(),
    TrabajadoTrabajadas: interval(`${p}Trabajadas`).notNull(),
    TrabajadoTrabajadasConvenio: interval(`${p}TrabajadasConvenio`).notNull(),
    TrabajadoTiempoVacio: interval(`${p}TiempoVacio`).notNull(),
    TrabajadoAcumuladas: interval(`${p}Acumuladas`).notNull(),
    TrabajadoNocturnas: interval(`${p}Nocturnas`).notNull(),
    TrabajadoDesayuno: numeric(`${p}Desayuno`).notNull(),
    TrabajadoComida: numeric(`${p}Comida`).notNull(),
    TrabajadoCena: numeric(`${p}Cena`).notNull(),
    TrabajadoTienePlusPaqueteria: boolean(`${p}TienePlusPaqueteria`).notNull(),
  };
}

function servicioVirtual() {
  const p = "Virtual" as const;
  return {
    VirtualIncidencia: integer(`${p}Incidencia`).$type<Incidencia>().notNull(),
    VirtualCodigo: integer(`${p}Codigo`).$type<CodigoIncidencia>().notNull(),
    VirtualPlusPaqueteria: numeric(`${p}PlusPaqueteria`).notNull(),
    VirtualFacturadoPaqueteria: numeric(`${p}FacturadoPaqueteria`).notNull(),
    VirtualLimpieza: numeric(`${p}Limpieza`).notNull(),
    VirtualPlusMenorDescanso: numeric(`${p}PlusMenorDescanso`).notNull(),
    VirtualNoCalcular: boolean(`${p}NoCalcular`).notNull(),
    VirtualCategoria: integer(`${p}Categoria`).$type<CategoriaGrafico>().notNull(),
    VirtualNumero: integer(`${p}Numero`).notNull(),
    VirtualTipoDia: integer(`${p}TipoDia`).$type<TipoDia>().notNull(),
    VirtualTurno: integer(`${p}Turno`).$type<Turno>().notNull(),
    VirtualInicio: interval(`${p}Inicio`),
    VirtualFinal: interval(`${p}Final`),
    VirtualInicioPartido: interval(`${p}InicioPartido`),
    VirtualFinalPartido: interval(`${p}FinalPartido`),
    VirtualValoracion: interval(`${p}Valoracion`).notNull(),
    VirtualTiempoTotal: interval(`${p}TiempoTotal`).notNull(),
    VirtualTiempoPartido: interval(`${p}TiempoPartido`).notNull(),
    VirtualTrabajadas: interval(`${p}Trabajadas`).notNull(),
    VirtualTrabajadasConvenio: interval(`${p}TrabajadasConvenio`).notNull(),
    VirtualTiempoVacio: interval(`${p}TiempoVacio`).notNull(),
    VirtualAcumuladas: interval(`${p}Acumuladas`).notNull(),
    VirtualNocturnas: interval(`${p}Nocturnas`).notNull(),
    VirtualDesayuno: numeric(`${p}Desayuno`).notNull(),
    VirtualComida: numeric(`${p}Comida`).notNull(),
    VirtualCena: numeric(`${p}Cena`).notNull(),
    VirtualTienePlusPaqueteria: boolean(`${p}TienePlusPaqueteria`).notNull(),
  };
}

export const calendarios = pgTable(
  "Calendarios",
  {
    id: id(),
    conductorId: integer("ConductorId").notNull().references(() => conductores.id, { onDelete: "cascade" }),
    centro: integer("Centro").$type<CentroTrabajo>().notNull(),
    fecha: timestamp("Fecha", { mode: "string" }).notNull(),
    totalImportePlusSabados: numeric("TotalImportePlusSabados").notNull(),
    totalImportePlusFestivos: numeric("TotalImportePlusFestivos").notNull(),
    totalImportePlusNocturnidad: numeric("TotalImportePlusNocturnidad").notNull(),
    totalImportePlusNocturnidadParcial: numeric("TotalImportePlusNocturnidadParcial").notNull(),
    totalImportePlusPaqueteria: numeric("TotalImportePlusPaqueteria").notNull(),
    totalImportePlusLimpieza: numeric("TotalImportePlusLimpieza").notNull(),
    totalImportePlusMenorDescanso: numeric("TotalImportePlusMenorDescanso").notNull(),
    totalImportePlusNavidad: numeric("TotalImportePlusNavidad").notNull(),
    totalImportePlusViaje: numeric("TotalImportePlusViaje").notNull(),
    totalQuebrantoMoneda: numeric("TotalQuebrantoMoneda").notNull(),
    totalRefuerzos: numeric("TotalRefuerzos").notNull(),
    totalImporteDietas: numeric("TotalImporteDietas").notNull(),
    totalDcsPendientes: numeric("TotalDcsPendientes").notNull(),
    totalDndsPendientes: numeric("TotalDndsPendientes").notNull(),
    totalImporteDndsCobrados: numeric("TotalImporteDndsCobrados").notNull(),
    ...auditoria(),
  },
  (t) => [uniqueIndex("IX_Calendarios_ConductorId_Fecha").on(t.conductorId, t.fecha)],
);

export const diasCalendario = pgTable(
  "DiasCalendario",
  {
    id: id(),
    calendarioId: integer("CalendarioId").notNull().references(() => calendarios.id, { onDelete: "cascade" }),
    fecha: timestamp("Fecha", { mode: "string" }).notNull(),
    esFestivo: boolean("EsFestivo").notNull(),
    ...servicioAnual(),
    ...servicioTrabajado(),
    ...servicioVirtual(),
    notas: text("Notas"),
    vehiculos: text("Vehiculos"),
    refuerzos: integer("Refuerzos").notNull(),
    dndCobrado: boolean("DndCobrado").notNull(),
    dndsCobradosPorDescanso: numeric("DndsCobradosPorDescanso").notNull(),
    isRemoteUpdated: boolean("IsRemoteUpdated").notNull(),
    ...auditoria(),
  },
  (t) => [uniqueIndex("IX_DiasCalendario_CalendarioId_Fecha").on(t.calendarioId, t.fecha)],
);

export const resumenes = pgTable(
  "Resumenes",
  {
    id: id(),
    calendarioId: integer("CalendarioId").notNull().references(() => calendarios.id, { onDelete: "cascade" }),
    ...contadoresResumen(),
    ...auditoria(),
  },
  (t) => [uniqueIndex("IX_Resumenes_CalendarioId").on(t.calendarioId)],
);

/** Contadores del resumen mensual (REGLAS-CALCULO.md 12.1/12.2/12.3). */
function contadoresResumen() {
  return {
    diasActivo: integer("DiasActivo").notNull(),
    diasInactivo: integer("DiasInactivo").notNull(),
    diasTrabajo: integer("DiasTrabajo").notNull(),
    diasTrabajoJD: integer("DiasTrabajoJD").notNull(),
    diasTrabajoFN: integer("DiasTrabajoFN").notNull(),
    diasOV: integer("DiasOV").notNull(),
    diasJD: integer("DiasJD").notNull(),
    diasFN: integer("DiasFN").notNull(),
    diasE: integer("DiasE").notNull(),
    diasDS: integer("DiasDS").notNull(),
    diasDC: integer("DiasDC").notNull(),
    diasF6: integer("DiasF6").notNull(),
    diasF6D: integer("DiasF6D").notNull(),
    diasDND: integer("DiasDND").notNull(),
    diasDF: integer("DiasDF").notNull(),
    diasPER: integer("DiasPER").notNull(),
    diasEJD: integer("DiasEJD").notNull(),
    diasEFN: integer("DiasEFN").notNull(),
    diasOVJD: integer("DiasOVJD").notNull(),
    diasOVFN: integer("DiasOVFN").notNull(),
    diasF6DC: integer("DiasF6DC").notNull(),
    diasFOR: integer("DiasFOR").notNull(),
    diasFORJD: integer("DiasFORJD").notNull(),
    diasFORFN: integer("DiasFORFN").notNull(),
    diasOVA: integer("DiasOVA").notNull(),
    diasOVAJD: integer("DiasOVAJD").notNull(),
    diasOVAFN: integer("DiasOVAFN").notNull(),
    diasLAC: integer("DiasLAC").notNull(),
    diasLACJD: integer("DiasLACJD").notNull(),
    diasLACFN: integer("DiasLACFN").notNull(),
    diasCO: integer("DiasCO").notNull(),
    diasCE: integer("DiasCE").notNull(),
    diasRE: integer("DiasRE").notNull(),
    diasHorasSindicales: integer("DiasHorasSindicales").notNull(),
    diasComiteJD: integer("DiasComiteJD").notNull(),
    diasComiteDC: integer("DiasComiteDC").notNull(),
    sabadosTrabajados: integer("SabadosTrabajados").notNull(),
    sabadosDescansados: integer("SabadosDescansados").notNull(),
    domingosTrabajados: integer("DomingosTrabajados").notNull(),
    domingosDescansados: integer("DomingosDescansados").notNull(),
    festivosTrabajados: integer("FestivosTrabajados").notNull(),
    festivosDescansados: integer("FestivosDescansados").notNull(),
    diasTurno1: integer("DiasTurno1").notNull(),
    diasTurno2: integer("DiasTurno2").notNull(),
    diasTurno3: integer("DiasTurno3").notNull(),
    diasTurno4: integer("DiasTurno4").notNull(),
    diasConRefuerzo: integer("DiasConRefuerzo").notNull(),
    findesCompletos: numeric("FindesCompletos").notNull(),
    diasDeberiaTrabajar: numeric("DiasDeberiaTrabajar").notNull(),
    diasDeberiaDescansar: numeric("DiasDeberiaDescansar").notNull(),
    diasDeberiaVacaciones: numeric("DiasDeberiaVacaciones").notNull(),
    horasTrabajadas: interval("HorasTrabajadas").notNull(),
    horasTrabajadasConvenio: interval("HorasTrabajadasConvenio").notNull(),
    horasAcumuladas: interval("HorasAcumuladas").notNull(),
    horasAcumuladasVirtual: interval("HorasAcumuladasVirtual").notNull(),
    horasNocturnas: interval("HorasNocturnas").notNull(),
    desayunos: numeric("Desayunos").notNull(),
    desayunosVirtual: numeric("DesayunosVirtual").notNull(),
    comidas: numeric("Comidas").notNull(),
    comidasVirtual: numeric("ComidasVirtual").notNull(),
    cenas: numeric("Cenas").notNull(),
    cenasVirtual: numeric("CenasVirtual").notNull(),
    totalDietas: numeric("TotalDietas").notNull(),
    totalDietasVirtual: numeric("TotalDietasVirtual").notNull(),
    diasConPlusPaqueteria: integer("DiasConPlusPaqueteria").notNull(),
    facturadoPaqueteria: numeric("FacturadoPaqueteria").notNull(),
    plusesPaqueteria: numeric("PlusesPaqueteria").notNull(),
    plusesMenorDescanso: numeric("PlusesMenorDescanso").notNull(),
    limpiezas: numeric("Limpiezas").notNull(),
    totalLimpiezas: numeric("TotalLimpiezas").notNull(),
    importeDietas: numeric("ImporteDietas").notNull(),
    importeDietasVirtual: numeric("ImporteDietasVirtual").notNull(),
    importePlusSabados: numeric("ImportePlusSabados").notNull(),
    importePlusFestivos: numeric("ImportePlusFestivos").notNull(),
    importePlusPaqueteria: numeric("ImportePlusPaqueteria").notNull(),
    importePlusLimpieza: numeric("ImportePlusLimpieza").notNull(),
    importePlusMenorDescanso: numeric("ImportePlusMenorDescanso").notNull(),
    importePlusNocturnidad: numeric("ImportePlusNocturnidad").notNull(),
    importePlusNocturnidadParcial: numeric("ImportePlusNocturnidadParcial").notNull(),
    importePlusNavidad: numeric("ImportePlusNavidad").notNull(),
    importePlusViaje: numeric("ImportePlusViaje").notNull(),
    importeQuebrantoMoneda: numeric("ImporteQuebrantoMoneda").notNull(),
    importeVariableVacaciones: numeric("ImporteVariableVacaciones").notNull(),
    importeRefuerzos: numeric("ImporteRefuerzos").notNull(),
    errores: text("Errores").notNull(),
    totalDndsCobrados: integer("TotalDndsCobrados").notNull(),
    importeDndsCobrados: numeric("ImporteDndsCobrados").notNull(),
    totalDndsCobradosPorDescanso: numeric("TotalDndsCobradosPorDescanso").notNull(),
    importeDndsCobradosPorDescanso: numeric("ImporteDndsCobradosPorDescanso").notNull(),
  };
}

export const nominas = pgTable("Nominas", {
  id: id(),
  conductorId: integer("ConductorId").notNull().references(() => conductores.id, { onDelete: "cascade" }),
  tipoNomina: integer("TipoNomina").$type<TipoNomina>().notNull(),
  fecha: timestamp("Fecha", { mode: "string" }).notNull(),
  fechaInicio: timestamp("FechaInicio", { mode: "string" }).notNull(),
  fechaFinal: timestamp("FechaFinal", { mode: "string" }).notNull(),
  fechaAntiguedad: timestamp("FechaAntiguedad", { mode: "string" }).notNull(),
  porcentajeIrpf: numeric("PorcentajeIrpf").notNull(),
  porcentajeSeguridadSocial: numeric("PorcentajeSeguridadSocial").notNull(),
  porcentajeDesempleo: numeric("PorcentajeDesempleo").notNull(),
  baseIrpf: numeric("BaseIrpf").notNull(),
  prorrateoPagas: numeric("ProrrateoPagas").notNull(),
  baseSeguridadSocial: numeric("BaseSeguridadSocial").notNull(),
  descuentoIrpf: numeric("DescuentoIrpf").notNull(),
  descuentoSeguridadSocial: numeric("DescuentoSeguridadSocial").notNull(),
  descuentoDesempleo: numeric("DescuentoDesempleo").notNull(),
  totalDevengado: numeric("TotalDevengado").notNull(),
  totalDeducciones: numeric("TotalDeducciones").notNull(),
  totalLiquido: numeric("TotalLiquido").notNull(),
  ...auditoria(),
}, (t) => [index("IX_Nominas_ConductorId_Fecha_TipoNomina").on(t.conductorId, t.fecha, t.tipoNomina)]);

export const conceptosNomina = pgTable("ConceptosNomina", {
  id: id(),
  nominaId: integer("NominaId").notNull().references(() => nominas.id, { onDelete: "cascade" }),
  tipoConceptoNomina: integer("TipoConceptoNomina").$type<TipoConceptoNomina>().notNull(),
  codigo: integer("Codigo").notNull(),
  computaParaIrpf: boolean("ComputaParaIrpf").notNull(),
  textoConcepto: text("TextoConcepto").notNull(),
  unidades: numeric("Unidades").notNull(),
  importeBase: numeric("ImporteBase").notNull(),
  devengado: numeric("Devengado").notNull(),
  deduccion: numeric("Deduccion").notNull(),
  ...auditoria(),
}, (t) => [index("IX_ConceptosNomina_NominaId").on(t.nominaId)]);

export const reclamaciones = pgTable(
  "Reclamaciones",
  {
    id: id(),
    conductorId: integer("ConductorId").notNull().references(() => conductores.id, { onDelete: "cascade" }),
    fecha: timestamp("Fecha", { mode: "string" }).notNull(),
    fechaEfecto: timestamp("FechaEfecto", { mode: "string" }).notNull(),
    codigo: text("Codigo"),
    notas: text("Notas"),
    notaInterna: text("NotaInterna"),
    cerrada: boolean("Cerrada").notNull(),
    ...auditoria(),
  },
  (t) => [uniqueIndex("IX_Reclamaciones_ConductorId_Fecha").on(t.conductorId, t.fecha)],
);

export const conceptosReclamados = pgTable("ConceptosReclamados", {
  id: id(),
  reclamacionId: integer("ReclamacionId").notNull().references(() => reclamaciones.id, { onDelete: "cascade" }),
  fecha: timestamp("Fecha", { mode: "string" }).notNull(),
  tipo: integer("Tipo").$type<TipoReclamacion>().notNull(),
  descripcion: text("Descripcion"),
  graficoTrabajado: integer("GraficoTrabajado").notNull(),
  horasReales: interval("HorasReales").notNull(),
  horasCobradas: interval("HorasCobradas").notNull(),
  importeReal: numeric("ImporteReal").notNull(),
  importeCobrado: numeric("ImporteCobrado").notNull(),
  incidenciasReales: integer("IncidenciasReales").notNull(),
  incidenciasCobradas: integer("IncidenciasCobradas").notNull(),
  importeTotal: numeric("ImporteTotal").notNull(),
  resuelto: boolean("Resuelto").notNull(),
  ...auditoria(),
}, (t) => [index("IX_ConceptosReclamados_ReclamacionId").on(t.reclamacionId)]);

export const regulaciones = pgTable("Regulaciones", {
  id: id(),
  conductorId: integer("ConductorId").notNull().references(() => conductores.id, { onDelete: "cascade" }),
  tipo: integer("Tipo").$type<TipoRegulacion>().notNull(),
  fecha: timestamp("Fecha", { mode: "string" }).notNull(),
  horas: interval("Horas").notNull(),
  dcs: numeric("Dcs").notNull(),
  dnds: numeric("Dnds").notNull(),
  motivo: text("Motivo"),
  ...auditoria(),
}, (t) => [index("IX_Regulaciones_ConductorId").on(t.conductorId)]);

export const graficos = pgTable("Graficos", {
  id: id(),
  centro: integer("Centro").$type<CentroTrabajo>().notNull(),
  fecha: timestamp("Fecha", { mode: "string" }).notNull(),
  plusCena: numeric("PlusCena").notNull(),
  tieneErrorTiempoPartido: boolean("TieneErrorTiempoPartido").notNull(),
  modifiedDate: timestamp("ModifiedDate", { mode: "string" }).notNull(),
  modifiedBy: integer("ModifiedBy").notNull(),
  noCalcular: boolean("NoCalcular").notNull(),
  categoria: integer("Categoria").$type<CategoriaGrafico>().notNull(),
  numero: integer("Numero").notNull(),
  tipoDia: integer("TipoDia").$type<TipoDia>().notNull(),
  turno: integer("Turno").$type<Turno>().notNull(),
  inicio: interval("Inicio"),
  final: interval("Final"),
  inicioPartido: interval("InicioPartido"),
  finalPartido: interval("FinalPartido"),
  valoracion: interval("Valoracion").notNull(),
  tiempoTotal: interval("TiempoTotal").notNull(),
  tiempoPartido: interval("TiempoPartido").notNull(),
  trabajadas: interval("Trabajadas").notNull(),
  trabajadasConvenio: interval("TrabajadasConvenio").notNull(),
  tiempoVacio: interval("TiempoVacio").notNull(),
  acumuladas: interval("Acumuladas").notNull(),
  nocturnas: interval("Nocturnas").notNull(),
  desayuno: numeric("Desayuno").notNull(),
  comida: numeric("Comida").notNull(),
  cena: numeric("Cena").notNull(),
  tienePlusPaqueteria: boolean("TienePlusPaqueteria").notNull(),
}, (t) => [index("IX_Graficos_Centro_Fecha_Numero").on(t.centro, t.fecha, t.numero)]);

export const itinerariosGraficos = pgTable("ItinerariosGraficos", {
  id: id(),
  graficoId: integer("GraficoId").notNull().references(() => graficos.id, { onDelete: "cascade" }),
  inicio: interval("Inicio"),
  itinerario: text("Itinerario"),
  descripcion: text("Descripcion"),
  final: interval("Final"),
  tiempoTotal: interval("TiempoTotal").notNull(),
  ...auditoria(),
}, (t) => [index("IX_ItinerariosGraficos_GraficoId").on(t.graficoId)]);

export const lineas = pgTable("Lineas", {
  id: id(),
  nombre: text("Nombre").notNull(),
  descripcion: text("Descripcion"),
  ...auditoria(),
});

export const itinerarios = pgTable("Itinerarios", {
  id: id(),
  lineaId: integer("LineaId").notNull().references(() => lineas.id, { onDelete: "cascade" }),
  nombre: text("Nombre").notNull(),
  descripcion: text("Descripcion"),
  tiempoReal: integer("TiempoReal").notNull(),
  tiempoPago: integer("TiempoPago").notNull(),
  ...auditoria(),
}, (t) => [index("IX_Itinerarios_LineaId").on(t.lineaId)]);

export const paradas = pgTable("Paradas", {
  id: id(),
  itinerarioId: integer("ItinerarioId").notNull().references(() => itinerarios.id, { onDelete: "cascade" }),
  orden: integer("Orden").notNull(),
  descripcion: text("Descripcion"),
  tiempo: interval("Tiempo").notNull(),
  ...auditoria(),
}, (t) => [index("IX_Paradas_ItinerarioId").on(t.itinerarioId)]);
