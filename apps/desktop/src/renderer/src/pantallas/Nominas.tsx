/**
 * Pantalla Nóminas — port de `NominasViewModel` + `NominasView`: lista de
 * nóminas del conductor (Mes/Tipo/Líquido), detalle con período, conceptos y
 * totales abajo. «Cambiar antigüedad» y «Cambiar % IRPF» recalculan en el
 * cliente con `CalculosNomina.Recalcular` (la tabla salarial viene del
 * convenio del año) y guardan por PUT al momento, como el original.
 */
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { pedirTexto } from "../lib/dialogos";
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

function mesCorto(fecha: string): string {
  return fecha === "" ? "" : `${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
}

function diaMes(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
}

/** es-ES "N2" con separador de miles. */
function n2(v: number): string {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** es-ES "N4" (precio del concepto). */
function n4(v: number): string {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function PantallaNominas({ servidor, token, centro, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  onVolver: () => void;
}): ReactNode {
  const [conductores, setConductores] = useState<ConductorCombo[]>([]);
  const [idConductor, setIdConductor] = useState<number | null>(null);
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="pagina">
      <div className="cabeceraPagina">
        <h2 className="tituloPagina">Nóminas</h2>
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
        <button className="boton" onClick={() => void cambiarAntiguedad()} disabled={ocupado || nom === null}>Cambiar antigüedad</button>
        <button className="boton" onClick={() => void cambiarIrpf()} disabled={ocupado || nom === null}>Cambiar % IRPF</button>
        <button className="boton" onClick={() => void borrar()} disabled={ocupado || nom === null}>Borrar</button>
      </div>
      <div className="reclNominasCuerpo">
        <div className="listaNominas">
          <table className="rejilla rejillaLista">
            <thead>
              <tr><th>Mes</th><th>Tipo</th><th>Líquido</th></tr>
            </thead>
            <tbody>
              {nominas.map((n, i) => (
                <tr
                  key={String(n.id)}
                  className={seleccionada === i ? "sel" : undefined}
                  onClick={() => setSeleccionada(i)}
                >
                  <td>{mesCorto(n.fecha)}</td>
                  <td>{nombreEnum(TipoNomina, n.tipoNomina)}</td>
                  <td className="num">{n2(Math.round(n.totalLiquido) / 100)}</td>
                </tr>
              ))}
              {nominas.length === 0 ? (
                <tr><td colSpan={3} className="vacio">Sin nóminas.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="detalleNominas">
          {nom === null ? (
            <p className="vacio">Selecciona una nómina.</p>
          ) : (
            <>
              <div className="cabeceraDetalle">
                <span>
                  Período: {diaMes(nom.fechaInicio)} - {diaMes(nom.fechaFinal)}
                </span>
                <span className="hueco" />
                <span>Antigüedad: {diaMes(nom.fechaAntiguedad)}</span>
              </div>
              <div className="marcoRejilla marcoNomina">
                <table className="rejilla rejillaNominas">
                  <thead>
                    <tr>
                      <th>Concepto</th><th>Unidades</th><th>Precio</th>
                      <th>Devengado</th><th>Deducción</th><th>IRPF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nom.conceptos.map((c, j) => (
                      <tr key={c.id === undefined ? `cx-${j}` : String(c.id)}>
                        <td>{c.textoConcepto}</td>
                        <td className="num">{String(Math.round(c.unidades * 100) / 100).replace(".", ",")}</td>
                        <td className="num">{n4(Math.round(c.importeBase) / 100)}</td>
                        <td className="num">{n2(Math.round(c.devengado) / 100)}</td>
                        <td className="num">{c.deduccion === 0 ? "" : n2(Math.round(c.deduccion) / 100)}</td>
                        <td className="centro">{c.computaParaIrpf ? "✓" : ""}</td>
                      </tr>
                    ))}
                    {nom.conceptos.length === 0 ? (
                      <tr><td colSpan={6} className="vacio">Sin conceptos.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="totalesNomina">
                <p>
                  Base IRPF: {n2(Math.round(nom.baseIrpf) / 100)}
                  {"    "}Prorrateo pagas: {n2(Math.round(nom.prorrateoPagas) / 100)}
                  {"    "}Base S.S.: {n2(Math.round(nom.baseSeguridadSocial) / 100)}
                </p>
                <p>
                  IRPF ({String(nom.porcentajeIrpf).replace(".", ",")} %): {n2(Math.round(nom.descuentoIrpf) / 100)}
                  {"    "}S.S. ({String(nom.porcentajeSeguridadSocial).replace(".", ",")} %): {n2(Math.round(nom.descuentoSeguridadSocial) / 100)}
                  {"    "}Desempleo ({String(nom.porcentajeDesempleo).replace(".", ",")} %): {n2(Math.round(nom.descuentoDesempleo) / 100)}
                </p>
                <p className="liquidoNomina">
                  Devengado: {n2(Math.round(nom.totalDevengado) / 100)}
                  {"    "}Deducciones: {n2(Math.round(nom.totalDeducciones) / 100)}
                  {"    "}LÍQUIDO: {n2(Math.round(nom.totalLiquido) / 100)} €
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
