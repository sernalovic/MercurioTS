/**
 * Pantalla Líneas e itinerarios — port de `LineasViewModel` + `LineasView`:
 * tres rejillas (líneas, itinerarios de la línea elegida y paradas del
 * itinerario elegido). «Guardar» sigue el orden del original: baja de
 * paradas → baja de itinerarios → altas → cambios de líneas → recarga.
 * Importar/Exportar JSON usan un fichero (diálogo del proceso principal vía
 * IPC en Electron, lectura con `<input type="file">`).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { duracion, minutosDeHora, parseHora } from "../lib/horas";
import { nuevaLinea, nuevoItinerario, nuevaParada,
  type Linea, type Itinerario, type Parada,
} from "@mercurio/domain";

export function PantallaLineas({ servidor, token, onVolver }: {
  servidor: string;
  token: string;
  onVolver: () => void;
}): ReactNode {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [bajaLineas, setBajaLineas] = useState<number[]>([]);
  const [bajaItinerarios, setBajaItinerarios] = useState<number[]>([]);
  const [bajaParadas, setBajaParadas] = useState<number[]>([]);
  const [indiceLinea, setIndiceLinea] = useState(-1);
  const [indiceItinerario, setIndiceItinerario] = useState(-1);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entradaJson = useRef<HTMLInputElement>(null);

  // ---- carga ----

  function cargar(): void {
    setOcupado(true);
    setError(null);
    api<{ lineas: Linea[] }>(servidor, token, "lineas")
      .then((r) => {
        setLineas(r.lineas);
        setIndiceLinea(r.lineas.length > 0 ? 0 : -1);
        setIndiceItinerario(-1);
        setBajaLineas([]);
        setBajaItinerarios([]);
        setBajaParadas([]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(cargar, [servidor, token]);

  const linea = indiceLinea >= 0 && indiceLinea < lineas.length ? lineas[indiceLinea] as Linea : null;
  const itinerarios: Itinerario[] = linea?.itinerarios ?? [];
  const itinerario = indiceItinerario >= 0 && indiceItinerario < itinerarios.length
    ? itinerarios[indiceItinerario] as Itinerario
    : null;
  const paradas: Parada[] = itinerario?.paradas ?? [];

  function cambiarLinea(l: Linea, cambios: Partial<Linea>): void {
    setLineas(lineas.map((x) => (x === l ? { ...x, ...cambios } : x)));
  }

  function cambiarItinerario(i: Itinerario, cambios: Partial<Itinerario>): void {
    if (linea === null) return;
    cambiarLinea(linea, { itinerarios: linea.itinerarios.map((x) => (x === i ? { ...x, ...cambios } : x)) });
  }

  function cambiarParada(p: Parada, cambios: Partial<Parada>): void {
    if (itinerario === null) return;
    cambiarItinerario(itinerario, { paradas: itinerario.paradas.map((x) => (x === p ? { ...x, ...cambios } : x)) });
  }

  // ---- comandos ----

  function añadirLinea(): void {
    const l = nuevaLinea({ nombre: "Nueva línea" });
    setLineas([...lineas, l]);
    setIndiceLinea(lineas.length);
  }

  function borrarLinea(): void {
    if (linea === null || indiceLinea < 0) return;
    if ((linea.id ?? 0) > 0 && !bajaLineas.includes(linea.id as number)) {
      setBajaLineas([...bajaLineas, linea.id as number]);
    }
    setLineas(lineas.filter((x) => x !== linea));
    setIndiceLinea(lineas.length > 1 ? Math.max(0, indiceLinea - 1) : -1);
    setIndiceItinerario(-1);
  }

  function añadirItinerario(): void {
    if (linea === null) return;
    const i = nuevoItinerario({ lineaId: linea.id ?? 0, nombre: "Nuevo" });
    cambiarLinea(linea, { itinerarios: [...linea.itinerarios, i] });
    setIndiceItinerario(linea.itinerarios.length);
  }

  function borrarItinerario(): void {
    if (linea === null || itinerario === null || indiceItinerario < 0) return;
    if ((itinerario.id ?? 0) > 0 && !bajaItinerarios.includes(itinerario.id as number)) {
      setBajaItinerarios([...bajaItinerarios, itinerario.id as number]);
    }
    cambiarLinea(linea, { itinerarios: linea.itinerarios.filter((x) => x !== itinerario) });
    setIndiceItinerario(linea.itinerarios.length > 1 ? Math.max(0, indiceItinerario - 1) : -1);
  }

  function añadirParada(): void {
    if (itinerario === null) return;
    const p = nuevaParada({ itinerarioId: itinerario.id ?? 0, orden: itinerario.paradas.length + 1 });
    cambiarItinerario(itinerario, { paradas: [...itinerario.paradas, p] });
  }

  function borrarParada(p: Parada): void {
    if (itinerario === null) return;
    if ((p.id ?? 0) > 0 && !bajaParadas.includes(p.id as number)) {
      setBajaParadas([...bajaParadas, p.id as number]);
    }
    cambiarItinerario(itinerario, { paradas: itinerario.paradas.filter((x) => x !== p) });
  }

  /** `Guardar`: baja de paradas → baja de itinerarios → altas → cambios → recarga. */
  async function guardar(): Promise<void> {
    setOcupado(true);
    setError(null);
    try {
      if (bajaParadas.length > 0) {
        await api(servidor, token, "paradas/lista", {
          metodo: "DELETE",
          cuerpo: bajaParadas.map((id) => ({ id })),
        });
      }
      if (bajaItinerarios.length > 0) {
        await api(servidor, token, "itinerarios/lista", {
          metodo: "DELETE",
          cuerpo: bajaItinerarios.map((id) => ({ id })),
        });
      }
      for (const id of bajaLineas) {
        await api(servidor, token, `lineas/${id}`, { metodo: "DELETE" });
      }
      for (const l of lineas) {
        if (l.id === undefined || l.id === 0) {
          const r = await api<{ id: number }>(servidor, token, "lineas", { metodo: "POST", cuerpo: l });
          l.id = r.id;
        } else {
          await api(servidor, token, `lineas/${l.id}`, { metodo: "PUT", cuerpo: l });
        }
      }
      setBajaLineas([]);
      setBajaItinerarios([]);
      setBajaParadas([]);
      cargar();
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  /** `Exportar`: JSON sangrado de las líneas actuales con diálogo de guardar. */
  async function exportar(): Promise<void> {
    setOcupado(true);
    setError(null);
    try {
      const datos = JSON.stringify(lineas, null, 2);
      if (window.mercurio !== undefined) {
        await window.mercurio.guardarJson(datos, "Líneas e itinerarios.json");
      } else {
        // Sin Electron (pruebas en navegador): descarga directa.
        const url = URL.createObjectURL(new Blob([datos], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "Líneas e itinerarios.json";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  /**
   * `Importar`: lee el JSON con un `<input type=file>` y añade las líneas
   * con sus Ids a 0 (como hacía el ViewModel antes de guardar).
   */
  function importarFichero(ficheros: FileList | null): void {
    if (ficheros === null || ficheros.length === 0) return;
    setOcupado(true);
    setError(null);
    const fichero = ficheros[0];
    fichero.text()
      .then((texto) => {
        const datos = JSON.parse(texto) as Array<Partial<Linea>>;
        if (!Array.isArray(datos)) throw new Error("El fichero no contiene una lista de líneas.");
        const nuevas: Linea[] = datos.map((l) => {
          const copia = nuevaLinea({ nombre: String(l.nombre ?? ""), descripcion: l.descripcion ?? null });
          copia.itinerarios = (l.itinerarios ?? []).map((i) => {
            const it = nuevoItinerario({
              lineaId: 0,
              nombre: String(i.nombre ?? ""),
              descripcion: i.descripcion ?? null,
              tiempoReal: Math.trunc(Number(i.tiempoReal)) || 0,
              tiempoPago: Math.trunc(Number(i.tiempoPago)) || 0,
            });
            it.paradas = (i.paradas ?? []).map((p) => nuevaParada({
              itinerarioId: 0,
              orden: Math.trunc(Number(p.orden)) || 0,
              descripcion: p.descripcion ?? null,
              tiempo: Math.trunc(Number(p.tiempo)) || 0,
            }));
            return it;
          });
          return copia;
        });
        setLineas([...lineas, ...nuevas]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  // ---- render ----

  return (
    <div className="pagina paginaLineasO2">
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver} disabled={ocupado}>← Volver</button>
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
        <button className="boton" onClick={() => void guardar()} disabled={ocupado}>💾 Guardar y Actualizar</button>
        <button className="boton" onClick={cargar} disabled={ocupado}>↺ Descartar Cambios</button>
        <input ref={entradaJson} type="file" accept=".json,application/json" hidden onChange={(e) => importarFichero(e.target.files)} />
      </div>
      <div className="lineasCuerpo lineasCuerpoO2">
        <div className="panelPrincipalGraficos panelLineas">
          <div className="bandaTitulo">LÍNEAS</div>
          <div className="barraPanel">
            <button className="boton" onClick={() => entradaJson.current?.click()} disabled={ocupado}>⬆ Importar</button>
            <button className="boton" onClick={exportar} disabled={ocupado}>⬇ Exportar</button>
            <span className="hueco" />
            <button className="boton" onClick={añadirLinea} disabled={ocupado}>＋</button>
            <button className="boton" onClick={borrarLinea} disabled={ocupado || linea === null}>－</button>
          </div>
          <div className="marcoRejilla">
            <table className="rejilla rejillaLineas">
              <thead><tr><th>Línea</th><th>Descripción</th></tr></thead>
              <tbody>
                {lineas.map((l) => (
                  <tr
                    key={l.id ?? l.nombre}
                    className={l === linea ? "sel" : undefined}
                    onClick={() => { setIndiceLinea(lineas.indexOf(l)); setIndiceItinerario(-1); }}
                  >
                    <td className="num"><input className="celda num" value={l.nombre} onChange={(e) => cambiarLinea(l, { nombre: e.target.value })} /></td>
                    <td className="centro"><input className="celda centro" value={l.descripcion ?? ""} onChange={(e) => cambiarLinea(l, { descripcion: e.target.value })} /></td>
                  </tr>
                ))}
                {lineas.length === 0 ? <tr><td colSpan={2} className="vacio">No hay líneas.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="lineasDerecha">
          <div className="panelPrincipalGraficos panelItinerarios">
            <div className="bandaTitulo">ITINERARIOS</div>
            <div className="barraPanel">
              <span className="pistaDoble">Itinerarios de la línea seleccionada</span>
              <span className="hueco" />
              <button className="boton" onClick={añadirItinerario} disabled={linea === null}>＋</button>
              <button className="boton" onClick={borrarItinerario} disabled={linea === null || itinerario === null}>－</button>
            </div>
            <div className="marcoRejilla">
              <table className="rejilla rejillaLineas">
                <thead><tr><th>Itinerario</th><th>Descripción</th><th>T.Real</th><th>T.Pago</th></tr></thead>
                <tbody>
                  {itinerarios.map((i) => (
                    <tr
                      key={i.id ?? i.nombre}
                      className={i === itinerario ? "sel" : undefined}
                      onClick={() => setIndiceItinerario(itinerarios.indexOf(i))}
                    >
                      <td className="num"><input className="celda num" value={i.nombre} onChange={(e) => cambiarItinerario(i, { nombre: e.target.value })} /></td>
                      <td className="centro"><input className="celda centro" value={i.descripcion ?? ""} onChange={(e) => cambiarItinerario(i, { descripcion: e.target.value })} /></td>
                      <td><input className="celda num" value={i.tiempoReal === 0 ? "" : String(i.tiempoReal)} onChange={(e) => {
                        const v = Number.parseInt(e.target.value, 10);
                        if (Number.isInteger(v)) cambiarItinerario(i, { tiempoReal: v });
                      }} /></td>
                      <td><input className="celda num" value={i.tiempoPago === 0 ? "" : String(i.tiempoPago)} onChange={(e) => {
                        const v = Number.parseInt(e.target.value, 10);
                        if (Number.isInteger(v)) cambiarItinerario(i, { tiempoPago: v });
                      }} /></td>
                    </tr>
                  ))}
                  {itinerarios.length === 0 ? <tr><td colSpan={4} className="vacio">Sin itinerarios.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panelPrincipalGraficos panelParadas">
            <div className="bandaTitulo">PARADAS</div>
            <div className="barraPanel">
              <span className="pistaDoble">Paradas del itinerario seleccionado</span>
              <span className="hueco" />
              <button className="boton" onClick={añadirParada} disabled={itinerario === null}>＋</button>
              <button className="boton" onClick={() => itinerario !== null && borrarParada(itinerario.paradas[itinerario.paradas.length - 1] as Parada)} disabled={itinerario === null || paradas.length === 0}>－</button>
            </div>
            <div className="marcoRejilla">
              <table className="rejilla rejillaLineas">
                <thead><tr><th>Orden</th><th>Parada</th><th>Tiempo</th></tr></thead>
                <tbody>
                  {paradas.map((p, n) => (
                    <tr key={p.id ?? n}>
                      <td className="num"><input className="celda num" value={p.orden === 0 ? "" : String(p.orden)} onChange={(e) => {
                        const v = Number.parseInt(e.target.value, 10);
                        if (Number.isInteger(v)) cambiarParada(p, { orden: v });
                      }} /></td>
                      <td className="centro"><input className="celda centro" value={p.descripcion ?? ""} onChange={(e) => cambiarParada(p, { descripcion: e.target.value })} /></td>
                      <td className="num">
                        <input
                          className="celda num"
                          value={duracion(p.tiempo)}
                          onChange={(e) => {
                            const v = minutosDeHora(e.target.value) ?? parseHora(e.target.value);
                            if (v !== null) cambiarParada(p, { tiempo: v });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                  {paradas.length === 0 ? <tr><td colSpan={3} className="vacio">Sin paradas.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <p className="barraEstado">
        Líneas: {lineas.length} · Itinerarios: {itinerarios.length} · Paradas: {paradas.length}
        {" · Las bajas y altas se guardan con «Guardar y Actualizar»."}
      </p>
    </div>
  );
}
