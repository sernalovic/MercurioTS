/**
 * Pantalla Nóminas — aspecto de Orión 2 (`NominasView` + la ventana
 * «Nómina de …»): conductores a la izquierda (banda «CONDUCTORES -
 * centro») y a la derecha la lista de nóminas del conductor elegido
 * (Fecha/Tipo/Antigüedad/% IRPF/Total devengado/A deducir/Líquido a
 * percibir) con filtro «Año Actual» y combo de agrupación. Doble clic
 * abre el DETALLE como modal: caja de trabajador/período/antigüedad,
 * tabla de conceptos (Conceptos/Unidades/Importe base/Devengado/A
 * deducir), descuentos de S.S. e I.R.P.F., remuneración y pagas extra,
 * totales, contingencias y «Cerrar». «Cambiar antigüedad» y «Cambiar
 * % IRPF» recalculan en el cliente con `CalculosNomina.Recalcular`
 * (la tabla salarial viene del convenio del año) y guardan por PUT al
 * momento, como el original.
 */
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { pedirTexto } from "../lib/dialogos";
import { SeparadorV } from "../componentes/Separador";
import { TipoNomina, nombreEnum, recalcularNomina,
  type Convenio, type Nomina, type TablaSalarial,
} from "@mercurio/domain";

interface ConductorCombo {
  id: number;
  centro: number;
  matricula: number;
  nombre: string;
  apellidos: string;
  categoria: number;
}

const CENTROS = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];

function centroIndex(nombre: string): number {
  return CENTROS.indexOf(nombre) < 0 ? 0 : CENTROS.indexOf(nombre);
}

/** "AAAA-MM-DD" → "MM - AAAA" (formato de la lista del original). */
function mesCorto(fecha: string): string {
  return fecha === "" ? "" : `${fecha.slice(5, 7)} - ${fecha.slice(0, 4)}`;
}

/** "AAAA-MM-DD" → "DD - MM - AAAA". */
function diaLargo(fecha: string): string {
  return fecha === "" ? "" : `${fecha.slice(8, 10)} - ${fecha.slice(5, 7)} - ${fecha.slice(0, 4)}`;
}

function diaMes(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "Del 01 al 28 de febrero de 2023" y días naturales del período. */
function periodo(n: Nomina): string {
  const fi = n.fechaInicio;
  const ff = n.fechaFinal;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fi) || !/^\d{4}-\d{2}-\d{2}$/.test(ff)) return "";
  const mes = MESES[Number(fi.slice(5, 7)) - 1] ?? "";
  return `Del ${fi.slice(8, 10)} al ${ff.slice(8, 10)} de ${mes} de ${ff.slice(0, 4)}`;
}

function diasPeriodo(n: Nomina): number {
  const d = Date.parse(n.fechaFinal) - Date.parse(n.fechaInicio);
  return Number.isFinite(d) ? Math.round(d / 86400000) + 1 : 0;
}

/** es-ES "N2" con separador de miles. */
function n2(v: number): string {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.234,56 €" desde céntimos. */
function euros(cent: number): string {
  return `${n2(Math.round(cent) / 100)} €`;
}

/** es-ES "N4" (precio del concepto). */
function n4(v: number): string {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// ---- VENTANA «NÓMINA DE …» (modal) ----

function VentanaNomina({ nom, conductor, ocupado, onAntiguedad, onIrpf, onCerrar }: {
  nom: Nomina;
  conductor: ConductorCombo;
  ocupado: boolean;
  onAntiguedad: () => void;
  onIrpf: () => void;
  onCerrar: () => void;
}): ReactNode {
  const contingenciasBase = nom.baseSeguridadSocial;
  const totalContingencias = nom.descuentoSeguridadSocial + nom.descuentoDesempleo;

  return (
    <div className="veloDetalle" onClick={onCerrar}>
      <div className="ventanaDetalle ventanaNomina" onClick={(e) => e.stopPropagation()}>
        <div className="cabeceraVentana">
          <span>Nómina de {conductor.nombre} {conductor.apellidos}  ({conductor.matricula})</span>
          <button className="cerrarVentana" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="barraPanel">
          <button className="boton" onClick={onAntiguedad} disabled={ocupado}>Cambiar Antigüedad</button>
          <button className="boton" onClick={onIrpf} disabled={ocupado}>Cambiar porcentaje I.R.P.F</button>
        </div>
        <div className="nominaCuerpo">
          <table className="cajaNomina">
            <tbody>
              <tr>
                <td className="titular">Trabajador: {conductor.matricula} - {conductor.nombre} {conductor.apellidos}</td>
                <td className="titular derecha" rowSpan={2}>Antigüedad : {diaMes(nom.fechaAntiguedad)}</td>
              </tr>
              <tr>
                <td className="titular">Período: {periodo(nom)}</td>
                <td className="titular centro">Total {diasPeriodo(nom)} días</td>
              </tr>
            </tbody>
          </table>
          <div className="marcoRejilla marcoNomina">
            <table className="rejilla rejillaConceptosNomina">
              <thead>
                <tr><th>Conceptos</th><th>Unidades</th><th>Importe base</th><th>Devengado</th><th>A deducir</th></tr>
              </thead>
              <tbody>
                {nom.conceptos.map((c, j) => (
                  <tr key={c.id === undefined ? `cx-${j}` : String(c.id)}>
                    <td>{c.textoConcepto}</td>
                    <td className="num">{String(Math.round(c.unidades * 100) / 100).replace(".", ",")}</td>
                    <td className="num">{euros(c.importeBase)}</td>
                    <td className="num">{euros(c.devengado)}</td>
                    <td className="num">{c.deduccion === 0 ? "" : euros(c.deduccion)}</td>
                  </tr>
                ))}
                {nom.conceptos.length === 0 ? (
                  <tr><td colSpan={5} className="vacio">Sin conceptos.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <table className="cajaNomina">
            <tbody>
              <tr>
                <td className="etiquetaCaja">DESCUENTO SEGURIDAD SOCIAL</td>
                <td className="num" />
                <td className="num" />
                <td className="num">{euros(nom.descuentoSeguridadSocial)}</td>
              </tr>
              <tr>
                <td className="etiquetaCaja">DESCUENTO I.R.P.F.</td>
                <td className="num derecha">{n2(nom.porcentajeIrpf)} %</td>
                <td className="num derecha">{euros(nom.baseIrpf)}</td>
                <td className="num">{euros(nom.descuentoIrpf)}</td>
              </tr>
            </tbody>
          </table>
          <div className="nominaPie">
            <div className="nominaIzquierda">
              <table className="cajaNomina">
                <tbody>
                  <tr><td className="titular">Importe remuneración</td><td className="num derecha">{euros(nom.baseIrpf)}</td></tr>
                  <tr><td className="titular">Importe pagas extra</td><td className="num derecha">{euros(nom.prorrateoPagas)}</td></tr>
                  <tr><td className="titular">TOTAL</td><td className="num derecha">{euros(nom.baseIrpf + nom.prorrateoPagas)}</td></tr>
                </tbody>
              </table>
              <table className="cajaNomina contingencias">
                <tbody>
                  <tr>
                    <td className="titular">Contingencias comunes</td>
                    <td className="num">{euros(contingenciasBase)}</td>
                    <td className="num derecha">{n2(nom.porcentajeSeguridadSocial)} %</td>
                    <td className="num">{euros(nom.descuentoSeguridadSocial)}</td>
                  </tr>
                  <tr>
                    <td className="titular">Desempleo, Fogasa y F.P.</td>
                    <td className="num">{euros(contingenciasBase)}</td>
                    <td className="num derecha">{n2(nom.porcentajeDesempleo)} %</td>
                    <td className="num">{euros(nom.descuentoDesempleo)}</td>
                  </tr>
                  <tr>
                    <td className="titular">TOTAL</td>
                    <td className="num" />
                    <td className="num" />
                    <td className="num">{euros(totalContingencias)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="nominaDerecha">
              <table className="cajaNomina totalesCaja">
                <tbody>
                  <tr>
                    <td className="totalCaja">TOTAL DEVENGADO<br />{euros(nom.totalDevengado)}</td>
                    <td className="totalCaja">TOTAL DEDUCCIONES<br />{euros(nom.totalDeducciones)}</td>
                  </tr>
                </tbody>
              </table>
              <table className="cajaNomina liquidoCaja">
                <tbody>
                  <tr>
                    <td className="titular">LÍQUIDO A PERCIBIR</td>
                    <td className="num grande">{euros(nom.totalLiquido)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="pieVentana">
                <button className="boton" onClick={onCerrar} disabled={ocupado}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- PANTALLA NÓMINAS ----

export function PantallaNominas({ servidor, token, centro, mes, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  mes: string;
  onVolver: () => void;
}): ReactNode {
  const [conductores, setConductores] = useState<ConductorCombo[]>([]);
  const [idConductor, setIdConductor] = useState<number | null>(null);
  const [anchoCond, setAnchoCond] = useState(300);
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState(false);
  const [soloAño, setSoloAño] = useState(false);
  const [agrupar, setAgrupar] = useState("0");

  /** El convenio completo (tablas salariales) se carga una vez, como `ConvenioAsync`. */
  function cargarConvenios(): void {
    api<{ convenios: Convenio[] }>(servidor, token, "convenios")
      .then((r) => setConvenios(r.convenios))
      .catch(() => setConvenios([]));
  }

  function cargarConductores(): void {
    setOcupado(true);
    setError(null);
    api<{ conductores: ConductorCombo[] }>(servidor, token, `conductores?centro=${centroIndex(centro)}`)
      .then((r) => {
        setConductores(r.conductores);
        setIdConductor(r.conductores[0]?.id ?? null);
        if (r.conductores.length > 0) cargarNominas(r.conductores[0].id);
        else setNominas([]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  function cargarNominas(id: number): void {
    if (id <= 0) { setNominas([]); setSeleccionada(null); return; }
    setOcupado(true);
    setError(null);
    api<{ nominas: Nomina[] }>(servidor, token, `nominas?idConductor=${id}`)
      .then((r) => {
        setNominas(r.nominas);
        setSeleccionada(r.nominas.length > 0 ? 0 : null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  function cambiarConductor(id: number): void {
    setIdConductor(id);
    setSeleccionada(null);
    setDetalle(false);
    cargarNominas(id);
  }

  useEffect(cargarConductores, [servidor, token, centro]);
  useEffect(cargarConvenios, [servidor, token]);

  const conductor = conductores.find((c) => c.id === idConductor) ?? null;
  const nom = seleccionada !== null && seleccionada >= 0 && seleccionada < nominas.length
    ? nominas[seleccionada] as Nomina
    : null;

  /** Tabla salarial de la categoría del conductor en el año de la nómina. */
  function tablaDe(n: Nomina, año: number): TablaSalarial | null {
    const convenio = convenios.find((c) => c.año === año) ?? null;
    if (convenio === null || conductor === null) return null;
    const tabla = convenio.tablasSalariales.find((t) => t.categoria === conductor.categoria);
    return tabla ?? null;
  }

  /** `Recalcular`: cambia un dato, recalcula con la tabla salarial y guarda ya. */
  async function recalcular(guardarCambios: (n: Nomina) => void): Promise<void> {
    if (nom === null || conductor === null) return;
    setOcupado(true);
    setError(null);
    try {
      const año = Number(nom.fecha.slice(0, 4));
      const tabla = tablaDe(nom, año);
      if (tabla === null) {
        window.alert(`Aún no se ha creado el convenio del año ${año} o le falta la tabla salarial.`);
        return;
      }
      const copia: Nomina = {
        ...nom,
        conceptos: nom.conceptos.map((c) => ({ ...c })),
      };
      guardarCambios(copia);
      recalcularNomina(copia, tabla);
      const r = await api<{ nomina: Nomina | null }>(
        servidor, token, `nominas/${copia.id}`, { metodo: "PUT", cuerpo: copia },
      );
      if (r.nomina !== null && seleccionada !== null) {
        setNominas(nominas.map((x, i) => (i === seleccionada ? r.nomina as Nomina : x)));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarAntiguedad(): Promise<void> {
    if (nom === null) return;
    const texto = await pedirTexto(
      "Nueva fecha de antigüedad",
      "Fecha (dd/mm/aaaa):",
      diaMes(nom.fechaAntiguedad),
    );
    if (texto === null) return;
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
    if (m === null) return;
    await recalcular((n) => { n.fechaAntiguedad = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; });
  }

  async function cambiarIrpf(): Promise<void> {
    if (nom === null) return;
    const texto = await pedirTexto(
      "Porcentaje I.R.P.F.",
      "Introduce el nuevo porcentaje de I.R.P.F.",
      String(nom.porcentajeIrpf).replace(".", ","),
    );
    if (texto === null) return;
    const v = Number(texto.trim().replace(",", "."));
    if (!Number.isFinite(v) || v < 0) return;
    await recalcular((n) => { n.porcentajeIrpf = v; });
  }

  async function borrar(): Promise<void> {
    if (nom === null) return;
    if (!window.confirm("¿Borrar la nómina seleccionada?")) return;
    setOcupado(true);
    setError(null);
    try {
      if ((nom.id ?? 0) > 0) {
        await api(servidor, token, `nominas/${nom.id}`, { metodo: "DELETE" });
      }
      setNominas(nominas.filter((_, i) => i !== seleccionada));
      setSeleccionada(nominas.length > 1 ? 0 : null);
      setDetalle(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  // ---- lista con filtro «Año Actual» y agrupación ----

  const añoActual = mes.slice(0, 4);
  const visibles = soloAño
    ? nominas.filter((n) => n.fecha.slice(0, 4) === añoActual)
    : nominas;

  function cuerpoLista(): ReactNode {
    const salidas: ReactNode[] = [];
    let claveGrupo = "";
    for (const [i, n] of nominas.entries()) {
      if (!visibles.includes(n)) continue;
      if (agrupar !== "0") {
        const clave = String(n.tipoNomina);
        if (clave !== claveGrupo) {
          claveGrupo = clave;
          salidas.push(
            <tr key={`grupo-${clave}`} className="filaGrupo">
              <td colSpan={7}>{nombreEnum(TipoNomina, Number(clave))}</td>
            </tr>,
          );
        }
      }
      salidas.push(
        <tr
          key={String(n.id)}
          className={seleccionada === i ? "sel" : undefined}
          onClick={() => setSeleccionada(i)}
          onDoubleClick={() => setDetalle(true)}
        >
          <td className="num">{mesCorto(n.fecha)}</td>
          <td className="centro">{nombreEnum(TipoNomina, n.tipoNomina)}</td>
          <td className="num">{diaLargo(n.fechaAntiguedad)}</td>
          <td className="num">{n2(n.porcentajeIrpf)}</td>
          <td className="num">{euros(n.totalDevengado)}</td>
          <td className="num">{euros(n.totalDeducciones)}</td>
          <td className="num">{euros(n.totalLiquido)}</td>
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
        <button className="boton" disabled title="Las nóminas se guardan al recalcular antigüedad o IRPF">💾 Guardar y Actualizar</button>
        <button className="boton" onClick={cargarConductores} disabled={ocupado}>↺ Descartar Cambios</button>
      </div>
      <div className="reclNominasCuerpo reclNominasCuerpoO2">
        <div className="panelPrincipalGraficos panelConductoresRecl" style={{ flex: `0 0 ${anchoCond}px` }}>
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
        <SeparadorV ancho={anchoCond} onAncho={setAnchoCond} min={200} max={700} />
        <div className="panelPrincipalGraficos">
          <div className="bandaTitulo">NÓMINAS - {conductor?.matricula ?? "-"}</div>
          <div className="barraPanel">
            <button className="boton" onClick={() => void borrar()} disabled={ocupado || nom === null}>－ Borrar</button>
            <button className="boton" disabled title="El borrado de nóminas es inmediato">↺ Deshacer borrar</button>
            <span className="hueco" />
            <button className={`botonLote${soloAño ? " pulsado" : ""}`} onClick={() => setSoloAño(!soloAño)}>Año Actual</button>
            <select className="celda" value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
              <option value="0">Sin agrupar</option>
              <option value="1">Tipo</option>
            </select>
          </div>
          <div className="marcoRejilla">
            <table className="rejilla rejillaListaRecl">
              <thead>
                <tr>
                  <th>Fecha</th><th>Tipo</th><th>Antigüedad</th><th>% IRPF</th>
                  <th>Total devengado</th><th>A deducir</th><th>Líquido a percibir</th>
                </tr>
              </thead>
              <tbody>
                {cuerpoLista()}
                {nominas.length === 0 ? (
                  <tr><td colSpan={7} className="vacio">Sin nóminas.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {detalle && nom !== null && conductor !== null ? (
        <VentanaNomina
          nom={nom}
          conductor={conductor}
          ocupado={ocupado}
          onAntiguedad={() => void cambiarAntiguedad()}
          onIrpf={() => void cambiarIrpf()}
          onCerrar={() => setDetalle(false)}
        />
      ) : null}
    </div>
  );
}
