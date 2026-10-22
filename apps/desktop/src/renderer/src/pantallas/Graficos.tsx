/**
 * Pantalla Gráficos — port de `GraficosViewModel` + `GraficosView`:
 * grupos por fecha de validez (lista a la izquierda), rejilla editable de
 * gráficos e itinerarios del gráfico seleccionado. El recálculo, la
 * deducción de tipo de día y de turno se hacen en el cliente con el dominio
 * (`CalculosHorario`), como en el original, y solo se persiste al pulsar
 * «Guardar» (bajas → altas → cambios → recarga). El original tenía botones
 * «Importar/Exportar JSON» sin comando asociado en el ViewModel: no se portan.
 */
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { api } from "../lib/api";
import { duracion, hora, minutosDeHora, euros } from "../lib/horas";
import {
  CalculosHorario, TipoDia, Turno, CategoriaGrafico, nombreEnum, Duracion,
  type Convenio, type Grafico, type ItinerarioGrafico, type CentroTrabajo,
} from "@mercurio/domain";

const CENTROS = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];

const CATEGORIAS = [CategoriaGrafico.Conduccion, CategoriaGrafico.Taquilla];
const TIPOS_DIA = [
  TipoDia.Ninguno, TipoDia.LunesJueves, TipoDia.Viernes, TipoDia.Sabado,
  TipoDia.Festivo, TipoDia.Reserva, TipoDia.ReduccionJornada,
];
const TURNOS = [Turno.SinTurno, Turno.Manana, Turno.Tarde, Turno.Noche, Turno.Partido];

type CampoHora = "inicio" | "final" | "inicioPartido" | "finalPartido" | "valoracion";
type CampoDieta = "desayuno" | "comida" | "cena" | "plusCena";

export function PantallaGraficos({ servidor, token, centro, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  onVolver: () => void;
}): ReactNode {
  const [grupos, setGrupos] = useState<string[]>([]);
  const [grupo, setGrupo] = useState<string | null>(null);
  const [filas, setFilas] = useState<Grafico[]>([]);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [borradas, setBorradas] = useState<Grafico[]>([]);
  const [borradasIt, setBorradasIt] = useState<ItinerarioGrafico[]>([]);
  const [convenio, setConvenio] = useState<Convenio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const numeroCentro: CentroTrabajo = centro === "Todos" ? 0 : (CENTROS.indexOf(centro) as CentroTrabajo);

  function cargarGrupos(): void {
    setOcupado(true);
    setError(null);
    setFilas([]);
    setGrupo(null);
    setSeleccion(null);
    api<{ grupos: string[] }>(servidor, token, `graficos/grupos?centro=${numeroCentro}`)
      .then((r) => setGrupos(r.grupos))
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

  // ---- celdas (funciones que devuelven JSX: sin frontera de componente,
  // así React conserva el nodo y su valor sin control entre renders). El
  // commit va en `onChange` y en `onBlur`: se recalcule o cambie de celda,
  // el valor válido queda siempre en el estado. ----

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

  /** Celda de dietas (unidades) o importes (plusCena, céntimos). */
  function celdaDieta(fila: Grafico, campo: CampoDieta): ReactNode {
    const dietas = ["desayuno", "comida", "cena"].includes(campo);
    const alCambiar = (e: ChangeEvent<HTMLInputElement>): void => {
      const n = Number(e.target.value.trim().replace(",", "."));
      if (!Number.isFinite(n) || n < 0) return;
      actualizar(fila, { [campo]: dietas ? n : Math.round(n * 100) });
    };
    const textoCelda = dietas
      ? String(Math.round(fila[campo as "desayuno"] * 100) / 100)
      : euros(fila[campo as "plusCena"]);
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
    if (grupo === null) return;
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

  /** Deduce el tipo de día de cada gráfico a partir de los rangos de números del centro. */
  function deducirDia(): void {
    const calc = new CalculosHorario(convenio);
    setFilas(filas.map((g) => ({ ...g, tipoDia: calc.tipoDiaGrafico(g.numero, numeroCentro) })));
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
    return `Gráficos: ${lista.length}   T1: ${lista.filter((g) => g.turno === Turno.Manana).length}   ` +
      `T2: ${lista.filter((g) => g.turno === Turno.Tarde).length}   T3: ${lista.filter((g) => g.turno === Turno.Noche).length}   ` +
      `T4: ${lista.filter((g) => g.turno === Turno.Partido).length}   ` +
      `Trabajadas: ${duracion(t)}   Acumuladas: ${duracion(a)}   Nocturnas: ${duracion(n)}`;
  }

  // ---- grupos ----

  function nuevoGrupo(): void {
    if (centro === "Todos") {
      window.alert("Selecciona un centro concreto.");
      return;
    }
    const hoy = new Date();
    const texto = window.prompt(
      "Nuevo grupo de gráficos\n\nFecha de validez (dd/mm/aaaa):",
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
    // El convenio del año de la nueva validez (el original lo cargaba al
    // cambiar de grupo; aquí también al crear el grupo, para poder recalcular).
    cargarConvenio(Number(fecha.slice(0, 4)));
    setFilas(copia);
    setSeleccion(null);
  }

  async function borrarGrupo(): Promise<void> {
    if (grupo === null) return;
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

  // ---- itinerarios ----

  function añadirItinerario(): void {
    if (seleccionada === null) return;
    const i: ItinerarioGrafico = {
      graficoId: seleccionada.id,
      inicio: null,
      itinerario: null,
      descripcion: null,
      final: null,
      tiempoTotal: 0,
    };
    actualizar(seleccionada, { itinerarios: [...seleccionada.itinerarios, i] });
  }

  function borrarItinerario(i: ItinerarioGrafico): void {
    if (seleccionada === null) return;
    setBorradasIt([...borradasIt, i]);
    actualizar(seleccionada, { itinerarios: seleccionada.itinerarios.filter((x) => x !== i) });
  }

  function calcularDuraciones(): void {
    if (seleccionada === null) return;
    const orden = seleccionada.itinerarios
      .map((i) => ({ ...i, tiempoTotal: Duracion(i.inicio, i.final) }))
      .sort((a, b) => (a.inicio ?? 99999) - (b.inicio ?? 99999));
    actualizar(seleccionada, { itinerarios: orden });
  }

  /** Celdas de texto de itinerario (mitad editable, mitad solo lectura). */
  function celdaTextoIt(i: ItinerarioGrafico, campo: "itinerario" | "descripcion"): ReactNode {
    const alCambiar = (e: ChangeEvent<HTMLInputElement>): void => {
      const t = e.target.value.trim();
      actualizarIt(i, { [campo]: t === "" ? null : t });
    };
    return (
      <td>
        <input
          key={`it-${campo}-${String(i[campo] ?? "")}`}
          className="celda"
          defaultValue={String(i[campo] ?? "")}
          onChange={alCambiar}
          onBlur={alCambiar}
        />
      </td>
    );
  }

  function horarioIt(i: ItinerarioGrafico, campo: "inicio" | "final"): ReactNode {
    const alCambiar = (e: ChangeEvent<HTMLInputElement>): void => {
      const m = minutosDeHora(e.target.value);
      actualizarIt(i, { [campo]: m });
    };
    return (
      <td>
        <input
          key={`ith-${campo}-${String(i[campo])}`}
          className="celda celdaHora"
          defaultValue={hora(i[campo])}
          onChange={alCambiar}
          onBlur={alCambiar}
        />
      </td>
    );
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

  return (
    <div className="pagina">
      <div className="cabeceraPagina">
        <h2 className="tituloPagina">Gráficos</h2>
        {ocupado ? <span className="cargando">Cargando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
      </div>
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver}>Volver</button>
        <button className="boton" onClick={cargarGrupos} disabled={ocupado}>Recargar</button>
        <button className="boton" onClick={nuevoGrupo} disabled={ocupado}>Nuevo grupo</button>
        <button className="boton" onClick={borrarGrupo} disabled={ocupado || grupo === null}>Borrar grupo</button>
        <span className="hueco" />
        <button className="boton" onClick={añadirGrafico} disabled={ocupado || grupo === null}>Añadir gráfico</button>
        <button className="boton" onClick={borrarGrafico} disabled={ocupado || seleccion === null}>Borrar gráfico</button>
        <button className="boton" onClick={deshacerBorrado} disabled={ocupado || borradas.length === 0}>Deshacer borrado</button>
        <button className="boton" onClick={recalcular} disabled={ocupado || grupo === null}>Recalcular</button>
        <button className="boton" onClick={deducirDia} disabled={ocupado || grupo === null}>Deducir tipo de día</button>
        <button className="boton" onClick={deducirTurno} disabled={ocupado || grupo === null}>Deducir turno</button>
        <span className="hueco" />
        <button className="botonPrincipal" onClick={guardar} disabled={ocupado || grupo === null}>Guardar</button>
      </div>
      <div className="graficosCuerpo">
        <div className="listaGrupos">
          {grupos.map((g) => (
            <button key={g} className={g === grupo ? "botonLista sel" : "botonLista"} onClick={() => elegirGrupo(g)}>
              {g.slice(8, 10)}/{g.slice(5, 7)}/{g.slice(0, 4)}
            </button>
          ))}
          {grupos.length === 0 ? <span className="vacio">Sin grupos.</span> : null}
        </div>
        <div className="graficosDerecha">
          <div className="marcoRejilla">
            <table className="rejilla rejillaGraficos">
              <thead>
                <tr>
                  <th>Nº</th><th>Categoría</th><th>Tipo día</th><th>Turno</th>
                  <th>Inicio</th><th>Final</th><th>Ini. partido</th><th>Fin partido</th>
                  <th>Valoración</th><th>T. total</th><th>T. partido</th>
                  <th>Trabajadas</th><th>T. convenio</th><th>Acumuladas</th><th>Nocturnas</th>
                  <th>Desayuno</th><th>Comida</th><th>Cena</th><th>Plus cena</th>
                  <th>Paquetería</th><th>No calcular</th><th>Error</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((g, i) => (
                  <tr
                    key={g.id === undefined ? `nueva-${i}` : String(g.id)}
                    className={seleccion === i ? "sel" : undefined}
                    onClick={() => setSeleccion(i)}
                  >
                    <td className="num">{g.numero}</td>
                    <td>
                      <select className="celda" value={String(g.categoria)} onChange={(e) => actualizar(g, { categoria: Number(e.target.value) })}>
                        {CATEGORIAS.map((v) => <option key={v} value={String(v)}>{nombreEnum(CategoriaGrafico, v)}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="celda" value={String(g.tipoDia)} onChange={(e) => actualizar(g, { tipoDia: Number(e.target.value) })}>
                        {TIPOS_DIA.map((v) => <option key={v} value={String(v)}>{nombreEnum(TipoDia, v)}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="celda" value={String(g.turno)} onChange={(e) => actualizar(g, { turno: Number(e.target.value) })}>
                        {TURNOS.map((v) => <option key={v} value={String(v)}>{nombreEnum(Turno, v)}</option>)}
                      </select>
                    </td>
                    {celdaHora(g, "inicio")}
                    {celdaHora(g, "final")}
                    {celdaHora(g, "inicioPartido")}
                    {celdaHora(g, "finalPartido")}
                    {celdaHora(g, "valoracion")}
                    <td className="centradoMic">{duracion(g.tiempoTotal)}</td>
                    <td className="centradoMic">{duracion(g.tiempoPartido)}</td>
                    <td className="centradoMic">{duracion(g.trabajadas)}</td>
                    <td className="centradoMic">{duracion(g.trabajadasConvenio)}</td>
                    <td className="centradoMic">{duracion(g.acumuladas)}</td>
                    <td className="centradoMic">{duracion(g.nocturnas)}</td>
                    {celdaDieta(g, "desayuno")}
                    {celdaDieta(g, "comida")}
                    {celdaDieta(g, "cena")}
                    {celdaDieta(g, "plusCena")}
                    <td className="centro"><input type="checkbox" checked={g.tienePlusPaqueteria} onChange={(e) => actualizar(g, { tienePlusPaqueteria: e.target.checked })} /></td>
                    <td className="centro"><input type="checkbox" checked={g.noCalcular} onChange={(e) => actualizar(g, { noCalcular: e.target.checked })} /></td>
                    <td className="centro">{g.tieneErrorTiempoPartido ? "*" : ""}</td>
                  </tr>
                ))}
                {filas.length === 0 ? (
                  <tr><td colSpan={22} className="vacio">{grupo === null ? "Selecciona un grupo de gráficos." : "Sin gráficos en este grupo."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="opcionesPagina">
            <h3 className="tituloSeccion">Itinerarios del gráfico</h3>
            <span className="hueco" />
            <button className="boton" onClick={añadirItinerario} disabled={seleccionada === null}>Añadir itinerario</button>
            <button className="boton" onClick={calcularDuraciones} disabled={seleccionada === null}>Calcular duraciones</button>
          </div>
          <div className="marcoRejilla">
            <table className="rejilla rejillaItinerarios">
              <thead>
                <tr><th>Inicio</th><th>Final</th><th>Itinerario</th><th>Descripción</th><th>Duración</th><th /></tr>
              </thead>
              <tbody>
                {(seleccionada?.itinerarios ?? []).map((i, j) => (
                  <tr key={i.id === undefined ? `ita-${j}` : String(i.id)}>
                    {horarioIt(i, "inicio")}
                    {horarioIt(i, "final")}
                    {celdaTextoIt(i, "itinerario")}
                    {celdaTextoIt(i, "descripcion")}
                    <td className="centradoMic">{duracion(i.tiempoTotal)}</td>
                    <td className="centradoMic"><button className="boton botonMini" onClick={() => borrarItinerario(i)}>−</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="totalesGraficos">{totales}</p>
    </div>
  );
}
