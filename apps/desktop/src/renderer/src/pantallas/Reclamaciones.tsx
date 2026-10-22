/**
 * Pantalla Reclamaciones — port de `ReclamacionesViewModel` + `ReclamacionesView`:
 * lista de reclamaciones del conductor elegido (a la izquierda), detalle con
 * fecha de efecto/cerrada/notas y rejilla editable de conceptos. El PDF se
 * genera en el cliente (port de `Pdf.Reclamacion`) y se guarda con diálogo del
 * proceso principal. «Guardar» sigue `GuardarListaAsync`: baja de conceptos →
 * altas → cambios → recarga.
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

/** "AAAA-MM-01" → "MM/yyyy". */
function mesCorto(fecha: string): string {
  return fecha === "" ? "" : `${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
}

/** Mes del conductor para el alta (hoy, como DateTime.Today del original). */
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

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

  // ---- celdas (funciones que devuelven JSX; commit en onChange + onBlur) ----

  function celdaTexto(c: ConceptoReclamado, campo: "descripcion"): ReactNode {
    const alCambiar = (e: React.ChangeEvent<HTMLInputElement>): void => {
      cambiarConcepto(c, { [campo]: e.target.value === "" ? null : e.target.value });
    };
    return (
      <td>
        <input
          key={`txt-${c.id ?? "nuevo"}-${String(c[campo] ?? "")}`}
          className="celda anchoDescripcion"
          defaultValue={String(c[campo] ?? "")}
          onChange={alCambiar}
          onBlur={alCambiar}
        />
      </td>
    );
  }

  function celdaGrafico(c: ConceptoReclamado): ReactNode {
    const alCambiar = (e: React.ChangeEvent<HTMLInputElement>): void => {
      const n = Number(e.target.value);
      cambiarConcepto(c, { graficoTrabajado: Number.isFinite(n) ? Math.trunc(n) : 0 });
    };
    return (
      <td>
        <input
          key={`graf-${c.id ?? "nuevo"}-${String(c.graficoTrabajado)}`}
          className="celda celdaNum"
          defaultValue={c.graficoTrabajado === 0 ? "" : String(c.graficoTrabajado)}
          onChange={alCambiar}
          onBlur={alCambiar}
        />
      </td>
    );
  }

  function celdaHoras(c: ConceptoReclamado, campo: "horasReales" | "horasCobradas"): ReactNode {
    const alCambiar = (e: React.ChangeEvent<HTMLInputElement>): void => {
      const t = e.target.value.trim();
      if (t === "") cambiarConcepto(c, { [campo]: 0 });
      else {
        const m = minutosDeHora(t) ?? parseHora(t);
        if (m !== null) cambiarConcepto(c, { [campo]: m });
      }
    };
    const texto = duracion(c[campo] as number);
    return (
      <td>
        <input
          key={`${campo}-${c.id ?? "nuevo"}-${texto}`}
          className="celda celdaHora"
          defaultValue={texto}
          onChange={alCambiar}
          onBlur={alCambiar}
        />
      </td>
    );
  }

  function celdaImporte(c: ConceptoReclamado, campo: "importeReal" | "importeCobrado" | "importeTotal"): ReactNode {
    // Total € es siempre importe en céntimos; Real/Cobrado son UNIDADES en
    // dietas y DCs/DNDs pendientes, y céntimos en el resto de pluses.
    const esTotal = campo === "importeTotal";
    const enUnidades = !esTotal && UNIDADES.includes(c.tipo);
    const alCambiar = (e: React.ChangeEvent<HTMLInputElement>): void => {
      const n = Number(e.target.value.trim().replace(",", "."));
      if (!Number.isFinite(n)) return;
      // Céntimos en Total € y pluses; unidades tal cual en dietas y pendientes.
      const valor = esTotal || !enUnidades ? Math.round(n * 100) : n;
      cambiarConcepto(c, { [campo]: valor });
    };
    const v = c[campo] as number;
    const texto = enUnidades ? unidadesTexto(v) : importe(v);
    return (
      <td className="num">
        <input
          key={`${campo}-${c.id ?? "nuevo"}-${texto}`}
          className="celda celdaNum"
          defaultValue={v === 0 ? "" : texto}
          onChange={alCambiar}
          onBlur={alCambiar}
        />
      </td>
    );
  }

  /** Unidades de dieta/pendiente → texto "0.##" con coma (es-ES). */
  function unidadesTexto(v: number): string {
    return String(Math.round(v * 100) / 100).replace(".", ",");
  }

  /** Célula de fecha del concepto ("dd/MM/yyyy", los mensuales en blanco). */
  function celdaFecha(c: ConceptoReclamado): ReactNode {
    return (
      <td>
        <input
          key={`fecha-${c.id ?? "nuevo"}-${c.fecha}`}
          type="date"
          className="celda celdaFecha"
          defaultValue={c.fecha}
          onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) cambiarConcepto(c, { fecha: e.target.value }); }}
          onBlur={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) cambiarConcepto(c, { fecha: e.target.value }); }}
        />
      </td>
    );
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

  // ---- render ----

  return (
    <div className="pagina">
      <div className="cabeceraPagina">
        <h2 className="tituloPagina">Reclamaciones</h2>
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
      </div>
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver} disabled={ocupado}>Volver</button>
        <span className="etiqueta">Conductor:</span>
        <select
          className="combo"
          value={idConductor === null ? "" : String(idConductor)}
          onChange={(e) => cambiarConductor(Number(e.target.value))}
          disabled={ocupado}
        >
          {conductores.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {`${c.matricula} - ${c.nombre} ${c.apellidos}`}
            </option>
          ))}
        </select>
        <button className="boton" onClick={nueva} disabled={ocupado}>Nueva</button>
        <button className="boton" onClick={() => void borrar()} disabled={ocupado || rec === null}>Borrar</button>
        <button className="boton" onClick={marcarResuelta} disabled={ocupado || rec === null}>Marcar resuelta</button>
        <button className="boton" onClick={recalcularNotas} disabled={ocupado || rec === null}>Recalcular notas</button>
        <button className="boton" onClick={() => void generarPdf()} disabled={ocupado || rec === null}>PDF</button>
        <span className="hueco" />
        <button className="botonPrincipal" onClick={() => void guardar()} disabled={ocupado}>Guardar</button>
      </div>
      <div className="reclNominasCuerpo">
        <div className="listaReclamaciones">
          <table className="rejilla rejillaLista">
            <thead>
              <tr><th>Mes</th><th>Código</th><th>Cerr.</th><th>Resu.</th></tr>
            </thead>
            <tbody>
              {reclamaciones.map((r, i) => (
                <tr
                  key={r.id === undefined ? `nueva-${i}` : String(r.id)}
                  className={seleccionada === i ? "sel" : undefined}
                  onClick={() => setSeleccionada(i)}
                >
                  <td>{mesCorto(r.fecha)}</td>
                  <td>{r.codigo}</td>
                  <td className="centro">{r.cerrada ? "✓" : ""}</td>
                  <td className="centro">{esResuelta(r) ? "✓" : ""}</td>
                </tr>
              ))}
              {reclamaciones.length === 0 ? (
                <tr><td colSpan={4} className="vacio">Sin reclamaciones.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="detalleReclamaciones">
          {rec === null ? (
            <p className="vacio">Selecciona una reclamación.</p>
          ) : (
            <>
              <div className="cabeceraDetalle">
                <label className="etiqueta">Fecha de efecto <input
                  type="date"
                  className="celda celdaFecha"
                  defaultValue={rec.fechaEfecto}
                  key={`efecto-${rec.id ?? "nuevo"}-${rec.fechaEfecto}`}
                  onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) cambiarSeleccionada({ fechaEfecto: e.target.value }); }}
                  onBlur={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) cambiarSeleccionada({ fechaEfecto: e.target.value }); }}
                /></label>
                <label className="etiqueta"><input
                  type="checkbox"
                  checked={rec.cerrada}
                  onChange={(e) => cambiarSeleccionada({ cerrada: e.target.checked })}
                /> Cerrada</label>
              </div>
              <div className="cabeceraDetalle">
                <span className="etiqueta">Notas</span>
                <textarea
                  className="celda area"
                  rows={4}
                  key={`notas-${rec.id ?? "nuevo"}-${rec.notas ?? ""}`}
                  defaultValue={rec.notas ?? ""}
                  onChange={(e) => cambiarSeleccionada({ notas: e.target.value })}
                  onBlur={(e) => cambiarSeleccionada({ notas: e.target.value })}
                />
                <span className="etiqueta">Nota interna</span>
                <textarea
                  className="celda area"
                  rows={4}
                  key={`interna-${rec.id ?? "nuevo"}-${rec.notaInterna ?? ""}`}
                  defaultValue={rec.notaInterna ?? ""}
                  onChange={(e) => cambiarSeleccionada({ notaInterna: e.target.value })}
                  onBlur={(e) => cambiarSeleccionada({ notaInterna: e.target.value })}
                />
              </div>
              <div className="opcionesPagina">
                <h3 className="tituloSeccion">Conceptos reclamados</h3>
                <button className="boton" onClick={añadirConcepto}>Añadir concepto</button>
              </div>
              <div className="marcoRejilla">
                <table className="rejilla rejillaReclamaciones">
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Gráfico</th>
                      <th>H. reales</th><th>H. cobradas</th><th>Real</th><th>Cobrado</th>
                      <th>Total €</th><th>Resuelto</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...rec.conceptosReclamados]
                      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.id ?? 0) - (b.id ?? 0))
                      .map((c) => (
                      <tr key={c.id === undefined ? `cx-${c.fecha}-${rec.conceptosReclamados.indexOf(c)}` : String(c.id)}>
                        {celdaFecha(c)}
                        <td>
                          <select
                            className="celda"
                            value={String(c.tipo)}
                            onChange={(e) => cambiarConcepto(c, { tipo: Number(e.target.value) })}
                          >
                            {TIPOS.map((t) => <option key={t} value={String(t)}>{nombreEnum(TipoReclamacion, t)}</option>)}
                          </select>
                        </td>
                        {celdaTexto(c, "descripcion")}
                        {celdaGrafico(c)}
                        {celdaHoras(c, "horasReales")}
                        {celdaHoras(c, "horasCobradas")}
                        {celdaImporte(c, "importeReal")}
                        {celdaImporte(c, "importeCobrado")}
                        {celdaImporte(c, "importeTotal")}
                        <td className="centro">
                          <input
                            type="checkbox"
                            checked={c.resuelto}
                            onChange={(e) => cambiarConcepto(c, { resuelto: e.target.checked })}
                          />
                        </td>
                        <td className="centradoMic">
                          <button className="boton botonMini" onClick={() => borrarConcepto(c)}>−</button>
                        </td>
                      </tr>
                    ))}
                    {rec.conceptosReclamados.length === 0 ? (
                      <tr><td colSpan={11} className="vacio">Sin conceptos.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
