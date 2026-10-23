/**
 * Pantalla Gráficos — aspecto de Orión 2 (`GraficosView` + la ventana
 * «Detalle de gráfico»): lista de grupos a la izquierda, rejilla compacta
 * (Cat/Número/D/Turno/Inicio/Final/Partidos/Valoración/Trabajadas/T.Vacio/
 * Acumuladas/Nocturnas/Dietas/PlusCena/Paq…), barra de estado abajo y el
 * DETALLE DE GRÁFICO en ventana modal al hacer doble clic. El recálculo, la
 * deducción de tipo de día y de turno se hacen en el cliente con el dominio
 * (`CalculosHorario`); solo se persiste al pulsar «Guardar y Actualizar»
 * (bajas → altas → cambios → recarga). Con el centro «Todos» la lista de
 * grupos es la unión de todos los centros (mejora sobre el original).
 */
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { api } from "../lib/api";
import { pedirTexto } from "../lib/dialogos";
import { SeparadorV } from "../componentes/Separador";
import { useMedida } from "../lib/medidas";
import { duracion, hora, minutosDeHora } from "../lib/horas";
import {
  CalculosHorario, TipoDia, Turno, CategoriaGrafico, CentroTrabajo, nombreEnum, Duracion,
  type Convenio, type Grafico, type ItinerarioGrafico,
} from "@mercurio/domain";

const CENTROS = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];
const ETIQUETAS_CENTRO: Record<number, string> = {
  0: "Todos", 1: "Donosti", 2: "Bilbao", 3: "Arrasate", 4: "Vitoria", 5: "Pruebas",
};

const CATEGORIAS = [CategoriaGrafico.Conduccion, CategoriaGrafico.Taquilla];
/** Abreviaturas de la columna Cat. */
const ABRE_CATEGORIA: Record<number, string> = { 0: "C", 1: "T" };
const TIPOS_DIA = [
  TipoDia.Ninguno, TipoDia.LunesJueves, TipoDia.Viernes, TipoDia.Sabado,
  TipoDia.Festivo, TipoDia.Reserva, TipoDia.ReduccionJornada,
];
/** Etiquetas del combo «Tipo día» del Detalle (con guiones bajos, como Orión 2). */
const ETIQUETA_TIPO_DIA: Record<number, string> = {
  0: "Ninguno", 1: "Lunes_Jueves", 2: "Viernes", 3: "Sabado",
  4: "Festivo", 5: "Reserva", 6: "Reduccion_Jornada",
};
/** Letras de la columna D (tipo de día). */
const LETRA_TIPO_DIA: Record<number, string> = {
  0: "", 1: "L", 2: "V", 3: "S", 4: "F", 5: "RV", 6: "RJ",
};
const TURNOS = [Turno.SinTurno, Turno.Manana, Turno.Tarde, Turno.Noche, Turno.Partido];

type CampoHora = "inicio" | "final" | "inicioPartido" | "finalPartido" | "valoracion";
type CampoDieta = "desayuno" | "comida" | "cena" | "plusCena";

/** "0,00" en es-ES (dietas con 2 decimales, coma decimal). */
function n2(v: number): string {
  return (Math.round(v * 100) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Celda de texto con commit en change+blur (patrón M5). */
function celdaTexto(valor: string, alCommit: (v: string) => void, clase = "celda"): ReactNode {
  const alCambiar = (e: ChangeEvent<HTMLInputElement>): void => alCommit(e.target.value);
  return <input key={`t-${valor}`} className={clase} defaultValue={valor} onChange={alCambiar} onBlur={alCambiar} />;
}

// ---- DETALLE DE GRÁFICO (ventana modal) ----

function DetalleGrafico({ fila, onCambiar, onCambiarIt, onBorrarIt, onDeshacerIt, borradasIt, onCerrar }: {
  fila: Grafico;
  onCambiar: (cambios: Partial<Grafico>) => void;
  onCambiarIt: (i: ItinerarioGrafico, cambios: Partial<ItinerarioGrafico>) => void;
  /** La baja de itinerarios vive en la pantalla (para enviarla al guardar). */
  onBorrarIt: (i: ItinerarioGrafico) => void;
  onDeshacerIt: () => void;
  borradasIt: ItinerarioGrafico[];
  onCerrar: () => void;
}): ReactNode {
  const [itSeleccion, setItSeleccion] = useState<number | null>(null);

  function añadirIt(): void {
    const i: ItinerarioGrafico = {
      graficoId: fila.id,
      inicio: null,
      itinerario: null,
      descripcion: null,
      final: null,
      tiempoTotal: 0,
    };
    onCambiar({ itinerarios: [...fila.itinerarios, i] });
    setItSeleccion(fila.itinerarios.length);
  }

  function borrarIt(): void {
    const i = itSeleccion !== null ? fila.itinerarios[itSeleccion] : undefined;
    if (i === undefined) return;
    onBorrarIt(i);
    setItSeleccion(null);
  }

  const totalIt = fila.itinerarios.reduce((s, i) => s + i.tiempoTotal, 0);

  /** Campo etiquetado del formulario (etiqueta azul encima, caja redondeada). */
  function campo(etiqueta: string, contenido: ReactNode): ReactNode {
    return (
      <label className="campoTrabajador">
        <span className="etiquetaCampo">{etiqueta}</span>
        {contenido}
      </label>
    );
  }

  /** Caja de duración editable (hh:mm). */
  function cajaHora(campoHora: CampoHora): ReactNode {
    return celdaTexto(hora(fila[campoHora]), (v) => {
      const m = minutosDeHora(v);
      if (m !== null) onCambiar({ [campoHora]: m });
    }, "campoEntrada");
  }

  /** Caja de unidades (dietas) o de euros (plusCena, en céntimos). */
  function cajaUnidad(nombre: CampoDieta): ReactNode {
    const esUnidad = nombre !== "plusCena";
    const texto = esUnidad
      ? n2(fila[nombre])
      : n2(Math.round(fila[nombre]) / 100);
    return celdaTexto(texto, (v) => {
      const n = Number(v.trim().replace(",", "."));
      if (!Number.isFinite(n) || n < 0) return;
      onCambiar({ [nombre]: esUnidad ? n : Math.round(n * 100) });
    }, "campoEntrada");
  }

  return (
    <div className="veloDetalle" onClick={onCerrar}>
      <div className="ventanaDetalle" onClick={(e) => e.stopPropagation()}>
        <div className="cabeceraVentana">
          <span>Detalle de gráfico</span>
          <button className="cerrarVentana" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="encabezadoGrafico">
          <h2>Gráfico {fila.numero}</h2>
          <h2 className="derecha">{ETIQUETAS_CENTRO[fila.centro] ?? ""} - {`${fila.fecha.slice(8, 10)}-${fila.fecha.slice(5, 7)}-${fila.fecha.slice(0, 4)}`}</h2>
        </div>
        <div className="detalleCuerpo">
          <div className="formTrabajador ancho">
            <div className="formDuo">
              {campo("Categoría", (
                <select className="campoEntrada" value={String(fila.categoria)} onChange={(e) => onCambiar({ categoria: Number(e.target.value) })}>
                  {CATEGORIAS.map((v) => <option key={v} value={String(v)}>{nombreEnum(CategoriaGrafico, v)}</option>)}
                </select>
              ))}
              {campo("Tipo día", (
                <select className="campoEntrada" value={String(fila.tipoDia)} onChange={(e) => onCambiar({ tipoDia: Number(e.target.value) })}>
                  {TIPOS_DIA.map((v) => <option key={v} value={String(v)}>{ETIQUETA_TIPO_DIA[v]}</option>)}
                </select>
              ))}
            </div>
            <div className="formCuatro">
              {campo("Inicio", cajaHora("inicio"))}
              {campo("Final", cajaHora("final"))}
              {campo("Inicio partido", cajaHora("inicioPartido"))}
              {campo("Final partido", cajaHora("finalPartido"))}
            </div>
            <div className="formCuatro">
              {campo("Turno", celdaTexto(String(fila.turno), (v) => {
                const n = Number.parseInt(v, 10);
                if (Number.isInteger(n) && n >= 0 && n <= 4) onCambiar({ turno: n });
              }, "campoEntrada"))}
              {campo("Valoración", cajaHora("valoracion"))}
              {campo("Tiempo total", celdaTexto(duracion(fila.tiempoTotal), (v) => {
                const m = minutosDeHora(v);
                if (m !== null) onCambiar({ tiempoTotal: m });
              }, "campoEntrada"))}
              {campo("Tiempo partido", celdaTexto(duracion(fila.tiempoPartido), (v) => {
                const m = minutosDeHora(v);
                if (m !== null) onCambiar({ tiempoPartido: m });
              }, "campoEntrada"))}
            </div>
            <div className="formTrio">
              {campo("Trabajadas", celdaTexto(duracion(fila.trabajadas), (v) => {
                const m = minutosDeHora(v);
                if (m !== null) onCambiar({ trabajadas: m });
              }, "campoEntrada"))}
              {campo("Trab. convenio", celdaTexto(duracion(fila.trabajadasConvenio), (v) => {
                const m = minutosDeHora(v);
                if (m !== null) onCambiar({ trabajadasConvenio: m });
              }, "campoEntrada"))}
              {campo("Tiempo vacío", celdaTexto(duracion(fila.tiempoVacio), (v) => {
                const m = minutosDeHora(v);
                if (m !== null) onCambiar({ tiempoVacio: m });
              }, "campoEntrada"))}
            </div>
            <div className="formDuo">
              {campo("Acumuladas", celdaTexto(duracion(fila.acumuladas), (v) => {
                const m = minutosDeHora(v);
                if (m !== null) onCambiar({ acumuladas: m });
              }, "campoEntrada"))}
              {campo("Nocturnas", celdaTexto(duracion(fila.nocturnas), (v) => {
                const m = minutosDeHora(v);
                if (m !== null) onCambiar({ nocturnas: m });
              }, "campoEntrada"))}
            </div>
            <div className="formCuatro">
              {campo("Desayuno", cajaUnidad("desayuno"))}
              {campo("Comida", cajaUnidad("comida"))}
              {campo("Cena", cajaUnidad("cena"))}
              {campo("Plus cena", cajaUnidad("plusCena"))}
            </div>
            <div className="formDuo">
              <button className={`botonFicha ancho${fila.noCalcular ? " pulsado" : ""}`} onClick={() => onCambiar({ noCalcular: !fila.noCalcular })}>No calcular</button>
              <button className={`botonFicha ancho${fila.tienePlusPaqueteria ? " pulsado" : ""}`} onClick={() => onCambiar({ tienePlusPaqueteria: !fila.tienePlusPaqueteria })}>Plus paquetería</button>
            </div>
          </div>
          <div className="panelReclamaciones">
            <div className="bandaTitulo">ITINERARIOS</div>
            <div className="barraPanel">
              <button className="boton" onClick={añadirIt}>＋</button>
              <button className="boton" onClick={borrarIt} disabled={itSeleccion === null}>－</button>
              <button className="boton" onClick={onDeshacerIt} disabled={borradasIt.length === 0}>↺</button>
              <button className="boton" onClick={() => {
                onCambiar({
                  itinerarios: fila.itinerarios
                    .map((i) => ({ ...i, tiempoTotal: Duracion(i.inicio, i.final) }))
                    .sort((a, b) => (a.inicio ?? 99999) - (b.inicio ?? 99999)),
                });
              }} disabled={fila.itinerarios.length === 0}>Σ Calcular</button>
              <button className="boton" disabled>© Tiempo de pago</button>
              <span className="hueco" />
              <span className="totalItinerarios">Total = {duracion(totalIt)}</span>
            </div>
            <div className="marcoRejilla alta">
              <table className="rejilla">
                <thead>
                  <tr><th>In.</th><th>Inicio</th><th>Línea</th><th>Descripción</th><th>Final</th><th>Tiempo</th></tr>
                </thead>
                <tbody>
                  {fila.itinerarios.map((i, n) => (
                    <tr
                      key={i.id === undefined ? `itaN-${n}` : String(i.id)}
                      className={itSeleccion === n ? "sel" : undefined}
                      onClick={() => setItSeleccion(n)}
                    >
                      <td className="centradoMic">{n + 1}</td>
                      {(() => {
                        const alCambiar = (campo: "inicio" | "final") => (e: ChangeEvent<HTMLInputElement>): void => {
                          const m = minutosDeHora(e.target.value);
                          if (m !== null) onCambiarIt(i, { [campo]: m });
                        };
                        return (
                          <>
                            <td><input key={`iti-${String(i.inicio)}`} className="celda celdaHora" defaultValue={hora(i.inicio)} onChange={alCambiar("inicio")} onBlur={alCambiar("inicio")} /></td>
                            <td>{celdaTexto(String(i.itinerario ?? ""), (v) => onCambiarIt(i, { itinerario: v.trim() === "" ? null : v }))}</td>
                            <td>{celdaTexto(String(i.descripcion ?? ""), (v) => onCambiarIt(i, { descripcion: v.trim() === "" ? null : v }))}</td>
                            <td><input key={`itf-${String(i.final)}`} className="celda celdaHora" defaultValue={hora(i.final)} onChange={alCambiar("final")} onBlur={alCambiar("final")} /></td>
                            <td className="centradoMic">{duracion(i.tiempoTotal)}</td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                  {fila.itinerarios.length === 0 ? (
                    <tr><td colSpan={6} className="vacio">Sin itinerarios.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="pieVentana">
          <button className="boton" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ---- PANTALLA GRÁFICOS ----

export function PantallaGraficos({ servidor, token, centro, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  onVolver: () => void;
}): ReactNode {
  const [grupos, setGrupos] = useState<string[]>([]);
  const [grupo, setGrupo] = useState<string | null>(null);
  const [anchoGrupos, setAnchoGrupos] = useMedida("Graficos.Grupos", 170);
  const [filas, setFilas] = useState<Grafico[]>([]);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [borradas, setBorradas] = useState<Grafico[]>([]);
  const [borradasIt, setBorradasIt] = useState<ItinerarioGrafico[]>([]);
  const [convenio, setConvenio] = useState<Convenio | null>(null);
  const [agrupar, setAgrupar] = useState("0");
  const [detalle, setDetalle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const numeroCentro: CentroTrabajo = centro === "Todos" ? 0 : (CENTROS.indexOf(centro) as CentroTrabajo);
  const todos = centro === "Todos";

  function cargarGrupos(): void {
    setOcupado(true);
    setError(null);
    setFilas([]);
    setGrupo(null);
    setSeleccion(null);
    api<{ grupos: string[] }>(servidor, token, `graficos/grupos?centro=${numeroCentro}`)
      .then((r) => {
        setGrupos(r.grupos);
        // Como en Orión 2: el primer grupo queda seleccionado al cargar.
        const primero = r.grupos[0];
        if (primero !== undefined) elegirGrupo(primero);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  function cargarGrupo(fecha: string): void {
    setOcupado(true);
    setError(null);
    api<{ graficos: Grafico[] }>(
      servidor,
      token,
      `graficos/entreFechas?desde=${fecha}&hasta=${fecha}&centro=${numeroCentro}`,
    )
      .then((r) => setFilas(r.graficos))
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  function cargarConvenio(año: number): void {
    api<{ convenios: Convenio[] }>(servidor, token, "convenios")
      .then((r) => setConvenio(r.convenios.find((c) => c.año === año) ?? null))
      .catch(() => setConvenio(null));
  }

  useEffect(cargarGrupos, [servidor, token, centro]);

  /** Cambio de grupo en la lista: recarga gráficos y convenio, como en el original. */
  function elegirGrupo(fecha: string): void {
    setGrupo(fecha);
    setSeleccion(null);
    setBorradas([]);
    setBorradasIt([]);
    setDetalle(false);
    cargarConvenio(Number(fecha.slice(0, 4)));
    cargarGrupo(fecha);
  }

  const seleccionada: Grafico | null = seleccion !== null && seleccion >= 0 && seleccion < filas.length
    ? filas[seleccion] as Grafico
    : null;

  // ---- edición de la rejilla ----

  function actualizar(fila: Grafico, cambios: Partial<Grafico>): void {
    setFilas(filas.map((g) => (g === fila ? { ...g, ...cambios } : g)));
  }

  function actualizarIt(i: ItinerarioGrafico, cambios: Partial<ItinerarioGrafico>): void {
    if (seleccionada === null) return;
    actualizar(seleccionada, {
      itinerarios: seleccionada.itinerarios.map((x) => (x === i ? { ...x, ...cambios } : x)),
    });
  }

  /** Baja de un itinerario desde el Detalle: queda en la lista de bajas de la pantalla. */
  function borrarItDetalle(i: ItinerarioGrafico): void {
    if (seleccionada === null) return;
    if ((i.id ?? 0) > 0) setBorradasIt([...borradasIt, i]);
    actualizar(seleccionada, { itinerarios: seleccionada.itinerarios.filter((x) => x !== i) });
  }

  function deshacerItDetalle(): void {
    if (borradasIt.length === 0 || seleccionada === null) return;
    const devolver = borradasIt[borradasIt.length - 1] as ItinerarioGrafico;
    actualizar(seleccionada, { itinerarios: [...seleccionada.itinerarios, devolver] });
    setBorradasIt(borradasIt.slice(0, -1));
  }

  // ---- celdas Orión 2 (commit en onChange y onBlur) ----

  function celdaHora(fila: Grafico, campo: CampoHora): ReactNode {
    const alCambiar = (e: ChangeEvent<HTMLInputElement>): void => {
      const m = minutosDeHora(e.target.value);
      if (m !== null) actualizar(fila, { [campo]: m });
    };
    return (
      <td>
        <input
          key={`${campo}-${String(fila[campo])}`}
          className="celda celdaHora"
          defaultValue={hora(fila[campo])}
          onChange={alCambiar}
          onBlur={alCambiar}
        />
      </td>
    );
  }

  /** Celda de dietas (unidades) o importes (plusCena, céntimos → €). */
  function celdaDieta(fila: Grafico, campo: CampoDieta): ReactNode {
    const esUnidad = campo !== "plusCena";
    const alCambiar = (e: ChangeEvent<HTMLInputElement>): void => {
      const n = Number(e.target.value.trim().replace(",", "."));
      if (!Number.isFinite(n) || n < 0) return;
      actualizar(fila, { [campo]: esUnidad ? n : Math.round(n * 100) });
    };
    const textoCelda = esUnidad
      ? n2(fila[campo as "desayuno"])
      : n2(Math.round(fila[campo as "plusCena"]) / 100);
    return (
      <td>
        <input
          key={`${campo}-${textoCelda}`}
          className="celda celdaNum"
          defaultValue={textoCelda}
          onChange={alCambiar}
          onBlur={alCambiar}
        />
      </td>
    );
  }

  function añadirGrafico(): void {
    if (grupo === null || todos) return;
    const numero = filas.length === 0 ? 1 : Math.max(...filas.map((g) => g.numero)) + 1;
    const g: Grafico = {
      centro: numeroCentro,
      fecha: grupo,
      numero,
      categoria: 0,
      tipoDia: 0,
      turno: 0,
      noCalcular: false,
      tienePlusPaqueteria: false,
      tieneErrorTiempoPartido: false,
      inicio: null,
      final: null,
      inicioPartido: null,
      finalPartido: null,
      valoracion: 0,
      tiempoTotal: 0,
      tiempoPartido: 0,
      trabajadas: 0,
      trabajadasConvenio: 0,
      tiempoVacio: 0,
      acumuladas: 0,
      nocturnas: 0,
      desayuno: 0,
      comida: 0,
      cena: 0,
      plusCena: 0,
      itinerarios: [],
    };
    setFilas([...filas, g]);
    setSeleccion(filas.length);
  }

  function borrarGrafico(): void {
    if (seleccion === null) return;
    setBorradas([...borradas, filas[seleccion] as Grafico]);
    setFilas(filas.filter((_, i) => i !== seleccion));
    setSeleccion(null);
  }

  function deshacerBorrado(): void {
    if (borradas.length === 0) return;
    setFilas([...filas, borradas[borradas.length - 1] as Grafico]);
    setBorradas(borradas.slice(0, -1));
  }

  function recalcular(): void {
    if (convenio === null) {
      window.alert("No existe un convenio para la validez de este grupo. Añada un convenio para poder recalcular los gráficos.");
      return;
    }
    const calc = new CalculosHorario(convenio);
    setFilas(filas.map((g) => {
      const copia = { ...g, itinerarios: g.itinerarios };
      calc.recalcularGrafico(copia);
      return copia;
    }));
  }

  /** Deduce el tipo de día de cada gráfico a partir de los rangos de números del centro
   * (el del propio gráfico: con «Todos» cada fila sabe su centro). */
  function deducirDia(): void {
    const calc = new CalculosHorario(convenio);
    setFilas(filas.map((g) => ({ ...g, tipoDia: calc.tipoDiaGrafico(g.numero, g.centro) })));
  }

  function deducirTurno(): void {
    setFilas(filas.map((g) => {
      if (g.inicio === null || g.final === null) return g;
      let turno: Turno;
      if (g.inicioPartido !== null && g.finalPartido !== null) turno = Turno.Partido;
      else if (g.final < g.inicio || g.inicio >= 20 * 60) turno = Turno.Noche;
      else if (g.inicio < 12 * 60) turno = Turno.Manana;
      else turno = Turno.Tarde;
      return { ...g, turno };
    }));
  }

  function totalesDe(lista: Grafico[]): string {
    const t = lista.reduce((acc, g) => acc + g.trabajadas, 0);
    const a = lista.reduce((acc, g) => acc + g.acumuladas, 0);
    const n = lista.reduce((acc, g) => acc + g.nocturnas, 0);
    return `Gráficos: ${lista.length} (T1: ${lista.filter((g) => g.turno === Turno.Manana).length} · ` +
      `T2: ${lista.filter((g) => g.turno === Turno.Tarde).length} · T3: ${lista.filter((g) => g.turno === Turno.Noche).length} · ` +
      `T4: ${lista.filter((g) => g.turno === Turno.Partido).length})   ` +
      `Trabajadas: ${duracion(t)}   Acumuladas: ${duracion(a)}   Nocturnas: ${duracion(n)}`;
  }

  // ---- grupos ----

  async function nuevoGrupo(): Promise<void> {
    if (todos) {
      window.alert("Selecciona un centro concreto.");
      return;
    }
    const hoy = new Date();
    const texto = await pedirTexto(
      "Nuevo grupo de gráficos",
      "Fecha de validez (dd/mm/aaaa):",
      `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`,
    );
    if (texto === null) return;
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
    if (m === null) return;
    const fecha = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (grupos.includes(fecha)) {
      window.alert("Ya existe un grupo con esa fecha de validez. Selecciona otra fecha.");
      return;
    }
    // Se crea copiando el grupo actual (gráficos e itinerarios duplicados sin Id);
    // si no hay grupo seleccionado, vacío.
    const copia = filas.map((g) => ({
      ...g,
      id: undefined,
      fecha,
      itinerarios: g.itinerarios.map((i) => ({ ...i, id: undefined, graficoId: undefined })),
    }));
    setGrupos([fecha, ...grupos].sort((a, b) => (a < b ? 1 : -1)));
    setGrupo(fecha);
    cargarConvenio(Number(fecha.slice(0, 4)));
    setFilas(copia);
    setSeleccion(null);
  }

  async function borrarGrupo(): Promise<void> {
    if (grupo === null || todos) return;
    const [año, mes, dia] = grupo.split("-");
    if (!window.confirm(`¿Borrar el grupo del ${dia}-${mes}-${año}, con todos sus gráficos?`)) {
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      await api(servidor, token, `graficos/porFecha?fecha=${grupo}&centro=${numeroCentro}`, { metodo: "DELETE" });
      setGrupos(grupos.filter((g) => g !== grupo));
      setGrupo(null);
      setFilas([]);
      setSeleccion(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  /** Exporta el grupo actual a JSON (descarga). */
  function exportar(): void {
    if (grupo === null) return;
    const datos = JSON.stringify({ grupo, graficos: filas }, null, 2);
    const url = URL.createObjectURL(new Blob([datos], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Gráficos ${grupo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- guardar (bajas → altas → cambios → recarga) ----

  async function guardar(): Promise<void> {
    setOcupado(true);
    setError(null);
    try {
      const idsIt = borradasIt.map((i) => i.id).filter((x): x is number => x !== undefined);
      if (idsIt.length > 0) {
        await api(servidor, token, "itinerariosGraficos", { metodo: "DELETE", cuerpo: idsIt });
      }
      const ids = borradas.map((g) => g.id).filter((x): x is number => x !== undefined && x > 0);
      if (ids.length > 0) {
        await api(servidor, token, "graficos", { metodo: "DELETE", cuerpo: ids });
      }
      const altas = filas.filter((g) => g.id === undefined);
      if (altas.length > 0) {
        await api(servidor, token, "graficos", { metodo: "POST", cuerpo: altas });
      }
      const cambios = filas.filter((g) => g.id !== undefined && g.id > 0);
      if (cambios.length > 0) {
        await api(servidor, token, "graficos", { metodo: "PUT", cuerpo: cambios });
      }
      setBorradas([]);
      setBorradasIt([]);
      const actual = grupo;
      if (actual !== null) {
        setGrupos((lista) => (lista.includes(actual) ? lista : [actual, ...lista].sort((a, b) => (a < b ? 1 : -1))));
        cargarGrupo(actual);
      } else {
        cargarGrupos();
      }
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  const totales = totalesDe(filas);

  // Filas con separadores de agrupación si se pide.
  const ordenadas = [...filas].sort((a, b) =>
    (agrupar === "0" ? 0 : Number(agrupar === "1" ? a.turno : a.tipoDia) - Number(agrupar === "1" ? b.turno : b.tipoDia))
    || a.numero - b.numero);

  return (
    <div className="pagina paginaGraficosO2">
      <div className="opcionesPagina">
        <h2 className="tituloPagina">Gráficos</h2>
        {ocupado ? <span className="cargando">Cargando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
        <button className="boton" onClick={onVolver}>← Volver</button>
        <button className="boton" onClick={guardar} disabled={ocupado || grupo === null}>💾 Guardar y Actualizar</button>
        <button className="boton" onClick={cargarGrupos} disabled={ocupado}>↺ Descartar Cambios</button>
      </div>
      <div className="graficosCuerpo">
        <div className="panelGrupos" style={{ flex: `0 0 ${anchoGrupos}px` }}>
          <div className="bandaTitulo">GRUPOS</div>
          <div className="barraPanel">
            <button className="boton" onClick={nuevoGrupo} disabled={ocupado || todos}>＋</button>
            <button className="boton" onClick={borrarGrupo} disabled={ocupado || grupo === null || todos}>－</button>
            <span className="hueco" />
            <span className="pistaDoble">Doble clic en un gráfico para su detalle.</span>
          </div>
          <div className="listaGrupos">
            {grupos.map((g) => (
              <button key={g} className={g === grupo ? "botonLista sel" : "botonLista"} onClick={() => elegirGrupo(g)}>
                {g.slice(8, 10)}/{g.slice(5, 7)}/{g.slice(0, 4)}
              </button>
            ))}
            {grupos.length === 0 ? <span className="vacio">Sin grupos.</span> : null}
          </div>
        </div>
        <SeparadorV ancho={anchoGrupos} onAncho={setAnchoGrupos} min={120} max={600} />
        <div className="panelPrincipalGraficos">
          <div className="bandaTitulo">GRÁFICOS - {centro}{grupo !== null ? ` (${grupo.slice(8, 10)}-${grupo.slice(5, 7)}-${grupo.slice(0, 4)})` : ""}</div>
          <div className="barraPanel">
            <button className="boton" onClick={exportar} disabled={grupo === null}>⬇ Exportar</button>
            <button className="boton" onClick={añadirGrafico} disabled={ocupado || grupo === null || todos}>＋ Añadir</button>
            <button className="boton" onClick={borrarGrafico} disabled={ocupado || seleccion === null}>－ Borrar</button>
            <button className="boton" onClick={deshacerBorrado} disabled={ocupado || borradas.length === 0}>↺ Deshacer borrar</button>
            <button className="boton" onClick={recalcular} disabled={ocupado || grupo === null}>Σ Recalcular</button>
            <button className="boton" onClick={deducirTurno} disabled={ocupado || grupo === null}>☰ Deducir turno</button>
            <button className="boton" onClick={deducirDia} disabled={ocupado || grupo === null}>📅 Deducir día</button>
            <span className="hueco" />
            <select className="celda" value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
              <option value="0">Sin Agrupar</option>
              <option value="1">Por turno</option>
              <option value="2">Por tipo de día</option>
            </select>
          </div>
          <div className="marcoRejilla">
            <table className="rejilla rejillaGraficos">
              <thead>
                <tr>
                  <th>Cat</th><th>Número</th><th>D</th><th>Turno</th>
                  <th>Inicio</th><th>Final</th><th>Inicio Par.</th><th>Final Par.</th>
                  <th>Valoración</th><th>Trabajadas</th><th>T.Vacio</th>
                  <th>Acumuladas</th><th>Nocturnas</th>
                  <th>Desayuno</th><th>Comida</th><th>Cena</th><th>Plus Cena</th>
                  <th>Paq</th><th>T. Total</th><th>T. Par.</th><th>No calc</th><th>Error</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const salidas: ReactNode[] = [];
                  let claveGrupo = "";
                  for (const g of ordenadas) {
                    if (agrupar !== "0") {
                      const clave = String(agrupar === "1" ? g.turno : g.tipoDia);
                      if (clave !== claveGrupo) {
                        claveGrupo = clave;
                        const etiqueta = agrupar === "1"
                          ? (Number(clave) === 0 ? "Sin turno" : `T${clave} · ${nombreEnum(Turno, Number(clave))}`)
                          : `${ETIQUETA_TIPO_DIA_O2[Number(clave)] ?? clave}`;
                        salidas.push(<tr key={`grupo-${clave}`} className="filaGrupo"><td colSpan={22}>{etiqueta}</td></tr>);
                      }
                    }
                    salidas.push(
                      <tr
                        key={g.id === undefined ? `nueva-${g.numero}-${salidas.length}` : String(g.id)}
                        className={seleccion !== null && filas[seleccion] === g ? "sel" : undefined}
                        onClick={() => setSeleccion(filas.indexOf(g))}
                        onDoubleClick={() => { setSeleccion(filas.indexOf(g)); setDetalle(true); }}
                      >
                        <td className="centradoMic">
                          <select className="celda corto" value={String(g.categoria)} onChange={(e) => actualizar(g, { categoria: Number(e.target.value) })} title={nombreEnum(CategoriaGrafico, g.categoria)}>
                            {CATEGORIAS.map((v) => <option key={v} value={String(v)}>{ABRE_CATEGORIA[v]}</option>)}
                          </select>
                        </td>
                        <td>{celdaTexto(String(g.numero), (v) => {
                          const n = Number.parseInt(v, 10);
                          if (Number.isInteger(n)) actualizar(g, { numero: n });
                        }, "celda celdaNum")}</td>
                        <td className="centradoMic">
                          <select className="celda corto" value={String(g.tipoDia)} onChange={(e) => actualizar(g, { tipoDia: Number(e.target.value) })} title={ETIQUETA_TIPO_DIA[g.tipoDia]}>
                            {TIPOS_DIA.map((v) => <option key={v} value={String(v)}>{LETRA_TIPO_DIA[v]}</option>)}
                          </select>
                        </td>
                        <td className="centradoMic">
                          <select className="celda corto" value={String(g.turno)} onChange={(e) => actualizar(g, { turno: Number(e.target.value) })} title={nombreEnum(Turno, g.turno)}>
                            {TURNOS.map((v) => <option key={v} value={String(v)}>{v === 0 ? "" : String(v)}</option>)}
                          </select>
                        </td>
                        {celdaHora(g, "inicio")}
                        {celdaHora(g, "final")}
                        {celdaHora(g, "inicioPartido")}
                        {celdaHora(g, "finalPartido")}
                        {celdaHora(g, "valoracion")}
                        <td className={`centradoMic${g.tieneErrorTiempoPartido ? " errorCelda" : ""}`}>{duracion(g.trabajadas)}</td>
                        <td className="centradoMic">{duracion(g.tiempoVacio)}</td>
                        <td className="centradoMic">{duracion(g.acumuladas)}</td>
                        <td className="centradoMic">{duracion(g.nocturnas)}</td>
                        {celdaDieta(g, "desayuno")}
                        {celdaDieta(g, "comida")}
                        {celdaDieta(g, "cena")}
                        {celdaDieta(g, "plusCena")}
                        <td className="centradoMic">{g.tienePlusPaqueteria ? "Sí" : "No"}</td>
                        <td className="centradoMic">{duracion(g.tiempoTotal)}</td>
                        <td className="centradoMic">{duracion(g.tiempoPartido)}</td>
                        <td className="centradoMic"><input type="checkbox" checked={g.noCalcular} onChange={(e) => actualizar(g, { noCalcular: e.target.checked })} /></td>
                        <td className="centradoMic">{g.tieneErrorTiempoPartido ? "*" : ""}</td>
                      </tr>,
                    );
                  }
                  return salidas;
                })()}
                {filas.length === 0 ? (
                  <tr><td colSpan={22} className="vacio">{grupo === null ? "Selecciona un grupo de gráficos." : "Sin gráficos en este grupo."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="barraEstado">{totales}</p>
      {detalle && seleccionada !== null ? (
        <DetalleGrafico
          fila={seleccionada}
          onCambiar={(cambios) => actualizar(seleccionada, cambios)}
          onCambiarIt={(i, cambios) => actualizarIt(i, cambios)}
          onBorrarIt={borrarItDetalle}
          onDeshacerIt={deshacerItDetalle}
          borradasIt={borradasIt}
          onCerrar={() => setDetalle(false)}
        />
      ) : null}
    </div>
  );
}

/** Etiquetas de tipo de día para los separadores (versión corta). */
const ETIQUETA_TIPO_DIA_O2: Record<number, string> = {
  0: "Sin tipo", 1: "Lunes_Jueves", 2: "Viernes", 3: "Sabado",
  4: "Festivo", 5: "Reserva", 6: "Reduccion_Jornada",
};
