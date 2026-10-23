/**
 * Pantalla Reclamaciones — aspecto de Orión 2 (`ReclamacionesView` + la
 * ventana «Detalle de reclamación»): conductores a la izquierda (banda
 * «CONDUCTORES - centro») y a la derecha la lista de reclamaciones del
 * conductor elegido con su nº, horas, dietas, pluses e importe. Barra
 * superior con Volver / Guardar y Actualizar / Descartar Cambios; barra
 * con «+ Añadir», «－ Borrar» y el filtro «Año Actual» + combo de
 * agrupación (Sin agrupar / Por año). Doble clic en una reclamación abre
 * el DETALLE como modal: fechas, notas, nota interna, botón «En curso»,
 * CONCEPTOS RECLAMADOS (Res/Día/Tipo/Descripción/Gráfico/Real/En pijama/
 * Diferencia/Importe) con Añadir/Borrar/Deshacer borrar/Recalcular notas,
 * y Generar PDF / Cerrar. «Guardar» sigue `GuardarListaAsync`: baja de
 * conceptos → altas → cambios → recarga.
 */
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { pedirTexto } from "../lib/dialogos";
import { duracion, importe, minutosDeHora, parseHora } from "../lib/horas";
import { pdfReclamacion } from "../lib/pdf";
import {
  TipoReclamacion, esResuelta, notas as notasDe, nuevoConceptoReclamado,
  nombreEnum, TiposDieta,
  type ConceptoReclamado, type Reclamacion,
} from "@mercurio/domain";

/** Tipos cuyo importeReal/importeCobrado son UNIDADES (dietas y pendientes). */
const UNIDADES: readonly number[] = [
  ...TiposDieta, TipoReclamacion.TotalDc, TipoReclamacion.TotalDnd,
];

const DIETAS: readonly number[] = [...TiposDieta];

const TIPOS: TipoReclamacion[] = Object.values(TipoReclamacion).filter(
  (v): v is TipoReclamacion => typeof v === "number",
);

interface ConductorCombo {
  id: number;
  centro: number;
  matricula: number;
  nombre: string;
  apellidos: string;
}

const CENTROS = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];

/** Nº de centro a partir del nombre (misma tabla que la barra superior). */
function centroIndex(nombre: string): number {
  return CENTROS.indexOf(nombre) < 0 ? 0 : CENTROS.indexOf(nombre);
}

/** "AAAA-MM-01" → "MM - AAAA" (formato de la lista del original). */
function mesCorto(fecha: string): string {
  return fecha === "" ? "" : `${fecha.slice(5, 7)} - ${fecha.slice(0, 4)}`;
}

/** Mes del conductor para el alta (hoy, como DateTime.Today del original). */
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---- agregados de la lista (Horas / Dietas / Pluses / Importe) ----

function sumaHoras(r: Reclamacion): number {
  return r.conceptosReclamados.reduce((s, c) => s + c.horasReales, 0);
}

function sumaDietas(r: Reclamacion): number {
  return r.conceptosReclamados
    .filter((c) => DIETAS.includes(c.tipo))
    .reduce((s, c) => s + c.importeReal, 0);
}

function sumaPluses(r: Reclamacion): number {
  return r.conceptosReclamados
    .filter((c) => !UNIDADES.includes(c.tipo))
    .reduce((s, c) => s + c.importeCobrado, 0);
}

function sumaImporte(r: Reclamacion): number {
  return r.conceptosReclamados.reduce((s, c) => s + c.importeTotal, 0);
}

/** Unidades de dieta/pendiente → texto "0.##" con coma (es-ES). */
function unidadesTexto(v: number): string {
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

// ---- VENTANA «DETALLE DE RECLAMACIÓN» (modal) ----

function DetalleReclamacion({ rec, conductor, ocupado, onCambiar, onCambiarConcepto, onAñadirConcepto, onBorrarConcepto, onDeshacerConcepto, hayBorrados, onMarcarResuelta, onRecalcularNotas, onPdf, onCerrar }: {
  rec: Reclamacion;
  conductor: ConductorCombo;
  ocupado: boolean;
  onCambiar: (cambios: Partial<Reclamacion>) => void;
  onCambiarConcepto: (c: ConceptoReclamado, cambios: Partial<ConceptoReclamado>) => void;
  onAñadirConcepto: () => void;
  onBorrarConcepto: (c: ConceptoReclamado) => void;
  onDeshacerConcepto: () => void;
  hayBorrados: boolean;
  onMarcarResuelta: () => void;
  onRecalcularNotas: () => void;
  onPdf: () => void;
  onCerrar: () => void;
}): ReactNode {
  const [seleccion, setSeleccion] = useState<ConceptoReclamado | null>(null);

  const conceptos = [...rec.conceptosReclamados]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.id ?? 0) - (b.id ?? 0));

  /** La diferencia real - en pijama en minutos (puede ser negativa). */
  function diferencia(c: ConceptoReclamado): string {
    const d = c.horasReales - c.horasCobradas;
    const signo = d < 0 ? "-" : "";
    return signo + duracion(Math.abs(d));
  }

  return (
    <div className="veloDetalle" onClick={onCerrar}>
      <div className="ventanaDetalle ventanaReclamacion" onClick={(e) => e.stopPropagation()}>
        <div className="cabeceraVentana">
          <span>Detalle de reclamación</span>
          <button className="cerrarVentana" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="encabezadoGrafico">
          <h2>{conductor.matricula}: {conductor.nombre} {conductor.apellidos}</h2>
          <h2 className="derecha">Nº Reclamación: {rec.codigo ?? ""}</h2>
        </div>
        <div className="detalleCuerpo">
          <div className="formTrabajador ancho">
            <div className="formDuo">
              <label className="campoTrabajador">
                <span className="etiquetaCampo">Fecha</span>
                <input
                  key={`fecha-${rec.id ?? "nuevo"}-${rec.fecha}`}
                  type="date"
                  className="campoEntrada"
                  defaultValue={rec.fecha}
                  onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onCambiar({ fecha: e.target.value }); }}
                  onBlur={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onCambiar({ fecha: e.target.value }); }}
                />
              </label>
              <label className="campoTrabajador">
                <span className="etiquetaCampo">Fecha de envío</span>
                <input
                  key={`envio-${rec.id ?? "nuevo"}-${rec.fechaEfecto}`}
                  type="date"
                  className="campoEntrada"
                  defaultValue={rec.fechaEfecto}
                  onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onCambiar({ fechaEfecto: e.target.value }); }}
                  onBlur={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onCambiar({ fechaEfecto: e.target.value }); }}
                />
              </label>
            </div>
            <label className="campoTrabajador alto">
              <span className="etiquetaCampo">Notas</span>
              <textarea
                key={`notas-${rec.id ?? "nuevo"}-${rec.notas ?? ""}`}
                className="campoEntrada"
                defaultValue={rec.notas ?? ""}
                onChange={(e) => onCambiar({ notas: e.target.value })}
                onBlur={(e) => onCambiar({ notas: e.target.value })}
              />
            </label>
            <label className="campoTrabajador alto">
              <span className="etiquetaCampo">Nota interna</span>
              <textarea
                key={`interna-${rec.id ?? "nuevo"}-${rec.notaInterna ?? ""}`}
                className="campoEntrada"
                defaultValue={rec.notaInterna ?? ""}
                onChange={(e) => onCambiar({ notaInterna: e.target.value })}
                onBlur={(e) => onCambiar({ notaInterna: e.target.value })}
              />
            </label>
            <button
              className={`botonFicha${rec.cerrada ? "" : " pulsado"}`}
              onClick={() => onCambiar({ cerrada: !rec.cerrada })}
              title="Cambia entre «En curso» y «Cerrada»"
            >
              {rec.cerrada ? "Cerrada" : "En curso"}
            </button>
          </div>
          <div className="panelReclamaciones">
            <div className="bandaTitulo">CONCEPTOS RECLAMADOS</div>
            <div className="barraPanel">
              <button className="boton" onClick={onAñadirConcepto}>＋ Añadir</button>
              <button className="boton" onClick={() => seleccion !== null && onBorrarConcepto(seleccion)} disabled={seleccion === null}>－ Borrar</button>
              <button className="boton" onClick={onDeshacerConcepto} disabled={!hayBorrados}>↺ Deshacer borrar</button>
              <span className="separadorPanel" />
              <button className="boton" onClick={onMarcarResuelta} title="Marca Res en todos los conceptos">✓ Resueltos</button>
              <button className="boton" onClick={onRecalcularNotas}>Σ Recalcular notas</button>
            </div>
            <div className="marcoRejilla alta">
              <table className="rejilla">
                <thead>
                  <tr>
                    <th>Res</th><th>Día</th><th>Tipo</th><th>Descripción</th><th>Gráfico</th>
                    <th>Real</th><th>En pijama</th><th>Diferencia</th><th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {conceptos.map((c) => {
                    const clases = c.resuelto ? "filaResuelta" : undefined;
                    return (
                      <tr
                        key={c.id === undefined ? `cx-${c.fecha}-${rec.conceptosReclamados.indexOf(c)}` : String(c.id)}
                        className={`${clases ?? ""}${seleccion === c ? " sel" : ""}`.trim()}
                        onClick={() => setSeleccion(c)}
                      >
                        <td className="centradoMic">
                          <input type="checkbox" checked={c.resuelto} onChange={(e) => onCambiarConcepto(c, { resuelto: e.target.checked })} />
                        </td>
                        <td className="centradoMic">
                          <input
                            key={`cfecha-${c.id ?? "nuevo"}-${c.fecha}`}
                            type="date"
                            className="celda celdaFecha"
                            defaultValue={c.fecha}
                            onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onCambiarConcepto(c, { fecha: e.target.value }); }}
                            onBlur={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onCambiarConcepto(c, { fecha: e.target.value }); }}
                          />
                        </td>
                        <td>
                          <select
                            className="celda"
                            value={String(c.tipo)}
                            onChange={(e) => onCambiarConcepto(c, { tipo: Number(e.target.value) })}
                          >
                            {TIPOS.map((t) => <option key={t} value={String(t)}>{nombreEnum(TipoReclamacion, t)}</option>)}
                          </select>
                        </td>
                        <td>{(() => {
                          const alCambiar = (e: React.ChangeEvent<HTMLInputElement>): void => {
                            onCambiarConcepto(c, { descripcion: e.target.value === "" ? null : e.target.value });
                          };
                          return <input key={`txt-${c.id ?? "nuevo"}-${String(c.descripcion ?? "")}`} className="celda" defaultValue={String(c.descripcion ?? "")} onChange={alCambiar} onBlur={alCambiar} />;
                        })()}</td>
                        {(() => {
                          const alCambiar = (e: React.ChangeEvent<HTMLInputElement>): void => {
                            const n = Number(e.target.value);
                            onCambiarConcepto(c, { graficoTrabajado: Number.isFinite(n) ? Math.trunc(n) : 0 });
                          };
                          return <td className="centradoMic"><input key={`graf-${c.id ?? "nuevo"}-${String(c.graficoTrabajado)}`} className="celda celdaNum" defaultValue={c.graficoTrabajado === 0 ? "" : String(c.graficoTrabajado)} onChange={alCambiar} onBlur={alCambiar} /></td>;
                        })()}
                        {(() => {
                          const alCambiar = (e: React.ChangeEvent<HTMLInputElement>): void => {
                            const t = e.target.value.trim();
                            if (t === "") { onCambiarConcepto(c, { horasReales: 0 }); return; }
                            const m = minutosDeHora(t) ?? parseHora(t);
                            if (m !== null) onCambiarConcepto(c, { horasReales: m });
                          };
                          return <td><input key={`hr-${c.id ?? "nuevo"}-${duracion(c.horasReales)}`} className="celda celdaHora" defaultValue={duracion(c.horasReales)} onChange={alCambiar} onBlur={alCambiar} /></td>;
                        })()}
                        {(() => {
                          const alCambiar = (e: React.ChangeEvent<HTMLInputElement>): void => {
                            const t = e.target.value.trim();
                            if (t === "") { onCambiarConcepto(c, { horasCobradas: 0 }); return; }
                            const m = minutosDeHora(t) ?? parseHora(t);
                            if (m !== null) onCambiarConcepto(c, { horasCobradas: m });
                          };
                          return <td><input key={`hc-${c.id ?? "nuevo"}-${duracion(c.horasCobradas)}`} className="celda celdaHora" defaultValue={duracion(c.horasCobradas)} onChange={alCambiar} onBlur={alCambiar} /></td>;
                        })()}
                        <td className="num centradoMic">{diferencia(c)}</td>
                        {(() => {
                          const enUnidades = UNIDADES.includes(c.tipo);
                          const v = c.importeTotal;
                          const texto = enUnidades ? unidadesTexto(v) : importe(v);
                          const alCambiar = (e: React.ChangeEvent<HTMLInputElement>): void => {
                            const n = Number(e.target.value.trim().replace(",", "."));
                            if (!Number.isFinite(n)) return;
                            onCambiarConcepto(c, { importeTotal: enUnidades ? n : Math.round(n * 100) });
                          };
                          return <td className="num"><input key={`it-${c.id ?? "nuevo"}-${texto}`} className="celda celdaNum" defaultValue={v === 0 ? "" : texto} onChange={alCambiar} onBlur={alCambiar} /></td>;
                        })()}
                      </tr>
                    );
                  })}
                  {conceptos.length === 0 ? (
                    <tr><td colSpan={9} className="vacio">Sin conceptos.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="pieVentana pieReclamacion">
          <button className="boton" onClick={onPdf} disabled={ocupado}>Generar PDF</button>
          <span className="hueco" />
          <button className="boton" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ---- PANTALLA RECLAMACIONES ----

export function PantallaReclamaciones({ servidor, token, centro, mes, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  mes: string;
  onVolver: () => void;
}): ReactNode {
  const [conductores, setConductores] = useState<ConductorCombo[]>([]);
  const [idConductor, setIdConductor] = useState<number | null>(null);
  const [reclamaciones, setReclamaciones] = useState<Reclamacion[]>([]);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [borrados, setBorrados] = useState<ConceptoReclamado[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState(false);
  const [soloAño, setSoloAño] = useState(false);
  const [agrupar, setAgrupar] = useState("0");

  /// ---- carga ----

  function cargarConductores(): void {
    setOcupado(true);
    setError(null);
    api<{ conductores: ConductorCombo[] }>(servidor, token, `conductores?centro=${centroIndex(centro)}`)
      .then((r) => {
        setConductores(r.conductores);
        setIdConductor(r.conductores[0]?.id ?? null);
        if (r.conductores.length > 0) cargarReclamaciones(r.conductores[0].id);
        else setReclamaciones([]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  function cargarReclamaciones(id: number): void {
    if (id <= 0) { setReclamaciones([]); setSeleccionada(null); return; }
    setOcupado(true);
    setError(null);
    api<{ reclamaciones: Reclamacion[] }>(servidor, token, `reclamaciones?idConductor=${id}`)
      .then((r) => {
        setReclamaciones(r.reclamaciones);
        setSeleccionada(r.reclamaciones.length > 0 ? 0 : null);
        setBorrados([]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  function cambiarConductor(id: number): void {
    setIdConductor(id);
    setSeleccionada(null);
    cargarReclamaciones(id);
  }

  useEffect(cargarConductores, [servidor, token, centro]);

  const conductor = conductores.find((c) => c.id === idConductor) ?? null;
  const rec = seleccionada !== null && seleccionada >= 0 && seleccionada < reclamaciones.length
    ? reclamaciones[seleccionada] as Reclamacion
    : null;

  // ---- edición: cambio directo en el estado (como OnPropertyChanged) ----

  function cambiarSeleccionada(cambios: Partial<Reclamacion>): void {
    if (seleccionada === null) return;
    setReclamaciones(reclamaciones.map((r, i) => (i === seleccionada ? { ...r, ...cambios } : r)));
  }

  function cambiarConcepto(c: ConceptoReclamado, cambios: Partial<ConceptoReclamado>): void {
    if (seleccionada === null) return;
    setReclamaciones(reclamaciones.map((r, i) => (i === seleccionada
      ? { ...r, conceptosReclamados: r.conceptosReclamados.map((x) => (x === c ? { ...x, ...cambios } : x)) }
      : r)));
  }

  // ---- comandos (textos exactos del original) ----

  async function nueva(): Promise<void> {
    if (conductor === null) return;
    const texto = await pedirTexto(
      "Nueva reclamación",
      "Mes (mm/aaaa):",
      `${mes.slice(5, 7)}/${mes.slice(0, 4)}`,
    );
    if (texto === null) return;
    const m = /^(\d{2})\/(\d{4})$/.exec(texto.trim());
    if (m === null) return;
    const fecha = `${m[2]}-${m[1]}-01`;
    if (reclamaciones.some((r) => r.fecha === fecha)) {
      window.alert("Ya hay una reclamación con esa fecha. Elige otra.");
      return;
    }
    const r: Reclamacion = {
      id: undefined,
      conductorId: conductor.id,
      fecha,
      fechaEfecto: hoy(),
      codigo: `${m[2]}${m[1]}${conductor.matricula}`,
      notas: null,
      notaInterna: null,
      cerrada: false,
      conceptosReclamados: [],
    };
    setReclamaciones([r, ...reclamaciones]);
    setSeleccionada(0);
  }

  function añadirConcepto(): void {
    if (rec === null) return;
    const c = nuevoConceptoReclamado({
      reclamacionId: rec.id ?? 0,
      fecha: rec.fecha,
      tipo: TipoReclamacion.OtraImporte,
    });
    cambiarSeleccionada({ conceptosReclamados: [...rec.conceptosReclamados, c] });
  }

  function borrarConcepto(c: ConceptoReclamado): void {
    if (rec === null) return;
    if ((c.id ?? 0) > 0) setBorrados([...borrados, c]);
    cambiarSeleccionada({ conceptosReclamados: rec.conceptosReclamados.filter((x) => x !== c) });
  }

  /** «Deshacer borrar»: devuelve el último concepto borrado de la reclamación. */
  function deshacerConcepto(): void {
    if (rec === null || borrados.length === 0) return;
    const devolver = borrados[borrados.length - 1] as ConceptoReclamado;
    setBorrados(borrados.slice(0, -1));
    cambiarSeleccionada({ conceptosReclamados: [...rec.conceptosReclamados, devolver] });
  }

  function marcarResuelta(): void {
    if (rec === null) return;
    cambiarSeleccionada({
      conceptosReclamados: rec.conceptosReclamados.map((c) => ({ ...c, resuelto: true })),
    });
  }

  function recalcularNotas(): void {
    if (rec === null) return;
    cambiarSeleccionada({ notas: notasDe(rec) });
  }

  async function borrar(): Promise<void> {
    if (rec === null) return;
    setOcupado(true);
    setError(null);
    try {
      if (!window.confirm("¿Borrar la reclamación seleccionada?")) return;
      if ((rec.id ?? 0) > 0) {
        await api(servidor, token, `reclamaciones/${rec.id}`, { metodo: "DELETE" });
      }
      setReclamaciones(reclamaciones.filter((_, i) => i !== seleccionada));
      setSeleccionada(reclamaciones.length > 1 ? 0 : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  /** `GuardarListaAsync`: baja de conceptos → altas → cambios → recarga. */
  async function guardar(): Promise<void> {
    setOcupado(true);
    setError(null);
    try {
      const idsBorrados = borrados.map((c) => c.id).filter((x): x is number => (x ?? 0) > 0);
      if (idsBorrados.length > 0) {
        await api(servidor, token, "conceptosReclamados/lista", {
          metodo: "DELETE",
          cuerpo: borrados.filter((c) => (c.id ?? 0) > 0).map((c) => ({ id: c.id })),
        });
      }
      for (const r of reclamaciones) {
        if (r.id === undefined) {
          await api(servidor, token, "reclamaciones", { metodo: "POST", cuerpo: r });
        } else {
          await api(servidor, token, `reclamaciones/${r.id}`, { metodo: "PUT", cuerpo: r });
        }
      }
      setBorrados([]);
      if (idConductor !== null) cargarReclamaciones(idConductor);
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  async function generarPdf(): Promise<void> {
    if (rec === null || conductor === null) return;
    setOcupado(true);
    setError(null);
    try {
      const bytes = await pdfReclamacion(rec, conductor);
      if (window.mercurio !== undefined) {
        await window.mercurio.guardarPdf(bytes.buffer as ArrayBuffer, `Reclamación ${rec.codigo ?? ""}.pdf`);
      } else {
        // Sin Electron (pruebas en navegador): descarga directa.
        const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `Reclamación ${rec.codigo ?? ""}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  // ---- lista con filtro «Año Actual» y agrupación ----

  const añoActual = mes.slice(0, 4);
  const visibles = soloAño
    ? reclamaciones.filter((r) => r.fecha.slice(0, 4) === añoActual)
    : reclamaciones;

  function cuerpoLista(): ReactNode {
    const salidas: ReactNode[] = [];
    let añoGrupo = "";
    for (const [i, r] of reclamaciones.entries()) {
      if (!visibles.includes(r)) continue;
      if (agrupar !== "0") {
        const año = r.fecha.slice(0, 4);
        if (año !== añoGrupo) {
          añoGrupo = año;
          salidas.push(<tr key={`grupo-${año}`} className="filaGrupo"><td colSpan={5}>{año}</td></tr>);
        }
      }
      salidas.push(
        <tr
          key={r.id === undefined ? `nueva-${i}` : String(r.id)}
          className={seleccionada === i ? "sel" : undefined}
          onClick={() => setSeleccionada(i)}
          onDoubleClick={() => setDetalle(true)}
        >
          <td className="centradoMic">{esResuelta(r) ? "✓" : ""}</td>
          <td className="num">{mesCorto(r.fecha)}</td>
          <td className="num">{r.codigo}</td>
          <td className="num">{duracion(sumaHoras(r))}</td>
          <td className="num">{unidadesTexto(sumaDietas(r))}</td>
          <td className="num">{unidadesTexto(sumaPluses(r))}</td>
          <td className="num">{importe(sumaImporte(r))}</td>
        </tr>,
      );
    }
    return salidas;
  }

  return (
    <div className="pagina paginaReclamacionesO2">
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver} disabled={ocupado}>← Volver</button>
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
        <button className="boton" onClick={() => void guardar()} disabled={ocupado}>💾 Guardar y Actualizar</button>
        <button className="boton" onClick={cargarConductores} disabled={ocupado}>↺ Descartar Cambios</button>
      </div>
      <div className="reclNominasCuerpo reclNominasCuerpoO2">
        <div className="panelPrincipalGraficos panelConductoresRecl">
          <div className="bandaTitulo">CONDUCTORES - {centro}</div>
          <div className="marcoRejilla">
            <table className="rejilla rejillaConductoresRecl">
              <tbody>
                {conductores.map((c) => (
                  <tr
                    key={c.id}
                    className={c.id === idConductor ? "sel" : undefined}
                    onClick={() => cambiarConductor(c.id)}
                  >
                    <td className="num">{c.matricula}</td>
                    <td className="centro">{`${c.nombre} ${c.apellidos}`}</td>
                  </tr>
                ))}
                {conductores.length === 0 ? (
                  <tr><td className="vacio">Sin conductores.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panelPrincipalGraficos">
          <div className="bandaTitulo">RECLAMACIONES - {conductor?.matricula ?? "-"}</div>
          <div className="barraPanel">
            <button className="boton" onClick={() => void nueva()} disabled={ocupado || conductor === null}>＋ Añadir</button>
            <button className="boton" onClick={() => void borrar()} disabled={ocupado || rec === null}>－ Borrar</button>
            <button className="boton" onClick={() => setDetalle(true)} disabled={rec === null}>📋 Detalle</button>
            <span className="hueco" />
            <button className={`botonLote${soloAño ? " pulsado" : ""}`} onClick={() => setSoloAño(!soloAño)}>Año Actual</button>
            <select className="celda" value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
              <option value="0">Sin agrupar</option>
              <option value="1">Por año</option>
            </select>
          </div>
          <div className="marcoRejilla">
            <table className="rejilla rejillaListaRecl">
              <thead>
                <tr>
                  <th>S</th><th>Fecha</th><th>Nº Reclamación</th><th>Horas</th><th>Dietas</th><th>Pluses</th><th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {cuerpoLista()}
                {reclamaciones.length === 0 ? (
                  <tr><td colSpan={7} className="vacio">Sin reclamaciones.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {detalle && rec !== null && conductor !== null ? (
        <DetalleReclamacion
          rec={rec}
          conductor={conductor}
          ocupado={ocupado}
          onCambiar={cambiarSeleccionada}
          onCambiarConcepto={cambiarConcepto}
          onAñadirConcepto={añadirConcepto}
          onBorrarConcepto={borrarConcepto}
          onDeshacerConcepto={deshacerConcepto}
          hayBorrados={borrados.length > 0}
          onMarcarResuelta={marcarResuelta}
          onRecalcularNotas={recalcularNotas}
          onPdf={() => void generarPdf()}
          onCerrar={() => setDetalle(false)}
        />
      ) : null}
    </div>
  );
}
