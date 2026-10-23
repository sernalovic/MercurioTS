/**
 * Pantalla Detalle de calendario — port de `DetalleCalendarioViewModel` +
 * `DetalleCalendarioView`: una fila por día con los tres servicios, edición
 * del servicio trabajado con recálculo AL MOMENTO en el cliente (`CalculosHorario.cambiarPropiedad`
 * + `recalcularPlusMenorDescanso`), resumen del mes (`recalcularResumen`),
 * saldos arrastrados (`Saldos` del dominio) y «Guardar» que envía el
 * calendario completo (los cambios no persisten hasta pulsarlo, igual que el
 * original). «Regenerar día/calendario» físca los servicios con los gráficos.
 * «Generar reclamación» y «Generar nómina» son el port de Reclamar/
 * GenerarNomina del ViewModel (fase M6).
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { api } from "../lib/api";
import { SeparadorV } from "../componentes/Separador";
import { useMedida } from "../lib/medidas";
import { duracionC, duracion as duracionTotal, centimosDe, hora, importe, parseHora, unidades } from "../lib/horas";
import {
  CalculosHorario, CodigoIncidencia, Incidencia, Turno, ajustarJDs, recalcularResumen,
  restablecerImportesEnNomina, nuevoResumenCalendario, nombreEnum, texto as textoIncidencia,
  esTrabajo, asignar as asignarIncidencia, generarReclamacion, esResuelta, nuevaReclamacion,
  hasErrors, totalDiasTrabajados, totalDescansos, totalDiasVacaciones, totalDiasE, totalImporteDndsCobrados,
  dcsGeneradosHastaMes, dcsPendientesHastaMes, dndsPendientesHastaMes, horasAcumuladasHastaMes,
  type Calendario, type Convenio, type DiaCalendario, type Grafico,
  type Reclamacion, type ResumenCalendario, type Servicio, type SaldosEntrada,
} from "@mercurio/domain";

const INCIDENCIAS: Incidencia[] = Object.values(Incidencia).filter((v): v is Incidencia => typeof v === "number");
const CODIGOS: CodigoIncidencia[] = Object.values(CodigoIncidencia).filter((v): v is CodigoIncidencia => typeof v === "number");
const TURNOS: Turno[] = Object.values(Turno).filter((v): v is Turno => typeof v === "number");

const LETRAS_SEMANA = ["D", "L", "M", "X", "J", "V", "S"];

/** "S-15" como `Utilidades.DiaConSemana` del original. */
function diaConSemana(fecha: string): string {
  const dow = new Date(`${fecha}T00:00:00`).getDay();
  return `${LETRAS_SEMANA[dow]}-${diaDe(fecha)}`;
}

function diaDe(fecha: string): string {
  return fecha.slice(8, 10);
}

function esFinDeSemana(fecha: string): boolean {
  const dow = new Date(`${fecha}T00:00:00`).getDay();
  return dow === 0 || dow === 6;
}

export function PantallaDetalleCalendario({ servidor, token, idCalendario, onVolver }: {
  servidor: string;
  token: string;
  idCalendario: number;
  onVolver: () => void;
}): ReactNode {
  const [calendario, setCalendario] = useState<Calendario | null>(null);
  const [dias, setDias] = useState<DiaCalendario[]>([]);
  const [resumen, setResumen] = useState<ResumenCalendario | null>(null);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [anchoLat, setAnchoLat] = useMedida("DetalleCalendario.Lateral", 340);
  const [saldos, setSaldos] = useState("");
  const [hayCambios, setHayCambios] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Vecinos fuera del mes: disponible tras cargar. */
  const vecinosFuera = useRef<{ anterior: DiaCalendario | null; siguiente: DiaCalendario | null }>({
    anterior: null, siguiente: null,
  });
  const calcRef = useRef<CalculosHorario>(new CalculosHorario());
  const convenioRef = useRef<Convenio | null>(null);

  /** Recalcula el resumen del mes con los días actuales (mutando un clon). */
  function recalcularResumenLocal(diasActuales: DiaCalendario[]): ResumenCalendario {
    if (calendario === null) return nuevoResumenCalendario();
    const cal: Calendario = { ...calendario, dias: diasActuales };
    recalcularResumen(
      cal, convenioRef.current, vecinosFuera.current.anterior, vecinosFuera.current.siguiente,
    );
    setCalendario((c) => (c === null ? c : { ...c, resumen: cal.resumen }));
    return cal.resumen as ResumenCalendario;
  }

  // ---- carga ----

  const cargar = useCallback((): void => {
    setOcupado(true);
    setError(null);
    api<{ calendario: Calendario }>(servidor, token, `calendarios/${idCalendario}`)
      .then((r) => {
        const cal = r.calendario;
        const ordenados = [...cal.dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
        setCalendario(cal);
        setDias(ordenados);
        setResumen(cal.resumen);
        setHayCambios(false);
        setSeleccion(null);
        vecinosFuera.current = { anterior: null, siguiente: null };
        // Convenio del año y vecinos (igual que CargarAsync del original).
        void api<{ convenios: Convenio[] }>(servidor, token, "convenios")
          .then((cc) => {
            const convenio = cc.convenios.find((x) => x.año === Number(cal.fecha.slice(0, 4))) ?? null;
            convenioRef.current = convenio;
            calcRef.current = new CalculosHorario(convenio);
            if (convenio === null) {
              window.alert(`No existe un convenio válido para ${cal.fecha.slice(0, 4)}. Crea uno para que los cálculos sean correctos.`);
            }
          });
        void api<{ dia: DiaCalendario | null }>(
          servidor, token,
          `calendarios/diasCalendario/dia?fecha=${ayerDe(cal.fecha)}&idConductor=${cal.conductorId}`,
        ).then((d) => { vecinosFuera.current = { ...vecinosFuera.current, anterior: d.dia }; });
        void api<{ dia: DiaCalendario | null }>(
          servidor, token,
          `calendarios/diasCalendario/dia?fecha=${primerDelMesSiguiente(cal.fecha)}&idConductor=${cal.conductorId}`,
        ).then((d) => { vecinosFuera.current = { ...vecinosFuera.current, siguiente: d.dia }; });
        void calcularSaldos(cal);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servidor, token, idCalendario]);

  useEffect(cargar, [cargar]);

  /** La entrada de saldos (los cuatro GETs como EntradaSaldosAsync del original). */  async function entradaSaldos(cal: Calendario): Promise<SaldosEntrada | null> {
    if (cal.conductor === null) return null;
    const matricula = cal.conductor.matricula;
    const mesAnterior = restarMes(cal.fecha);
    const [hastaMesAnterior, hastaAñoAnterior, dcs, dnds] = await Promise.all([
      Number(cal.fecha.slice(5, 7)) === 1
        ? Promise.resolve(nuevoResumenCalendario())
        : api<{ resumen: ResumenCalendario | null }>(
          servidor, token, `resumenes/hastaMes?matricula=${matricula}&hasta=${mesAnterior}`,
        ).then((r) => r.resumen),
      api<{ resumen: ResumenCalendario | null }>(
        servidor, token, `resumenes/hastaNoviembreAnoAnterior?matricula=${matricula}&hasta=${cal.fecha}`,
      ).then((r) => r.resumen),
      api<{ importe: number }>(
        servidor, token, `reclamaciones/dcsReclamados?fecha=${cal.fecha}&idConductor=${cal.conductorId}`,
      ).then((r) => r.importe),
      api<{ importe: number }>(
        servidor, token, `reclamaciones/dndsReclamados?fecha=${cal.fecha}&idConductor=${cal.conductorId}`,
      ).then((r) => r.importe),
    ]);
    return {
      calendario: cal,
      resumenHastaMesAnterior: hastaMesAnterior,
      resumenHastaAñoAnterior: hastaAñoAnterior,
      dcsReclamadosEnCursoHastaMesAnterior: dcs,
      dndsReclamadosEnCursoHastaMesAnterior: dnds,
    };
  }

  /** Los cuatro GETs de saldos + reglas del dominio (como CalcularSaldosAsync). */
  async function calcularSaldos(cal: Calendario): Promise<void> {
    let e: SaldosEntrada | null = null;
    try {
      e = await entradaSaldos(cal);
      if (e === null) { setSaldos(""); return; }
      const horas = duracionTotal(horasAcumuladasHastaMes(e, convenioRef.current));
      setSaldos(
        `Horas acumuladas hasta el mes: ${horas}   ·   ` +
        `DCs pendientes: ${unidades(dcsPendientesHastaMes(e))}   ·   ` +
        `DNDs pendientes: ${unidades(dndsPendientesHastaMes(e))}   ·   ` +
        `DCs generados: ${unidades(dcsGeneradosHastaMes(e, convenioRef.current))}`,
      );
    } catch {
      setSaldos("");
    }
  }

  /** «Generar reclamación» (DetalleCalendario.Reclamar del original). */
  async function reclamar(): Promise<void> {
    const cal = calendario;
    const convenio = convenioRef.current;
    if (cal === null || convenio === null || cal.conductor === null) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await api<{ reclamacion: Reclamacion | null }>(
        servidor, token,
        `reclamaciones/porFecha?fecha=${cal.fecha}&idConductor=${cal.conductorId}`,
      );
      const rec: Reclamacion = r.reclamacion ?? nuevaReclamacion({
        conductorId: cal.conductorId,
        fecha: cal.fecha.slice(0, 10),
        fechaEfecto: new Date().toISOString().slice(0, 10),
        cerrada: false,
        conceptosReclamados: [],
      });
      if (esResuelta(rec)) {
        window.alert("Hay una reclamación para este mes que está resuelta.\n\nNo se puede generar otra.");
        return;
      }
      if (rec.cerrada) {
        window.alert("Hay una reclamación para este mes que está cerrada.\n\nNo se puede generar otra.");
        return;
      }
      if (rec.conceptosReclamados.length > 0) {
        await api(servidor, token, "conceptosReclamados/lista", {
          metodo: "DELETE",
          cuerpo: rec.conceptosReclamados.filter((c) => (c.id ?? 0) > 0).map((c) => ({ id: c.id })),
        });
        rec.conceptosReclamados = [];
      }
      const e = await entradaSaldos(cal);
      const dcs = e === null ? 0 : dcsPendientesHastaMes(e);
      const dnds = e === null ? 0 : dndsPendientesHastaMes(e);
      generarReclamacion(rec, cal, convenio.importeDietas, dcs, dnds, new Date().toISOString().slice(0, 10));
      if (rec.conceptosReclamados.length === 0) {
        window.alert("No hay diferencias que reclamar en este mes.");
        return;
      }
      if (rec.id === undefined) {
        await api(servidor, token, "reclamaciones", { metodo: "POST", cuerpo: rec });
      } else {
        await api(servidor, token, `reclamaciones/${rec.id}`, { metodo: "PUT", cuerpo: rec });
      }
      window.alert(`Reclamación generada con ${rec.conceptosReclamados.length} conceptos.\n\n${rec.notas ?? ""}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  /** «Generar nómina» (DetalleCalendario.GenerarNomina del original). */
  async function generarNomina(): Promise<void> {
    const cal = calendario;
    if (cal === null) return;
    setOcupado(true);
    setError(null);
    try {
      if (hayCambios) {
        const limpios = cal.dias.map((d) => ({ ...d, isRemoteUpdated: false }));
        await api(servidor, token, `calendarios/${idCalendario}`, {
          metodo: "PUT",
          cuerpo: { ...cal, dias: limpios, resumen },
        });
        setHayCambios(false);
      }
      const r = await api<{ id: number }>(
        servidor, token,
        `nominas/id?fecha=${cal.fecha}&idConductor=${cal.conductorId}`,
      );
      if (r.id > 0 && !window.confirm("Ya hay una nómina generada. ¿Quieres volver a generarla?")) return;
      const n = await api<{ nomina: { totalLiquido: number } | null }>(
        servidor, token,
        `nominas/generar?fecha=${cal.fecha}&idConductor=${cal.conductorId}`,
        { metodo: "POST" },
      );
      if (n.nomina === null) {
        window.alert("Falta el calendario del mes o el convenio del año.");
        return;
      }
      const liquido = (Math.round(n.nomina.totalLiquido) / 100)
        .toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      window.alert(`Nómina generada. Líquido: ${liquido} €`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  // ---- edición: aplicAssignment bares de REGLAS-CALCULO 6.4 en el cliente ----

  /** Vecino anterior y siguiente de una fila (los extremos vienen del mes colindante). */
  function vecinos(i: number): { anterior: DiaCalendario | null; siguiente: DiaCalendario | null; iAnterior: number; iSiguiente: number } {
    return {
      anterior: i > 0 ? dias[i - 1]! : vecinosFuera.current.anterior,
      iAnterior: i - 1,
      siguiente: i < dias.length - 1 ? dias[i + 1]! : vecinosFuera.current.siguiente,
      iSiguiente: i + 1,
    };
  }

  /**
   * Cambio de una propiedad del servicio trabajado: aplica la regla del dominio
   * (`cambiarPropiedad`), recalcula el plus por menor descanso con los vecinos
   * y el resumen (como AplicarCambioAsync del original).
   */
  async function aplicarCambio(i: number, propiedad: string, mutar: (t: Servicio) => Servicio): Promise<void> {
    try {
      const dia = dias[i]!;
      let t = clonarServicio(dia.servicioTrabajado);
      t = mutar(t);
      let grafico: Grafico | null = null;
      if (propiedad === "numero" && t.numero > 0 && calendario !== null) {
        const r = await api<{ grafico: Grafico | null }>(
          servidor, token, `graficos/paraFecha?numero=${t.numero}&fecha=${dia.fecha}&centro=${calendario.centro}`,
        );
        grafico = r.grafico;
      }
      const servicio = calcRef.current.cambiarPropiedad(t, propiedad, grafico);
      const { anterior, siguiente, iAnterior, iSiguiente } = vecinos(i);
      const nuevos = [...dias];
      nuevos[i] = { ...dia, servicioTrabajado: servicio };
      const antServicio = anterior === null ? null : clonarServicio(anterior.servicioTrabajado);
      if (anterior !== null && iAnterior >= 0) nuevos[iAnterior] = { ...nuevos[iAnterior]!, servicioTrabajado: antServicio! };
      const sigServicio = siguiente === null ? null : clonarServicio(siguiente.servicioTrabajado);
      if (siguiente !== null && iSiguiente < dias.length) {
        nuevos[iSiguiente] = { ...nuevos[iSiguiente]!, servicioTrabajado: sigServicio! };
      }
      calcRef.current.recalcularPlusMenorDescanso(servicio, antServicio, sigServicio);
      setDias(nuevos);
      setResumen(recalcularResumenLocal(nuevos));
      setHayCambios(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** Cambio directo de datos del día (refuerzos, DND cobrado, notas): solo marca cambios. */
  function cambiarDia(i: number, mutar: (d: DiaCalendario) => Partial<DiaCalendario>): void {
    const nuevos = [...dias];
    nuevos[i] = { ...dias[i]!, ...mutar(dias[i]!) };
    setDias(nuevos);
    setHayCambios(true);
  }

  /** Regenerar día o calendario entero (con confirmaciones del original). */
  async function regenerar(indices: number[]): Promise<void> {
    if (calendario === null) return;
    setOcupado(true);
    setError(null);
    try {
      const nuevos = [...dias];
      for (const i of indices) {
        const dia = nuevos[i]!;
        const t = dia.servicioTrabajado;
        let grafico: Grafico | null = null;
        if (esTrabajo(t.incidencia, t.numero) && t.numero > 0) {
          const r = await api<{ grafico: Grafico | null }>(
            servidor, token, `graficos/paraFecha?numero=${t.numero}&fecha=${dia.fecha}&centro=${calendario.centro}`,
          );
          grafico = r.grafico;
        }
        const { anterior, siguiente } = vecinos(i);
        const copia: DiaCalendario = {
          ...dia,
          servicioTrabajado: clonarServicio(t),
          servicioVirtual: clonarServicio(dia.servicioVirtual),
        };
        calcRef.current.regenerarDia(
          copia, anterior === null ? null : cero(anterior), siguiente === null ? null : cero(siguiente), grafico,
        );
        nuevos[i] = copia;
      }
      setDias(nuevos);
      setResumen(recalcularResumenLocal(nuevos));
      setHayCambios(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  // ---- modo / guardar / salir ----

  function ajustarJDsCommand(): void {
    if (calendario === null) return;
    const nuevos = dias.map((d) => ({ ...d, servicioTrabajado: clonarServicio(d.servicioTrabajado) }));
    ajustarJDs(nuevos, vecinosFuera.current.anterior, vecinosFuera.current.siguiente);
    setDias(nuevos);
    setResumen(recalcularResumenLocal(nuevos));
    setHayCambios(true);
  }

  function marcarFestivos(): void {
    if (calendario === null) return;
    const nuevos = dias.map((d) => ({
      ...d,
      esFestivo: calcRef.current.esFestivo(d.fecha, calendario.centro),
    }));
    setDias(nuevos);
    setResumen(recalcularResumenLocal(nuevos));
    setHayCambios(true);
  }

  function restablecerImportes(): void {
    if (calendario === null || resumen === null) return;
    const r = { ...resumen };
    const copia: Calendario = { ...calendario, resumen: r };
    restablecerImportesEnNomina(copia);
    setResumen(r);
    setCalendario(copia);
    setHayCambios(true);
  }

  async function guardar(): Promise<void> {
    if (calendario === null) return;
    setOcupado(true);
    setError(null);
    try {
      const limpios = dias.map((d) => ({ ...d, isRemoteUpdated: false }));
      setDias(limpios);
      await api(servidor, token, `calendarios/${idCalendario}`, {
        metodo: "PUT",
        cuerpo: { ...calendario, dias: limpios, resumen },
      });
      setHayCambios(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  function salir(): void {
    if (hayCambios && !window.confirm("¿Quieres descartar los cambios realizados?")) return;
    onVolver();
  }

  function regenerarDiaCommand(): void {
    if (seleccion === null) return;
    const dia = dias[seleccion]!;
    if (!window.confirm(
      `Vas a modificar los servicios del día ${diaDe(dia.fecha)}.\n\n` +
      "Esta acción puede provocar pérdida de datos en el servicio virtual.\n\n¿Quieres continuar?",
    )) return;
    void regenerar([seleccion]);
  }

  function regenerarCalendarioCommand(): void {
    if (!window.confirm(
      "Vas a modificar los servicios de todos los días del calendario actual.\n\n" +
      "Esta acción puede provocar pérdida de datos en el servicio virtual.\n\n¿Quieres continuar?",
    )) return;
    void regenerar(dias.map((_, i) => i));
  }

  // ---- render ----

  const titulo = calendario === null ? "Detalle de calendario"
    : `Calendario ${calendario.fecha.slice(5, 7)}/${calendario.fecha.slice(0, 4)} · ` +
      `${calendario.conductor?.matricula ?? ""} ${calendario.conductor?.nombre ?? ""} ${calendario.conductor?.apellidos ?? ""}`;

  if (calendario === null) {
    return (
      <div className="pagina">
        <div className="cabeceraPagina">
          <h2 className="tituloPagina">Detalle de calendario</h2>
          {ocupado ? <span className="cargando">Cargando calendario…</span> : null}
          {error ? <span className="error" role="alert">{error}</span> : null}
        </div>
        <div className="opcionesPagina"><button className="boton" onClick={onVolver}>Salir</button></div>
      </div>
    );
  }

  return (
    <div className="pagina paginaDetalleO2">
      <div className="opcionesPagina">
        <button className="boton" onClick={salir} disabled={ocupado}>← Salir</button>
        {hayCambios ? <span className="etiquetaMini" style={{ color: "var(--primario)" }}>· cambios sin guardar</span> : null}
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
      </div>
      <div className="marcoCalendarios marcoDetalle">
        <div className="bandaTitulo">DETALLE DE CALENDARIO</div>
        <div className="barraMes">
          <h2 className="tituloMes tituloDetalle">{titulo}</h2>
        </div>
        <div className="barraPanel barraOpsCalendarios">
          <button className="boton" onClick={cargar} disabled={ocupado}>↺ Recargar</button>
          <button className="boton" onClick={regenerarDiaCommand} disabled={ocupado || seleccion === null}>↻ Regenerar día</button>
          <button className="boton" onClick={regenerarCalendarioCommand} disabled={ocupado}>↻ Regenerar calendario</button>
          <button className="boton" onClick={() => setResumen(recalcularResumenLocal(dias))} disabled={ocupado}>Σ Recalcular resumen</button>
          <button className="boton" onClick={ajustarJDsCommand} disabled={ocupado}>☰ Ajustar JDs</button>
          <button className="boton" onClick={marcarFestivos} disabled={ocupado}>📅 Marcar festivos</button>
          <button className="boton" onClick={restablecerImportes} disabled={ocupado} title="Copia los importes calculados a lo cobrado en nómina">
            € Cobrado = calculado
          </button>
          <button className="boton" onClick={() => void reclamar()} disabled={ocupado}>📄 Generar reclamación</button>
          <button className="boton" onClick={() => void generarNomina()} disabled={ocupado}>📄 Generar nómina</button>
          <span className="hueco" />
          <button className="botonPrincipal" onClick={guardar} disabled={ocupado}>💾 Guardar</button>
        </div>
      <div className="detalleCuerpo">
        <div className="marcoRejilla detalleRejilla">
          <table className="rejilla rejillaDetalle">
            <thead>
              <tr>
                <th>Día</th><th>Fest.</th><th>Anual</th><th>Situación</th><th>Gráfico</th>
                <th>Código</th><th>Turno</th><th>Inicio</th><th>Final</th><th>Ini. P.</th><th>Fin P.</th>
                <th>Trab.</th><th>Acum.</th><th>Noct.</th><th>Des.</th><th>Com.</th><th>Cena</th>
                <th>Paq.</th><th>Facturado</th><th>Limp.</th><th>Menor desc.</th>
                <th>Ref.</th><th>DND cob.</th><th>Virtual</th><th>Dif.</th><th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d, i) => (
                <FilaDia
                  key={d.id === undefined ? `nuevo-${i}` : String(d.id)}
                  dia={d}
                  seleccion={seleccion === i}
                  onSeleccion={() => setSeleccion(i)}
                  onFestivo={(v) => { cambiarDia(i, () => ({ esFestivo: v })); }}
                  onPropiedad={(propiedad, mutar) => { void aplicarCambio(i, propiedad, mutar); }}
                  onDia={(mutar) => { cambiarDia(i, mutar); }}
                />
              ))}
            </tbody>
          </table>
        </div>
        <SeparadorV ancho={anchoLat} onAncho={setAnchoLat} lado="der" min={220} max={640} />
        <div className="detalleLateral" style={{ width: anchoLat, flex: `0 0 ${anchoLat}px` }}>
          {resumen === null ? null : <PanelResumen r={resumen} />}
        </div>
      </div>
      </div>
      <p className="barraEstado">{saldos}</p>
    </div>
  );
}

// ---- fila de un día (una fila editable por día, como DiaFila del original) ----

interface PropsFila {
  dia: DiaCalendario;
  seleccion: boolean;
  onSeleccion: () => void;
  onFestivo: (valor: boolean) => void;
  onPropiedad: (propiedad: string, mutar: (t: Servicio) => Servicio) => void;
  onDia: (mutar: (d: DiaCalendario) => Partial<DiaCalendario>) => void;
}

function FilaDia({ dia, seleccion, onSeleccion, onFestivo, onPropiedad, onDia }: PropsFila): ReactNode {
  const t = dia.servicioTrabajado;
  const v = dia.servicioVirtual;
  const clases = [
    ...(!seleccion && esFinDeSemana(dia.fecha) ? ["filaSem"] : []),
    ...(!seleccion && dia.esFestivo ? ["filaFest"] : []),
    ...(!seleccion && dia.isRemoteUpdated ? ["filaRemota"] : []),
    ...(seleccion ? ["sel"] : []),
  ].join(" ");
  const diferente = t.acumuladas > v.acumuladas
    || t.desayuno > v.desayuno || t.comida > v.comida || t.cena > v.cena
    || t.numero !== v.numero || t.incidencia !== v.incidencia;

  /** Celda de hora editable con commit `ParseHora` (vacío/no válido → null). */
  function celdaHora(campo: "inicio" | "final" | "inicioPartido" | "finalPartido"): ReactNode {
    const alCambiar = (e: ChangeEvent<HTMLInputElement>): void => {
      const min = parseHora(e.target.value);
      onPropiedad(campo, (x) => ({ ...x, [campo]: min }));
    };
    return (
      <td>
        <input
          key={`${dia.id}-${campo}-${String(t[campo])}`}
          className="celda celdaHora"
          defaultValue={hora(t[campo])}
          onChange={alCambiar}
          onBlur={alCambiar}
        />
      </td>
    );
  }

  /** Celda numérica en céntimos (se edita en euros). */
  function celdaImporte(campo: "facturadoPaqueteria" | "plusMenorDescanso", lectura: boolean): ReactNode {
    if (lectura) return <td className="num">{importe(t[campo])}</td>;
    const alCambiar = (e: ChangeEvent<HTMLInputElement>): void => {
      const c = centimosDe(e.target.value);
      onPropiedad(campo, (x) => ({ ...x, [campo]: c }));
    };
    return (
      <td>
        <input
          key={`${dia.id}-${campo}-${String(t[campo])}`}
          className="celda celdaNum"
          defaultValue={importe(t[campo])}
          onChange={alCambiar}
          onBlur={alCambiar}
        />
      </td>
    );
  }

  return (
    <tr className={clases} onClick={onSeleccion}>
      <td className="num">{diaConSemana(dia.fecha)}</td>
      <td className="centro"><input type="checkbox" checked={dia.esFestivo} onChange={(e) => onFestivo(e.target.checked)} /></td>
      <td>{textoIncidencia(dia.servicioAnual.incidencia, dia.servicioAnual.numero, dia.servicioAnual.codigo)}</td>
      <td>
        <select
          className="celda"
          value={String(t.incidencia)}
          onChange={(e) => {
            const nueva = Number(e.target.value) as Incidencia;
            onPropiedad("incidencia", (x) => ({ ...x, incidencia: asignarIncidencia(x.incidencia, nueva) }));
          }}
        >
          {INCIDENCIAS.map((i2) => <option key={i2} value={String(i2)}>{nombreEnum(Incidencia, i2)}</option>)}
        </select>
      </td>
      <td>
        <input
          key={`${dia.id}-numero-${String(t.numero)}`}
          className="celda celdaNum"
          defaultValue={t.numero === 0 ? "" : String(t.numero)}
          onChange={(e) => {
            const texto = e.target.value.trim();
            const n = texto === "" ? 0 : Number(texto);
            if (!Number.isInteger(n) || n < 0) return;
            onPropiedad("numero", (x) => ({ ...x, numero: n }));
          }}
          onBlur={(e) => {
            const texto = e.target.value.trim();
            const n = texto === "" ? 0 : Number(texto);
            if (!Number.isInteger(n) || n < 0) return;
            onPropiedad("numero", (x) => ({ ...x, numero: n }));
          }}
        />
      </td>
      <td>
        <select
          className="celda"
          value={String(t.codigo)}
          onChange={(e) => onPropiedad("codigo", (x) => ({ ...x, codigo: Number(e.target.value) as CodigoIncidencia }))}
        >
          {CODIGOS.map((c) => <option key={c} value={String(c)}>{nombreEnum(CodigoIncidencia, c)}</option>)}
        </select>
      </td>
      <td>
        <select
          className="celda"
          value={String(t.turno)}
          onChange={(e) => onPropiedad("turno", (x) => ({ ...x, turno: Number(e.target.value) as Turno }))}
        >
          {TURNOS.map((c) => <option key={c} value={String(c)}>{nombreEnum(Turno, c)}</option>)}
        </select>
      </td>
      {celdaHora("inicio")}
      {celdaHora("final")}
      {celdaHora("inicioPartido")}
      {celdaHora("finalPartido")}
      <td className="centradoMic">{duracionC(t.trabajadas)}</td>
      <td className="centradoMic">{duracionC(t.acumuladas)}</td>
      <td className="centradoMic">{duracionC(t.nocturnas)}</td>
      <td className="num">{unidades(t.desayuno)}</td>
      <td className="num">{unidades(t.comida)}</td>
      <td className="num">{unidades(t.cena)}</td>
      <td className="centro">
        <input
          type="checkbox"
          checked={t.tienePlusPaqueteria}
          onChange={(e) => onPropiedad("tienePlusPaqueteria", (x) => ({ ...x, tienePlusPaqueteria: e.target.checked }))}
        />
      </td>
      {celdaImporte("facturadoPaqueteria", false)}
      <td>
        <input
          key={`${dia.id}-limpieza-${String(t.limpieza)}`}
          className="celda celdaNum"
          defaultValue={unidades(t.limpieza)}
          onChange={(e) => {
            const n = Number(e.target.value.trim().replace(",", "."));
            if (!Number.isFinite(n) || n < 0) return;
            onPropiedad("limpieza", (x) => ({ ...x, limpieza: Math.round(n * 100) / 100 }));
          }}
          onBlur={(e) => {
            const n = Number(e.target.value.trim().replace(",", "."));
            if (!Number.isFinite(n) || n < 0) return;
            onPropiedad("limpieza", (x) => ({ ...x, limpieza: Math.round(n * 100) / 100 }));
          }}
        />
      </td>
      {celdaImporte("plusMenorDescanso", true)}
      <td>
        <input
          key={`${dia.id}-refuerzos-${String(dia.refuerzos)}`}
          className="celda celdaNum"
          defaultValue={String(dia.refuerzos)}
          onChange={(e) => {
            const n = Number(e.target.value.trim());
            if (!Number.isInteger(n) || n < 0) return;
            onDia(() => ({ refuerzos: n }));
          }}
          onBlur={(e) => {
            const n = Number(e.target.value.trim());
            if (!Number.isInteger(n) || n < 0) return;
            onDia(() => ({ refuerzos: n }));
          }}
        />
      </td>
      <td className="centro">
        <input type="checkbox" checked={dia.dndCobrado} onChange={(e) => onDia(() => ({ dndCobrado: e.target.checked }))} />
      </td>
      <td>{textoIncidencia(v.incidencia, v.numero, v.codigo)}</td>
      <td className="centro"><input type="checkbox" checked={diferente} disabled readOnly /></td>
      <td>
        <input
          key={`${dia.id}-notas-${String(dia.notas ?? "")}`}
          className="celda celdaTexto"
          defaultValue={String(dia.notas ?? "")}
          onChange={(e) => onDia(() => ({ notas: e.target.value.trim() === "" ? null : e.target.value.trim() }))}
          onBlur={(e) => onDia(() => ({ notas: e.target.value.trim() === "" ? null : e.target.value.trim() }))}
        />
      </td>
    </tr>
  );
}

// ---- panel lateral del resumen (StackPanel DataContext=Resumen del original) ----

function euroN2(c: number): string {
  return (c / 100).toFixed(2);
}

function PanelResumen({ r }: { r: ResumenCalendario }): ReactNode {
  return (
    <div className="panelResumen">
      <h3 className="tituloSeccion">Resumen del mes</h3>
      <p>Días activo: {r.diasActivo}   Trabajados: {totalDiasTrabajados(r)}</p>
      <p>Trabajo/JD/FN: {r.diasTrabajo}/{r.diasTrabajoJD}/{r.diasTrabajoFN}</p>
      <p>JD/FN/DS/DF: {r.diasJD}/{r.diasFN}/{r.diasDS}/{r.diasDF}</p>
      <p>Vacaciones: {totalDiasVacaciones(r)}   Enfermo: {totalDiasE(r)}   DC: {r.diasDC}   DND: {r.diasDND}</p>
      <p>Sábados trab./desc.: {r.sabadosTrabajados}/{r.sabadosDescansados}   Domingos: {r.domingosTrabajados}/{r.domingosDescansados}</p>
      <p>Festivos trab./desc.: {r.festivosTrabajados}/{r.festivosDescansados}   Findes completos: {unidades(r.findesCompletos)}</p>
      <p>Turnos 1/2/3/4: {r.diasTurno1}/{r.diasTurno2}/{r.diasTurno3}/{r.diasTurno4}</p>
      <p>Horas trabajadas: {duracionTotal(r.horasTrabajadasConvenio)}   Acumuladas: {duracionTotal(r.horasAcumuladas)}</p>
      <p>Acumuladas virtual: {duracionTotal(r.horasAcumuladasVirtual)}   Nocturnas: {duracionTotal(r.horasNocturnas)}</p>
      <h3 className="tituloSeccion">Importes calculados</h3>
      <p>Dietas: {unidades(r.totalDietas)} → {euroN2(r.importeDietas)} €</p>
      <p>Plus sábados: {euroN2(r.importePlusSabados)}   Festivos: {euroN2(r.importePlusFestivos)}</p>
      <p>Nocturnidad: {euroN2(r.importePlusNocturnidad)}   Parcial: {euroN2(r.importePlusNocturnidadParcial)}</p>
      <p>Paquetería: {euroN2(r.importePlusPaqueteria)}   Limpieza: {euroN2(r.importePlusLimpieza)}</p>
      <p>Menor descanso: {euroN2(r.importePlusMenorDescanso)}   Navidad: {euroN2(r.importePlusNavidad)}</p>
      <p>Viaje: {euroN2(r.importePlusViaje)}   Quebranto: {euroN2(r.importeQuebrantoMoneda)}</p>
      <p>Refuerzos: {euroN2(r.importeRefuerzos)}   DNDs cobrados: {euroN2(totalImporteDndsCobrados(r))}</p>
      <p>Variable vacaciones: {euroN2(r.importeVariableVacaciones)}</p>
      {hasErrors(r) ? (
        <>
          <h3 className="tituloSeccion">Errores</h3>
          <p className="erroresResumen">{r.errores}</p>
        </>
      ) : null}
    </div>
  );
}

// ---- utilidades de fecha y clonación ----

function clonarServicio(s: Servicio): Servicio {
  return { ...s };
}

/** Clon de un día vecino para pasar a los cálculos sin mutar el estado. */
function cero(d: DiaCalendario): DiaCalendario {
  return {
    ...d,
    servicioTrabajado: { ...d.servicioTrabajado },
    servicioVirtual: { ...d.servicioVirtual },
    servicioAnual: { ...d.servicioAnual },
  };
}

function formatoFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** El día anterior al 1 del mes ("AAAA-MM-01" → "AAAA-MM-31" del previo). */
function ayerDe(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return formatoFecha(d);
}

/** El primer día del mes siguiente. */
function primerDelMesSiguiente(fecha: string): string {
  const y = Number(fecha.slice(0, 4));
  const m = Number(fecha.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** El primer día del mes anterior. */
function restarMes(fecha: string): string {
  const y = Number(fecha.slice(0, 4));
  const m = Number(fecha.slice(5, 7));
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}
