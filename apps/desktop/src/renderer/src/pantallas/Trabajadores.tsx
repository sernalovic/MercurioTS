/**
 * Pantalla Trabajadores — aspecto de Orión 2 (`TrabajadoresView` + la ventana
 * «Detalle de trabajador»): rejilla compacta a la izquierda (Cat./Sit./
 * Matrícula/Afiliado/Nombre/Apellidos/Acumuladas/DCs/DNDs/Antig./%IRPF) con
 * Añadir/Borrar/Deshacer Borrar/Mostrar calendarios y el combo «Sin agrupar»;
 * panel de REGULACIONES a la derecha con su propio Añadir/Borrar/Deshacer y
 * el filtro «Año Actual». El doble clic sobre cualquier campo abre el
 * DETALLE DEL TRABAJADOR: formulario completo + resumen de sus
 * RECLAMACIONES. La lógica de guardado es la del port (bajas → altas →
 * cambios → recarga, regulaciones anidadas).
 */
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { api } from "../lib/api";
import { pedirTexto } from "../lib/dialogos";
import {
  TipoReclamacion, TiposDieta, esResuelta,
  type Reclamacion,
} from "@mercurio/domain";
import type { ConductorContexto } from "./CalendariosConductor";

// ---- formas de datos ----

interface RegApi {
  id: number;
  tipo: number;
  fecha: string;
  horas: string;
  dcs: string;
  dnds: string;
  motivo: string | null;
}

interface FilaApi {
  id: number;
  centro: number;
  categoria: number;
  situacion: number;
  matricula: number;
  isUsuario: boolean;
  fechaAntiguedad: string;
  porcentajeIrpf: string;
  numeroAfiliado: number;
  isReduccionJornada: boolean;
  porcentajeJornada: number;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
  acumuladasIniciales: string;
  dcsIniciales: string;
  dndsIniciales: string;
  plusDistancia: string;
  notas: string | null;
  regulaciones?: RegApi[];
}

/** La fila tal como la edita la UI (fechas ISO, horas hh:mm). */
interface Fila {
  id: number;
  centro: string;
  categoria: string;
  situacion: string;
  matricula: string;
  isUsuario: boolean;
  fechaAntiguedad: string;
  porcentajeIrpf: string;
  numeroAfiliado: string;
  isReduccionJornada: boolean;
  porcentajeJornada: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
  acumuladasIniciales: string;
  dcsIniciales: string;
  dndsIniciales: string;
  plusDistancia: string;
  notas: string;
}

/** La regulación tal como la edita la UI (fecha ISO, horas hh:mm). */
interface RegFila {
  id: number;
  conductorId: number;
  tipo: string;
  fecha: string;
  horas: string;
  dcs: string;
  dnds: string;
  motivo: string;
}

// ---- conversiones ----

/** Contador de Ids temporales de filas nuevas (negativos, nunca en la BD). */
let contadorNuevas = 0;

/** Mismos valores y orden que `CentroTrabajo` del dominio. */
const CENTROS = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];
const ETIQUETAS_CENTRO: Record<number, string> = {
  0: "Todos", 1: "Donosti", 2: "Bilbao", 3: "Arrasate", 4: "Vitoria", 5: "Pruebas",
};
const ETIQUETAS_CATEGORIA: Record<number, string> = {
  0: "Conductor", 1: "Conductor de formación", 2: "Taquilla",
};
/** Abreviaturas de la columna Cat. (C = Conductor, F = formación, T = taquilla). */
const ABRE_CATEGORIA: Record<number, string> = { 0: "C", 1: "F", 2: "T" };
const ETIQUETAS_SITUACION: Record<number, string> = {
  0: "Fijo", 1: "Eventual", 2: "Inactivo", 3: "Fijo (inaplicación)",
};
/** Abreviaturas de la columna Sit. (F/E/I y X para la inaplicación). */
const ABRE_SITUACION: Record<number, string> = { 0: "F", 1: "E", 2: "I", 3: "X" };

function aFila(c: FilaApi): Fila {
  return {
    id: c.id,
    centro: String(c.centro),
    categoria: String(c.categoria),
    situacion: String(c.situacion),
    matricula: String(c.matricula),
    isUsuario: c.isUsuario,
    fechaAntiguedad: c.fechaAntiguedad.slice(0, 10),
    porcentajeIrpf: c.porcentajeIrpf,
    numeroAfiliado: String(c.numeroAfiliado),
    isReduccionJornada: c.isReduccionJornada,
    porcentajeJornada: String(c.porcentajeJornada),
    nombre: c.nombre,
    apellidos: c.apellidos,
    telefono: c.telefono ?? "",
    email: c.email ?? "",
    acumuladasIniciales: c.acumuladasIniciales.slice(0, 5),
    dcsIniciales: c.dcsIniciales,
    dndsIniciales: c.dndsIniciales,
    plusDistancia: c.plusDistancia,
    notas: c.notas ?? "",
  };
}

function aRegFila(g: RegApi, conductorId: number): RegFila {
  return {
    id: g.id,
    conductorId,
    tipo: String(g.tipo),
    fecha: g.fecha.slice(0, 10),
    horas: g.horas.slice(0, 5),
    dcs: g.dcs,
    dnds: g.dnds,
    motivo: g.motivo ?? "",
  };
}

/** Cuerpo que envía la UI al API (números validados allí). */
interface CuerpoConductor {
  id: number;
  centro: number;
  categoria: number;
  situacion: number;
  matricula: number;
  isUsuario: boolean;
  fechaAntiguedad: string;
  porcentajeIrpf: string;
  numeroAfiliado: string;
  isReduccionJornada: boolean;
  porcentajeJornada: string;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
  acumuladasIniciales: string;
  dcsIniciales: string;
  dndsIniciales: string;
  plusDistancia: string;
  notas: string | null;
}

function aConductor(f: Fila): CuerpoConductor {
  return {
    id: f.id > 0 ? f.id : 0,
    centro: Number(f.centro),
    categoria: Number(f.categoria),
    situacion: Number(f.situacion),
    matricula: f.matricula.trim() === "" ? 0 : Number(f.matricula),
    isUsuario: f.isUsuario,
    fechaAntiguedad: f.fechaAntiguedad,
    porcentajeIrpf: f.porcentajeIrpf,
    numeroAfiliado: f.numeroAfiliado,
    isReduccionJornada: f.isReduccionJornada,
    porcentajeJornada: f.porcentajeJornada,
    nombre: f.nombre,
    apellidos: f.apellidos,
    telefono: f.telefono.trim() || null,
    email: f.email.trim() || null,
    acumuladasIniciales: f.acumuladasIniciales,
    dcsIniciales: f.dcsIniciales,
    dndsIniciales: f.dndsIniciales,
    plusDistancia: f.plusDistancia,
    notas: f.notas.trim() || null,
  };
}

function aCuerpoReg(g: RegFila): unknown {
  return {
    id: g.id > 0 ? g.id : 0,
    tipo: Number(g.tipo),
    fecha: g.fecha,
    horas: g.horas,
    dcs: g.dcs,
    dnds: g.dnds,
    motivo: g.motivo.trim() || null,
  };
}

/** ¿Difiere la fila (o la regulación) de su original (se enviará como cambio)? */
function esCambio(f: Fila, original: Fila | undefined): boolean {
  return original !== undefined && JSON.stringify(aConductor(f)) !== JSON.stringify(aConductor(original));
}
function esCambioReg(g: RegFila, original: RegFila | undefined): boolean {
  if (original === undefined) return true;
  return JSON.stringify(aCuerpoReg(g)) !== JSON.stringify(aCuerpoReg(original));
}

/** Valida en cliente antes de llamar al API. */
function validar(f: Fila): string | null {
  if (f.matricula.trim() === "" || !Number.isFinite(Number(f.matricula))) return "Indica la matrícula de cada conductor.";
  if (f.nombre.trim() === "" || f.apellidos.trim() === "") return "Indica el nombre y los apellidos de cada conductor.";
  if (f.fechaAntiguedad === "") return "Indica la fecha de antigüedad de cada conductor.";
  return null;
}

// ---- formato Orión 2 ----

/** "0,0000" (es-ES con 4 decimales), como las columnas DCs/DNDs del original. */
function n4(v: string | number): string {
  const numero = Number(String(v).replace(",", "."));
  return Number.isFinite(numero)
    ? numero.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    : String(v);
}

/** "0,00" (es-ES con 2 decimales), como %IRPF/Plus dist. y los importes. */
function n2(v: string | number): string {
  const numero = Number(String(v).replace(",", "."));
  return Number.isFinite(numero)
    ? numero.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(v);
}

/** "AAAA-MM-DD" → "dd-MM-yyyy" (columna Fecha de reclamaciones/regulaciones). */
function ddMMyyyy(fecha: string): string {
  return fecha === "" ? "" : `${fecha.slice(8, 10)}-${fecha.slice(5, 7)}-${fecha.slice(0, 4)}`;
}

// ---- resumen de reclamaciones (panel del Detalle) ----

const TIPOS_DIETA = new Set<number>(TiposDieta as readonly number[]);
const TIPOS_HORAS: readonly number[] = [
  TipoReclamacion.HorasTrabajadas, TipoReclamacion.HorasAcumuladas, TipoReclamacion.OtraHoras,
];
const TIPOS_PLUS: readonly number[] = [
  TipoReclamacion.PlusSabados, TipoReclamacion.PlusFestivos, TipoReclamacion.PlusPaqueteria,
  TipoReclamacion.PlusLimpieza, TipoReclamacion.PlusMenorDescanso, TipoReclamacion.PlusNocturnidad,
  TipoReclamacion.PlusNocturnidadParcial, TipoReclamacion.PlusNavidad, TipoReclamacion.PlusViaje,
  TipoReclamacion.QuebrantoMoneda, TipoReclamacion.Refuerzos,
];

/** Totales del resumen: horas en minutos; dietas en unidades; pluses/importe en céntimos. */
function totalesDe(r: Reclamacion): { horas: number; dietas: number; pluses: number; importe: number } {
  let horas = 0, dietas = 0, pluses = 0, importe = 0;
  for (const c of r.conceptosReclamados) {
    if (TIPOS_HORAS.includes(c.tipo)) horas += c.horasReales;
    if (TIPOS_DIETA.has(c.tipo)) dietas += c.importeReal;
    if (TIPOS_PLUS.includes(c.tipo)) pluses += Math.round(c.importeTotal);
    importe += Math.round(c.importeTotal);
  }
  return { horas, dietas, pluses, importe };
}

/** Minutos → "H:MM" (como el total de horas del original). */
function horasTexto(min: number): string {
  if (min === 0) return "00:00";
  return `${Math.trunc(min / 60)}:${String(Math.abs(min % 60)).padStart(2, "0")}`;
}

// ---- celda de texto con commit en change+blur (patrón M5) ----

function celdaTexto(valor: string, alCommit: (v: string) => void, clase = "celda"): ReactNode {
  const alCambiar = (e: ChangeEvent<HTMLInputElement>): void => alCommit(e.target.value);
  return <input key={`t-${valor}`} className={clase} defaultValue={valor} onChange={alCambiar} onBlur={alCambiar} />;
}

// ---- DETALLE DEL TRABAJADOR (ventana modal) ----

function DetalleTrabajador({ fila, servidor, token, onCambiar, onCerrar }: {
  fila: Fila;
  servidor: string;
  token: string;
  onCambiar: (campo: keyof Fila, valor: string | boolean) => void;
  onCerrar: () => void;
}): ReactNode {
  const [reclamaciones, setReclamaciones] = useState<Reclamacion[]>([]);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [añoActual, setAñoActual] = useState(false);
  const [agrupar, setAgrupar] = useState("0");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cargarReclamaciones(): void {
    if (fila.id <= 0) { setReclamaciones([]); return; } // trabajador aún no guardado
    setOcupado(true);
    setError(null);
    api<{ reclamaciones: Reclamacion[] }>(servidor, token, `reclamaciones?idConductor=${fila.id}`)
      .then((r) => {
        setReclamaciones(r.reclamaciones);
        setSeleccionada(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(cargarReclamaciones, [fila.id, servidor, token]);

  const visibles = añoActual
    ? reclamaciones.filter((r) => r.fecha.startsWith(String(new Date().getFullYear())))
    : reclamaciones;

  /** Añade una reclamación para el mes pedido y la guarda en el servidor. */
  async function añadirReclamacion(): Promise<void> {
    const hoy = new Date();
    const defecto = `${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
    const texto = await pedirTexto("Nueva reclamación", "Mes (mm/aaaa):", defecto);
    if (texto === null) return;
    const m = /^(\d{2})\/(\d{4})$/.exec(texto.trim());
    if (m === null) return;
    const fecha = `${m[2]}-${m[1]}-01`;
    if (reclamaciones.some((r) => r.fecha === fecha)) {
      window.alert("Ya hay una reclamación con esa fecha. Elige otra.");
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      await api(servidor, token, "reclamaciones", {
        metodo: "POST",
        cuerpo: {
          conductorId: fila.id,
          fecha,
          fechaEfecto: hoy.toISOString().slice(0, 10),
          codigo: `${m[2]}${m[1]}${fila.matricula}`,
          notas: null,
          notaInterna: null,
          cerrada: false,
          conceptosReclamados: [],
        },
      });
      cargarReclamaciones();
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  async function borrarReclamacion(): Promise<void> {
    const rec = seleccionada !== null ? reclamaciones.find((r) => r.id === seleccionada) : undefined;
    if (rec === undefined) return;
    if (!window.confirm("¿Borrar la reclamación seleccionada?")) return;
    setOcupado(true);
    setError(null);
    try {
      await api(servidor, token, `reclamaciones/${rec.id}`, { metodo: "DELETE" });
      cargarReclamaciones();
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  /** Campo etiquetado del formulario (aspecto Orión 2: etiqueta encima). */
  function campo(etiqueta: string, contenido: ReactNode): ReactNode {
    return (
      <label className="campoTrabajador">
        <span className="etiquetaCampo">{etiqueta}</span>
        {contenido}
      </label>
    );
  }

  return (
    <div className="veloDetalle" onClick={onCerrar}>
      <div className="ventanaDetalle" onClick={(e) => e.stopPropagation()}>
        <div className="cabeceraVentana">
          <span>Detalle de trabajador</span>
          <button className="cerrarVentana" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="detalleCuerpo">
          <div className="formTrabajador">
            <div className="formTrio">
              {campo("Matrícula", celdaTexto(fila.matricula, (v) => onCambiar("matricula", v), "campoEntrada"))}
              {campo("Acumuladas", celdaTexto(fila.acumuladasIniciales, (v) => onCambiar("acumuladasIniciales", v), "campoEntrada"))}
              {campo("DCs", celdaTexto(fila.dcsIniciales, (v) => onCambiar("dcsIniciales", v), "campoEntrada"))}
            </div>
            <div className="formTrio">
              {campo("DNDs", celdaTexto(fila.dndsIniciales, (v) => onCambiar("dndsIniciales", v), "campoEntrada"))}
              {campo("Plus Dist.", celdaTexto(fila.plusDistancia, (v) => onCambiar("plusDistancia", v), "campoEntrada"))}
              {campo("Centro de trabajo", (
                <select className="campoEntrada" value={fila.centro} onChange={(e) => onCambiar("centro", e.target.value)}>
                  {[1, 2, 3, 4, 5].map((v) => <option key={v} value={String(v)}>{ETIQUETAS_CENTRO[v]}</option>)}
                </select>
              ))}
            </div>
            <div className="formDuo">
              {campo("Categoría", (
                <select className="campoEntrada" value={fila.categoria} onChange={(e) => onCambiar("categoria", e.target.value)}>
                  {[0, 1, 2].map((v) => <option key={v} value={String(v)}>{ETIQUETAS_CATEGORIA[v]}</option>)}
                </select>
              ))}
              {campo("Situación", (
                <select className="campoEntrada" value={fila.situacion} onChange={(e) => onCambiar("situacion", e.target.value)}>
                  {[0, 1, 2, 3].map((v) => <option key={v} value={String(v)}>{ETIQUETAS_SITUACION[v]}</option>)}
                </select>
              ))}
            </div>
            <div className="formDuo">
              {campo("Nombre", celdaTexto(fila.nombre, (v) => onCambiar("nombre", v), "campoEntrada"))}
              {campo("Nº Afiliado", celdaTexto(fila.numeroAfiliado, (v) => onCambiar("numeroAfiliado", v), "campoEntrada"))}
            </div>
            {campo("Apellidos", celdaTexto(fila.apellidos, (v) => onCambiar("apellidos", v), "campoEntrada"))}
            <div className="formDuo">
              {campo("Teléfono", celdaTexto(fila.telefono, (v) => onCambiar("telefono", v), "campoEntrada"))}
              <button
                className={`botonFicha${fila.isReduccionJornada ? " pulsado" : ""}`}
                onClick={() => onCambiar("isReduccionJornada", !fila.isReduccionJornada)}
              >
                Reducc. Jornada
              </button>
            </div>
            <div className="formDuo">
              {campo("Email", celdaTexto(fila.email, (v) => onCambiar("email", v), "campoEntrada"))}
              {campo("% de jornada", celdaTexto(fila.porcentajeJornada, (v) => onCambiar("porcentajeJornada", v), "campoEntrada"))}
            </div>
            <label className="campoTrabajador alto">
              <span className="etiquetaCampo">Notas</span>
              <textarea
                className="campoEntrada"
                value={fila.notas}
                onChange={(e) => onCambiar("notas", e.target.value)}
              />
            </label>
          </div>
          <div className="panelReclamaciones">
            <div className="bandaTitulo">RECLAMACIONES</div>
            <div className="barraPanel">
              <button className="boton" onClick={añadirReclamacion} disabled={ocupado}>＋ Añadir</button>
              <button className="boton" onClick={borrarReclamacion} disabled={ocupado || seleccionada === null}>－ Borrar</button>
              <button className="boton" disabled>↺ Deshacer borrar</button>
              <span className="hueco" />
              <button className={`boton${añoActual ? " pulsado" : ""}`} onClick={() => setAñoActual(!añoActual)}>Año Actual</button>
              <select className="celda" value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
                <option value="0">Sin agrupar</option>
                <option value="año">Por año</option>
              </select>
            </div>
            {error ? <p className="error" role="alert">{error}</p> : null}
            <div className="marcoRejilla alta">
              <table className="rejilla">
                <thead>
                  <tr>
                    <th>S</th><th>Fecha</th><th>Nº Reclamación</th>
                    <th>Horas</th><th>Dietas</th><th>Pluses</th><th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filas: ReactNode[] = [];
                    let año = "";
                    for (const r of visibles) {
                      if (agrupar === "año") {
                        const añoDe = r.fecha.slice(0, 4);
                        if (añoDe !== año) {
                          año = añoDe;
                          filas.push(<tr key={`año-${año}`} className="filaGrupo"><td colSpan={7}>{año}</td></tr>);
                        }
                      }
                      const t = totalesDe(r);
                      filas.push(
                        <tr
                          key={r.id}
                          className={seleccionada === r.id ? "sel" : undefined}
                          onClick={() => setSeleccionada(r.id ?? null)}
                        >
                          <td className="centradoMic">{esResuelta(r) ? "S" : ""}</td>
                          <td>{ddMMyyyy(r.fecha)}</td>
                          <td>{r.codigo ?? ""}</td>
                          <td>{horasTexto(t.horas)}</td>
                          <td>{t.dietas.toFixed(4).replace(".", ",")}</td>
                          <td>{n2(t.pluses / 100)}</td>
                          <td>{n2(t.importe / 100)}</td>
                        </tr>,
                      );
                    }
                    return filas;
                  })()}
                  {visibles.length === 0 && !ocupado ? (
                    <tr><td colSpan={7} className="vacio">Sin reclamaciones.</td></tr>
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

// ---- PANTALLA TRABAJADORES ----

export function PantallaTrabajadores({ servidor, token, centro, onVolver, onVerCalendarios }: {
  servidor: string;
  token: string;
  centro: string;
  onVolver: () => void;
  onVerCalendarios: (conductor: ConductorContexto) => void;
}): ReactNode {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [originales, setOriginales] = useState<Map<number, Fila>>(new Map());
  const [borradas, setBorradas] = useState<Fila[]>([]);
  const [regs, setRegs] = useState<RegFila[]>([]);
  const [regsOriginales, setRegsOriginales] = useState<Map<number, RegFila>>(new Map());
  const [borradasReg, setBorradasReg] = useState<RegFila[]>([]);
  const [regSeleccion, setRegSeleccion] = useState<number | null>(null);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<number | null>(null);
  const [agrupar, setAgrupar] = useState("0");
  const [añoActualReg, setAñoActualReg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function cargar(mantener?: number): void {
    setOcupado(true);
    setError(null);
    const filtro = new URLSearchParams();
    if (centro !== "Todos") filtro.set("centro", String(CENTROS.indexOf(centro)));
    api<{ conductores: FilaApi[] }>(servidor, token, `conductores${filtro.size > 0 ? `?${filtro}` : ""}`)
      .then((r) => {
        const lista = r.conductores.map(aFila);
        setFilas(lista);
        setOriginales(new Map(lista.map((f) => [f.id, f])));
        setBorradas([]);
        setSeleccion(mantener !== undefined && lista.some((f) => f.id === mantener) ? mantener : null);
        const listaRegs = r.conductores.flatMap((c) => (c.regulaciones ?? []).map((g) => aRegFila(g, c.id)));
        setRegs(listaRegs);
        setRegsOriginales(new Map(listaRegs.map((g) => [g.id, g])));
        setBorradasReg([]);
        setRegSeleccion(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(cargar, [servidor, token, centro]);

  function cambiar(id: number, campo: keyof Fila, valor: string | boolean): void {
    setFilas((anterior) => anterior.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  }

  function añadir(): void {
    setError(null);
    contadorNuevas -= 1;
    const nuevo: Fila = {
      id: contadorNuevas,
      centro: centro !== "Todos" ? String(CENTROS.indexOf(centro)) : "2",
      categoria: "0",
      situacion: "0",
      matricula: "",
      isUsuario: false,
      fechaAntiguedad: new Date().toISOString().slice(0, 10),
      porcentajeIrpf: "0",
      numeroAfiliado: "0",
      isReduccionJornada: false,
      porcentajeJornada: "100",
      nombre: "",
      apellidos: "",
      telefono: "",
      email: "",
      acumuladasIniciales: "00:00",
      dcsIniciales: "0",
      dndsIniciales: "0",
      plusDistancia: "0",
      notas: "",
    };
    setFilas((anterior) => [...anterior, nuevo]);
    setSeleccion(nuevo.id);
  }

  function borrar(): void {
    const fila = seleccion !== null ? filas.find((f) => f.id === seleccion) : undefined;
    if (fila === undefined) return;
    if (
      !window.confirm(
        "Borrar un conductor hará que se borren todos los datos asociados a este conductor (calendarios, reclamaciones, etc).\n\n¿Estás seguro de borrar al conductor?",
      )
    ) {
      return;
    }
    setError(null);
    setFilas((anterior) => anterior.filter((f) => f.id !== fila.id));
    if (fila.id > 0) setBorradas((anterior) => [...anterior, fila]);
    setSeleccion(null);
  }

  function deshacer(): void {
    if (borradas.length === 0) return;
    setError(null);
    const devolver = borradas[borradas.length - 1] as Fila;
    setFilas((anterior) => [...anterior, devolver].sort((a, b) => Number(a.matricula) - Number(b.matricula)));
    setBorradas(borradas.slice(0, -1));
  }

  function añadirReg(): void {
    if (seleccion === null || seleccion <= 0) return;
    setError(null);
    contadorNuevas -= 1;
    const reg: RegFila = {
      id: contadorNuevas,
      conductorId: seleccion,
      tipo: "0",
      fecha: new Date().toISOString().slice(0, 10),
      horas: "00:00",
      dcs: "0",
      dnds: "0",
      motivo: "",
    };
    setRegs((anterior) => [...anterior, reg]);
    setRegSeleccion(reg.id);
  }

  function borrarReg(): void {
    const reg = regSeleccion !== null ? regs.find((g) => g.id === regSeleccion) : undefined;
    if (reg === undefined) return;
    setError(null);
    setRegs((anterior) => anterior.filter((g) => g.id !== reg.id));
    if (reg.id > 0) setBorradasReg((anterior) => [...anterior, reg]);
    setRegSeleccion(null);
  }

  function deshacerReg(): void {
    if (borradasReg.length === 0) return;
    setError(null);
    const devolver = borradasReg[borradasReg.length - 1] as RegFila;
    setRegs((anterior) => [...anterior, devolver]);
    setBorradasReg(borradasReg.slice(0, -1));
  }

  function cambiarReg(idReg: number, campo: keyof RegFila, valor: string): void {
    setRegs((anterior) => anterior.map((g) => (g.id === idReg ? { ...g, [campo]: valor } : g)));
  }

  function verCalendarios(): void {
    const fila = filas.find((f) => f.id === seleccion && f.id > 0);
    if (fila === undefined) return;
    onVerCalendarios({
      id: fila.id,
      matricula: Number(fila.matricula),
      nombre: fila.nombre,
      apellidos: fila.apellidos,
    });
  }

  async function guardar(): Promise<void> {
    setError(null);
    for (const g of regs) {
      if (g.fecha === "") {
        setError("Indica la fecha de cada regulación.");
        return;
      }
    }
    // Las regulaciones nuevas o cambiadas viajan anidadas a su conductor;
    // si el conductor no tenía cambios, se envía igualmente como cambio.
    const anidadas = new Map<number, unknown[]>();
    for (const g of regs) {
      if (!esCambioReg(g, regsOriginales.get(g.id))) continue;
      const grupo = anidadas.get(g.conductorId) ?? [];
      grupo.push(aCuerpoReg(g));
      anidadas.set(g.conductorId, grupo);
    }
    const listaCambios = filas.filter((f) => f.id > 0 && (esCambio(f, originales.get(f.id)) || anidadas.has(f.id)));
    const listaNuevos = filas.filter((f) => f.id <= 0);
    const fallo = [...listaNuevos, ...listaCambios].map(validar).find((x) => x !== null);
    if (fallo !== undefined && fallo !== null) {
      setError(fallo);
      return;
    }
    setOcupado(true);
    try {
      if (borradasReg.some((g) => g.id > 0)) {
        await api(servidor, token, "regulaciones", { metodo: "DELETE", cuerpo: borradasReg.filter((g) => g.id > 0).map((g) => g.id) });
      }
      if (borradas.some((f) => f.id > 0)) {
        await api(servidor, token, "conductores", { metodo: "DELETE", cuerpo: borradas.filter((f) => f.id > 0).map((f) => f.id) });
      }
      if (listaNuevos.length > 0) {
        await api(servidor, token, "conductores", {
          metodo: "POST",
          cuerpo: listaNuevos.map((f) => ({ ...aConductor(f), id: 0, regulaciones: anidadas.get(f.id) ?? [] })),
        });
      }
      if (listaCambios.length > 0) {
        await api(servidor, token, "conductores", {
          metodo: "PUT",
          cuerpo: listaCambios.map((f) => ({ ...aConductor(f), regulaciones: anidadas.get(f.id) ?? [] })),
        });
      }
      cargar(seleccion !== null && seleccion > 0 ? seleccion : undefined);
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  const hayCambios =
    borradas.length > 0 ||
    borradasReg.length > 0 ||
    filas.some((f) => f.id <= 0 || esCambio(f, originales.get(f.id))) ||
    regs.some((g) => esCambioReg(g, regsOriginales.get(g.id)));

  const filaDetalle = detalle !== null ? filas.find((f) => f.id === detalle) ?? null : null;

  // Filas de la rejilla con la agrupación pedida (separadores entre grupos).
  const ordenadas = [...filas].sort((a, b) =>
    (agrupar === "0" ? 0 : Number(agrupar === "1" ? a.categoria : a.situacion) - Number(agrupar === "1" ? b.categoria : b.situacion))
    || Number(a.matricula) - Number(b.matricula));

  return (
    <div className="pagina paginaTrabajadores">
      <div className="opcionesPagina">
        <h2 className="tituloPagina">Trabajadores</h2>
        {ocupado ? <span className="cargando">Cargando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
        <button className="boton" onClick={onVolver}>← Volver</button>
        <button className="boton" onClick={guardar} disabled={ocupado || !hayCambios}>💾 Guardar y Actualizar</button>
        <button className="boton" onClick={() => cargar()} disabled={ocupado}>↺ Descartar Cambios</button>
      </div>
      <div className="trabajadoresCuerpo">
        <div className="panelTrabajadores">
          <div className="bandaTitulo">TRABAJADORES - {centro}</div>
          <div className="barraPanel">
            <button className="boton" onClick={añadir}>＋ Añadir</button>
            <button className="boton" onClick={borrar} disabled={seleccion === null}>－ Borrar</button>
            <button className="boton" onClick={deshacer} disabled={borradas.length === 0}>↺ Deshacer Borrar</button>
            <button className="boton" onClick={verCalendarios} disabled={!(seleccion !== null && seleccion > 0)}>👥 Mostrar calendarios</button>
            <span className="hueco" />
            <select className="celda" value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
              <option value="0">Sin agrupar</option>
              <option value="1">Por categoría</option>
              <option value="2">Por situación</option>
            </select>
          </div>
          <div className="marcoRejilla">
            <table className="rejilla">
              <thead>
                <tr>
                  <th>Cat.</th><th>Sit.</th><th>Matrícula</th><th>Afiliado</th>
                  <th>Nombre</th><th>Apellidos</th><th>Acumuladas</th>
                  <th>DCs</th><th>DNDs</th><th>Antig.</th><th>%IRPF</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const salidas: ReactNode[] = [];
                  let claveGrupo = "";
                  for (const f of ordenadas) {
                    if (agrupar !== "0") {
                      const clave = agrupar === "1" ? ABRE_CATEGORIA[Number(f.categoria)] ?? "" : ABRE_SITUACION[Number(f.situacion)] ?? "";
                      if (clave !== claveGrupo) {
                        claveGrupo = clave;
                        const etiqueta = agrupar === "1" ? ETIQUETAS_CATEGORIA[Number(f.categoria)] : ETIQUETAS_SITUACION[Number(f.situacion)];
                        salidas.push(<tr key={`grupo-${clave}`} className="filaGrupo"><td colSpan={11}>{etiqueta}</td></tr>);
                      }
                    }
                    salidas.push(
                      <tr
                        key={f.id > 0 ? f.id : `nueva${f.id}`}
                        className={seleccion === f.id ? "sel" : undefined}
                        onClick={() => setSeleccion(f.id)}
                        onDoubleClick={() => setDetalle(f.id)}
                      >
                        <td className="centradoMic">
                          <select className="celda corto" value={f.categoria} onChange={(e) => cambiar(f.id, "categoria", e.target.value)} title={ETIQUETAS_CATEGORIA[Number(f.categoria)]}>
                            {[0, 1, 2].map((v) => <option key={v} value={String(v)}>{ABRE_CATEGORIA[v]}</option>)}
                          </select>
                        </td>
                        <td className="centradoMic">
                          <select className="celda corto" value={f.situacion} onChange={(e) => cambiar(f.id, "situacion", e.target.value)} title={ETIQUETAS_SITUACION[Number(f.situacion)]}>
                            {[0, 1, 2, 3].map((v) => <option key={v} value={String(v)}>{ABRE_SITUACION[v]}</option>)}
                          </select>
                        </td>
                        <td>{celdaTexto(f.matricula, (v) => cambiar(f.id, "matricula", v), "celda num")}</td>
                        <td>{celdaTexto(f.numeroAfiliado, (v) => cambiar(f.id, "numeroAfiliado", v), "celda num")}</td>
                        <td>{celdaTexto(f.nombre, (v) => cambiar(f.id, "nombre", v))}</td>
                        <td>{celdaTexto(f.apellidos, (v) => cambiar(f.id, "apellidos", v))}</td>
                        <td>{celdaTexto(f.acumuladasIniciales, (v) => cambiar(f.id, "acumuladasIniciales", v), "celda num")}</td>
                        <td>{celdaTexto(f.dcsIniciales, (v) => cambiar(f.id, "dcsIniciales", v), "celda num")}</td>
                        <td>{celdaTexto(f.dndsIniciales, (v) => cambiar(f.id, "dndsIniciales", v), "celda num")}</td>
                        <td>
                          <input
                            key={`f-${f.fechaAntiguedad}`}
                            type="date"
                            className="celda num"
                            defaultValue={f.fechaAntiguedad}
                            onChange={(e) => cambiar(f.id, "fechaAntiguedad", e.target.value)}
                          />
                        </td>
                        <td>{celdaTexto(f.porcentajeIrpf, (v) => cambiar(f.id, "porcentajeIrpf", v), "celda num")}</td>
                      </tr>,
                    );
                  }
                  return salidas;
                })()}
                {filas.length === 0 && !ocupado ? (
                  <tr><td colSpan={11} className="vacio">No hay trabajadores en este centro.</td></tr>
                ) : null}
              </tbody>
            </table>
            <p className="pistaDoble">Doble clic sobre un trabajador para abrir su detalle.</p>
          </div>
        </div>
        <div className="panelRegulaciones">
          <div className="bandaTitulo">REGULACIONES</div>
          <div className="barraPanel">
            <button className="boton" onClick={añadirReg} disabled={!(seleccion !== null && seleccion > 0)}>＋ Añadir</button>
            <button className="boton" onClick={borrarReg} disabled={regSeleccion === null}>－ Borrar</button>
            <button className="boton" onClick={deshacerReg} disabled={borradasReg.length === 0}>↺ Deshacer Borrar</button>
            <span className="hueco" />
            <button className={`boton${añoActualReg ? " pulsado" : ""}`} onClick={() => setAñoActualReg(!añoActualReg)}>Año Actual</button>
          </div>
          <div className="marcoRejilla">
            <table className="rejilla">
              <thead>
                <tr><th>Fecha</th><th>Horas</th><th>DCs</th><th>DNDs</th><th>Motivo</th></tr>
              </thead>
              <tbody>
                {regs
                  .filter((g) => g.conductorId === seleccion)
                  .filter((g) => !añoActualReg || g.fecha.startsWith(String(new Date().getFullYear())))
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))
                  .map((g) => (
                    <tr
                      key={g.id > 0 ? g.id : `regNueva${g.id}`}
                      className={regSeleccion === g.id ? "sel" : undefined}
                      onClick={() => setRegSeleccion(g.id)}
                    >
                      <td>
                        <input
                          key={`rf-${g.fecha}`}
                          type="date"
                          className="celda"
                          defaultValue={g.fecha}
                          onChange={(e) => cambiarReg(g.id, "fecha", e.target.value)}
                        />
                      </td>
                      <td>{celdaTexto(g.horas, (v) => cambiarReg(g.id, "horas", v), "celda num")}</td>
                      <td>{celdaTexto(g.dcs, (v) => cambiarReg(g.id, "dcs", v), "celda num")}</td>
                      <td>{celdaTexto(g.dnds, (v) => cambiarReg(g.id, "dnds", v), "celda num")}</td>
                      <td>{celdaTexto(g.motivo, (v) => cambiarReg(g.id, "motivo", v))}</td>
                    </tr>
                  ))}
                {seleccion === null ? (
                  <tr><td colSpan={5} className="vacio">Selecciona un trabajador para ver sus regulaciones.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {filaDetalle !== null ? (
        <DetalleTrabajador
          fila={filaDetalle}
          servidor={servidor}
          token={token}
          onCambiar={(campo, valor) => cambiar(filaDetalle.id, campo, valor)}
          onCerrar={() => setDetalle(null)}
        />
      ) : null}
    </div>
  );
}
