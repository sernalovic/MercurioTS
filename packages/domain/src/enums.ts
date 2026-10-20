/**
 * Port de `Mercurio.Domain/Enums.cs`.
 * IMPORTANTE: los valores numéricos coinciden con los del sistema original
 * (orden de declaración) para que los datos migrados conserven su significado.
 */

export enum CentroTrabajo {
  Todos = 0, Donosti = 1, Bilbao = 2, Arrasate = 3, Vitoria = 4, Pruebas = 5,
}

export enum CategoriaTrabajador { Conductor = 0, ConductorFormacion = 1, Taquilla = 2 }

export enum CategoriaGrafico { Conduccion = 0, Taquilla = 1 }

export enum SituacionTrabajador { Fijo = 0, Eventual = 1, Inactivo = 2, FijoInaplicacion = 3 }

export enum Turno { SinTurno = 0, Manana = 1, Tarde = 2, Noche = 3, Partido = 4 }

export enum TipoDia { Ninguno = 0, LunesJueves = 1, Viernes = 2, Sabado = 3, Festivo = 4, Reserva = 5, ReduccionJornada = 6 }

export enum Incidencia {
  Inactivo = 0, Trabajo = 1, TrabajoJD = 2, TrabajoFN = 3, JD = 4, FN = 5, DS = 6, DND = 7, DC = 8, F6 = 9,
  F6DC = 10, PER = 11, OV = 12, OVJD = 13, OVFN = 14, E = 15, EJD = 16, EFN = 17, FOR = 18, FORJD = 19,
  FORFN = 20, OVA = 21, OVAJD = 22, OVAFN = 23, LAC = 24, LACJD = 25, LACFN = 26, RE = 27, DF = 28, F6D = 29,
}

export enum CodigoIncidencia { Ninguno = 0, Comite = 1, ComiteEmpresa = 2, HorasSindicales = 3 }

export enum TipoServicio { Anual = 0, Trabajado = 1, Virtual = 2 }

export enum TipoRegulacion { Manual = 0, HorasCobradas = 1, RegulacionAnual = 2 }

export enum TipoNomina { Mensual = 0, PagaExtra = 1, Atrasos = 2 }

export enum TipoConceptoNomina {
  SalarioBase = 0, Antiguedad = 1, ComplementoSalarial = 2, QuebrantoMoneda = 3, PlusViaje = 4, PlusSabados = 5,
  PlusFestivos = 6, Dietas = 7, PlusNocturnidad = 8, PlusNocturnidadParcial = 9, PlusPaqueteria = 10,
  PlusLimpieza = 11, PlusMenorDescanso = 12, PlusNavidad = 13, Refuerzos = 14, DndsCobrados = 15,
  SeguroAccidentes = 16, VariablesVacaciones = 17,
}

export enum TipoReclamacion {
  TotalDc = 0, TotalDnd = 1, Grafico = 2, HorasTrabajadas = 3, HorasAcumuladas = 4, DietaDesayuno = 5,
  DietaComida = 6, DietaCena = 7, PlusSabados = 8, PlusFestivos = 9, PlusPaqueteria = 10, PlusLimpieza = 11,
  PlusMenorDescanso = 12, PlusNocturnidad = 13, PlusNocturnidadParcial = 14, PlusNavidad = 15, PlusViaje = 16,
  DndsCobrados = 17, QuebrantoMoneda = 18, Refuerzos = 19, Descanso = 20, Enfermo = 21, DC = 22, DND = 23,
  F6 = 24, OtraHoras = 25, OtraImporte = 26,
}
