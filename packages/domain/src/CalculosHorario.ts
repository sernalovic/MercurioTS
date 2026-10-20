/**
 * Port de `Mercurio.Domain/Calculos/CalculosHorario.cs`.
 * Cálculo de horas, dietas y pluses de gráficos y servicios según el convenio
 * vigente (REGLAS-CALCULO.md 1–5 y 6.4).
 *
 * Diferencias de representación frente a C#:
 * - `TimeSpan` → minutos (`Horas.ts`); `TimeSpan?` → `number | null`.
 * - `decimal` de unidades de dietas → `number`; importes monetarios → céntimos.
 * - Las propiedades que se pueden editar (`CambiarPropiedad`) se nombran en
 *   minúscula inicial: "inicio", "final", "turno", "inicioPartido",
 *   "finalPartido", "tienePlusPaqueteria", "facturadoPaqueteria",
 *   "incidencia", "numero".
 */
import { Convenio, DiaCalendario, Grafico, Horario, Servicio, clonarServicio, nuevoServicio } from "./Entidades";
import * as Horas from "./Horas";
import { esTrabajo } from "./Incidencias";
import { CentroTrabajo, Incidencia, TipoDia, Turno } from "./enums";
import { RangoNumeros } from "./Rango";

const PorcentajePaqueteriaFacturada = 0.1;

export class CalculosHorario {
  readonly convenio: Convenio | null;

  constructor(convenio: Convenio | null = null) {
    this.convenio = convenio;
  }

  private static turnoCalculable(turno: Turno): boolean {
    return turno >= Turno.Manana && turno <= Turno.Partido;
  }

  // ---- 1 Duraciones ----

  trabajadas(
    inicio: number | null, final: number | null,
    inicioPartido: number | null, finalPartido: number | null,
  ): number {
    if (this.convenio === null) return 0;
    const total = Horas.Duracion(inicio, final);
    const partido = Horas.Duracion(inicioPartido, finalPartido);
    const exceso = partido > this.convenio.tiempoPartidoMaximo ? partido - this.convenio.tiempoPartidoMaximo : 0;
    return total - partido + exceso;
  }

  trabajadasConvenio(trabajadas: number): number {
    return this.convenio === null ? 0 : Horas.Max(trabajadas, this.convenio.jornadaMedia);
  }

  acumuladas(trabajadas: number): number {
    return this.convenio === null ? 0 : Horas.Max(0, trabajadas - this.convenio.jornadaMedia);
  }

  nocturnas(inicio: number | null, final: number | null, turno: Turno): number {
    if (this.convenio === null || !CalculosHorario.turnoCalculable(turno) || inicio === null || final === null) {
      return 0;
    }
    const fin = final < inicio ? final + Horas.UN_DIA : final;
    // El original no calcula nocturnas en el turno de noche.
    if (turno === Turno.Noche) return 0;
    let nocturnas = 0;
    if (inicio < this.convenio.finalNocturnas) nocturnas = this.convenio.finalNocturnas - inicio;
    if (fin > this.convenio.inicioNocturnas) nocturnas = fin - this.convenio.inicioNocturnas;
    return nocturnas;
  }

  // ---- 1 Dietas ----

  desayuno(inicio: number | null, turno: Turno): number {
    if (this.convenio === null || turno !== Turno.Manana || inicio === null) return 0;
    return inicio < this.convenio.limiteDesayuno ? Horas.EnHoras(this.convenio.limiteDesayuno - inicio) : 0;
  }

  comida(
    inicio: number | null, final: number | null, turno: Turno,
    inicioPartido: number | null, finalPartido: number | null,
  ): number {
    if (!CalculosHorario.turnoCalculable(turno) || turno === Turno.Noche) return 0;
    if (turno === Turno.Partido) {
      return this.comidaCompleta(inicioPartido, finalPartido, turno)
        + this.comidaParcial(inicioPartido, finalPartido, turno);
    }
    return this.comidaCompleta(inicio, final, turno) + this.comidaParcial(inicio, final, turno);
  }

  comidaCompleta(inicio: number | null, final: number | null, turno: Turno): number {
    if (this.convenio === null || !CalculosHorario.turnoCalculable(turno) || inicio === null || final === null) {
      return 0;
    }
    const c0 = this.convenio.inicioComidaContinuo;
    const c1 = this.convenio.finalComidaContinuo;
    let comida = 0;
    if (turno === Turno.Manana && final > c1) comida = 1;
    if (turno === Turno.Tarde && inicio > 180 && inicio < c0) comida = 1;
    if (turno < Turno.Noche && final > c1 && inicio < c0) comida += 1;
    if (turno === Turno.Partido && this.tiempoPartidoEnComida(inicio, final) < 60) comida = 1;
    return comida;
  }

  comidaParcial(inicio: number | null, final: number | null, turno: Turno): number {
    if (this.convenio === null || !CalculosHorario.turnoCalculable(turno) || inicio === null || final === null) {
      return 0;
    }
    const c0 = this.convenio.inicioComidaContinuo;
    let comida = 0;
    if (turno === Turno.Tarde) {
      if (inicio === c0) comida = 0.5;
      else if (inicio >= c0 + 5 && inicio < c0 + 30) comida = Horas.EnHoras(c0 + 30 - inicio) / 2;
    }
    if (turno === Turno.Partido) {
      const partido = this.tiempoPartidoEnComida(inicio, final);
      if (partido >= 60 && partido < 120) comida = Horas.EnHoras(120 - partido);
      else if (partido > 0 && partido < 60) comida = Horas.EnHoras(60 - partido);
    }
    return comida;
  }

  /** Minutos de la partición que caen dentro de la ventana de comida de jornada partida. */
  tiempoPartidoEnComida(inicioPartido: number | null, finalPartido: number | null): number {
    if (this.convenio === null || inicioPartido === null || finalPartido === null) return 0;
    const desde = this.convenio.inicioComidaPartido;
    const hasta = this.convenio.finalComidaPartido;
    const fin = finalPartido < inicioPartido ? finalPartido + Horas.UN_DIA : finalPartido;
    let minutos = 0;
    for (let m = inicioPartido; m < fin; m++) if (m >= desde && m < hasta) minutos++;
    return minutos;
  }

  cena(inicio: number | null, final: number | null, turno: Turno): number {
    if (this.convenio === null || !CalculosHorario.turnoCalculable(turno) || turno === Turno.Noche
      || inicio === null || final === null) return 0;
    let desde = this.convenio.inicioCena;
    let hasta = this.convenio.finalCena;
    const fin = final < inicio ? final + Horas.UN_DIA : final;
    if (hasta < desde) hasta += Horas.UN_DIA;
    if (fin > desde && fin < hasta) return Horas.EnHoras(fin - desde);
    if (fin >= hasta) return 1;
    return 0;
  }

  plusCena(inicio: number | null, final: number | null, turno: Turno): number {
    if (this.convenio === null || !CalculosHorario.turnoCalculable(turno) || turno === Turno.Noche
      || inicio === null || final === null) return 0;
    let limite = this.convenio.limitePlusCena;
    const fin = final < inicio ? final + Horas.UN_DIA : final;
    if (limite < 360) limite += Horas.UN_DIA;
    const exceso = fin > limite ? Horas.EnHoras(fin - limite) : 0;
    return exceso * (this.convenio.porcentajePlusCena / 100);
  }

  // ---- 1 Recalcular ----

  recalcularServicio(servicio: Servicio | null): void {
    if (servicio === null || servicio.noCalcular) return;
    if (!CalculosHorario.turnoCalculable(servicio.turno) || servicio.inicio === null || servicio.final === null) {
      servicio.tiempoTotal = servicio.tiempoPartido = servicio.trabajadas = servicio.trabajadasConvenio = 0;
      servicio.acumuladas = servicio.nocturnas = 0;
      servicio.desayuno = servicio.comida = servicio.cena = servicio.plusPaqueteria = 0;
      return;
    }
    this.aplicarPaqueteria(servicio);
    this.calcularComun(servicio);
    servicio.cena = this.cena(servicio.inicio, servicio.final, servicio.turno)
      + this.plusCena(servicio.inicio, servicio.final, servicio.turno);
  }

  recalcularGrafico(grafico: Grafico | null): void {
    if (grafico === null || grafico.noCalcular) return;
    if (!CalculosHorario.turnoCalculable(grafico.turno) || grafico.inicio === null || grafico.final === null) return;
    this.calcularComun(grafico);
    grafico.cena = this.cena(grafico.inicio, grafico.final, grafico.turno);
    grafico.plusCena = this.plusCena(grafico.inicio, grafico.final, grafico.turno);
    // El original solo activaba el indicador y nunca lo desactivaba; aquí se recalcula en cada pasada.
    grafico.tieneErrorTiempoPartido = this.convenio !== null
      && (grafico.tiempoPartido > this.convenio.tiempoPartidoMaximo
        || grafico.tiempoTotal > this.convenio.jornadaMaximaPartida);
  }

  private calcularComun(h: Horario): void {
    h.tiempoTotal = Horas.Duracion(h.inicio, h.final);
    h.tiempoPartido = Horas.Duracion(h.inicioPartido, h.finalPartido);
    h.trabajadas = this.trabajadas(h.inicio, h.final, h.inicioPartido, h.finalPartido);
    h.trabajadasConvenio = this.trabajadasConvenio(h.trabajadas);
    h.acumuladas = this.acumuladas(h.trabajadas);
    h.nocturnas = this.nocturnas(h.inicio, h.final, h.turno);
    h.desayuno = this.desayuno(h.inicio, h.turno);
    h.comida = this.comida(h.inicio, h.final, h.turno, h.inicioPartido, h.finalPartido);
  }

  private aplicarPaqueteria(s: Servicio): void {
    s.plusPaqueteria = s.tienePlusPaqueteria
      ? this.convenio?.importePlusPaqueteria ?? 0
      : s.facturadoPaqueteria * PorcentajePaqueteriaFacturada;
  }

  // ---- 2 Tipo de día y 3 festivos ----

  private opciones(centro: CentroTrabajo) {
    return this.convenio?.opcionesCentro.find((o) => o.centro === centro);
  }

  tipoDiaGrafico(numero: number, centro: CentroTrabajo): TipoDia {
    const o = this.opciones(centro);
    if (o === undefined) return TipoDia.Ninguno;
    if (new RangoNumeros(o.numerosL).contiene(numero)) return TipoDia.LunesJueves;
    if (new RangoNumeros(o.numerosV).contiene(numero)) return TipoDia.Viernes;
    if (new RangoNumeros(o.numerosS).contiene(numero)) return TipoDia.Sabado;
    if (new RangoNumeros(o.numerosF).contiene(numero)) return TipoDia.Festivo;
    if (new RangoNumeros(o.numerosR).contiene(numero)) return TipoDia.Reserva;
    return TipoDia.Ninguno;
  }

  esFestivo(fecha: string, centro: CentroTrabajo): boolean {
    return centro !== CentroTrabajo.Todos && (this.opciones(centro)?.festivos.some((f) => f.fecha === fecha) ?? false);
  }

  /** `fecha`: "YYYY-MM-DD"; la comparación de mes usa el prefijo "YYYY-MM". */
  festivosEnMes(fecha: string, centro: CentroTrabajo): number {
    if (centro === CentroTrabajo.Todos) return 0;
    const añoMes = fecha.slice(0, "YYYY-MM".length);
    return this.opciones(centro)?.festivos.filter((f) => f.fecha.startsWith(añoMes)).length ?? 0;
  }

  hayFestivos(centro: CentroTrabajo): boolean {
    return centro !== CentroTrabajo.Todos && (this.opciones(centro)?.festivos.length ?? 0) > 0;
  }

  hay14Festivos(centro: CentroTrabajo): boolean {
    return centro !== CentroTrabajo.Todos && (this.opciones(centro)?.festivos.length ?? 0) >= 14;
  }

  // ---- 4 Plus por menor descanso ----

  private plusPorDescanso(inicio: number, turno: Turno, finalAnterior: number): number {
    let siguienteInicio = inicio + Horas.UN_DIA;
    if (turno === Turno.Noche && (siguienteInicio % Horas.UN_DIA) < 3 * 60) siguienteInicio += Horas.UN_DIA;
    if (siguienteInicio < finalAnterior) siguienteInicio += Horas.UN_DIA;
    const descanso = (siguienteInicio - finalAnterior) / 60;
    return descanso < 12
      ? (12 - descanso) * (this.convenio?.importePlusMenorDescanso ?? 0)
      : 0;
  }

  recalcularPlusMenorDescanso(servicio: Servicio, anterior: Servicio | null, siguiente: Servicio | null): void {
    servicio.plusMenorDescanso = 0;
    if (anterior?.final !== null && anterior?.final !== undefined && servicio.inicio !== null) {
      servicio.plusMenorDescanso = this.plusPorDescanso(servicio.inicio, servicio.turno, anterior.final);
    }

    if (siguiente === null) return;
    siguiente.plusMenorDescanso = servicio.final !== null && siguiente.inicio !== null
      ? this.plusPorDescanso(siguiente.inicio, siguiente.turno, servicio.final)
      : 0;
  }

  // ---- 5 Regenerar un día ----

  /** Copia en el servicio el horario y los resultados de un gráfico (conservando incidencia y código). */
  static copiarGrafico(g: Grafico, s: Servicio): void {
    s.noCalcular = g.noCalcular; s.categoria = g.categoria; s.numero = g.numero; s.tipoDia = g.tipoDia;
    s.turno = g.turno; s.inicio = g.inicio; s.final = g.final; s.inicioPartido = g.inicioPartido;
    s.finalPartido = g.finalPartido; s.valoracion = g.valoracion; s.tiempoTotal = g.tiempoTotal;
    s.tiempoPartido = g.tiempoPartido; s.trabajadas = g.trabajadas; s.trabajadasConvenio = g.trabajadasConvenio;
    s.tiempoVacio = g.tiempoVacio; s.acumuladas = g.acumuladas; s.nocturnas = g.nocturnas;
    s.desayuno = g.desayuno; s.comida = g.comida; s.cena = g.cena; s.tienePlusPaqueteria = g.tienePlusPaqueteria;
  }

  private vaciar(s: Servicio): Servicio {
    return nuevoServicio({
      id: s.id, incidencia: s.incidencia, codigo: s.codigo,
    });
  }

  /** Asigna al servicio trabajado su gráfico (o la jornada media si no lo hay) y recalcula la paquetería. */
  private aplicarNumero(trabajado: Servicio, grafico: Grafico | null): Servicio {
    if (grafico === null) {
      const nuevo = this.vaciar(trabajado);
      nuevo.numero = trabajado.numero;
      nuevo.trabajadas = nuevo.trabajadasConvenio = this.convenio?.jornadaMedia ?? 0;
      return nuevo;
    }
    trabajado.limpieza = trabajado.plusPaqueteria = trabajado.facturadoPaqueteria = trabajado.plusMenorDescanso = 0;
    CalculosHorario.copiarGrafico(grafico, trabajado);
    this.aplicarPaqueteria(trabajado);
    return trabajado;
  }

  regenerarDia(dia: DiaCalendario, anterior: DiaCalendario | null, siguiente: DiaCalendario | null, grafico: Grafico | null): void {
    const trabajado = dia.servicioTrabajado;
    if (esTrabajo(trabajado.incidencia, trabajado.numero)) {
      dia.servicioTrabajado = this.aplicarNumero(trabajado, grafico);
    }

    const virtualId = dia.servicioVirtual.id;
    dia.servicioVirtual = clonarServicio(dia.servicioTrabajado);
    dia.servicioVirtual.id = virtualId;

    this.recalcularPlusMenorDescanso(dia.servicioTrabajado, anterior?.servicioTrabajado ?? null, siguiente?.servicioTrabajado ?? null);
    this.recalcularPlusMenorDescanso(dia.servicioVirtual, anterior?.servicioVirtual ?? null, siguiente?.servicioVirtual ?? null);
  }

  // ---- 6.4 Cambio de una propiedad en un servicio ----

  /** Aplica las consecuencias de editar una propiedad del servicio. Devuelve el servicio resultante. */
  cambiarPropiedad(servicio: Servicio, propiedad: string, grafico: Grafico | null): Servicio {
    switch (propiedad) {
      case "inicio":
      case "final":
      case "turno":
      case "inicioPartido":
      case "finalPartido":
      case "tienePlusPaqueteria":
      case "facturadoPaqueteria":
        this.recalcularServicio(servicio);
        return servicio;
      case "incidencia":
        if (!esTrabajo(servicio.incidencia, servicio.numero) || servicio.incidencia === Incidencia.FOR) {
          return this.vaciar(servicio);
        }
        return servicio;
      case "numero":
        if (servicio.numero <= 0) return this.vaciar(servicio);
        if (!esTrabajo(servicio.incidencia, servicio.numero)) servicio.incidencia = Incidencia.Trabajo;
        return this.aplicarNumero(servicio, grafico);
      default:
        return servicio;
    }
  }
}
