/**
 * Pantalla Informes — aspecto de Orión 2: barra lateral con tres grupos
 * (GRÁFICOS: Comparar grupos de gráficos / Realización de gráficos ·
 * CALENDARIOS: Estadísticas / Asignación de gráficos / Errores ·
 * RECLAMACIONES: Estadísticas) y a la derecha el informe elegido con su
 * título, controles propios, «Generar informe» y «Crear PDF»
 * (`Pdf.Informe` portado a pdf-lib por IPC). Funcionalidad:
 *  - Comparar grupos: dos grupos del centro → `graficos/diferencias/simples`.
 *  - Realización de gráficos: por cada gráfico del grupo elegido, cuántos
 *    días del mes aparece en los calendarios del centro (nuevo).
 *  - Estadísticas de calendarios: matriz por matrícula con el recuento de
 *    situaciones del mes o del año (Mensual/Anual, nuevo).
 *  - Asignación de gráficos: por día, descansos/gráficos/asignados/no
 *    asignados/inexistentes (`asignacionGraficos`), con mes o año completo
 *    y filtro «Lun-Vie» (oculta los sábados).
 *  - Errores: matrícula + errores del mes o del año completo.
 *  - Estadísticas de reclamaciones: conceptos del mes o del año con
 *    filtros Cat./Sit., columnas Real/En pijama/Diferencia/Importe y las
 *    cuatro tarjetas de totales (conceptos, horas, dietas, importe).
 */
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { pdfInforme } from "../lib/pdf";
import { SeparadorV } from "../componentes/Separador";
import { duracion } from "../lib/horas";
import {
  CentroTrabajo, CategoriaTrabajador, SituacionTrabajador, TipoReclamacion, TiposDieta, nombreEnum,
  type ConceptoReclamado,
} from "@mercurio/domain";

/** `TablaInforme` del original. */
interface TablaInforme {
  titulo: string;
  descripcion: string;
  cabeceras: string[];
  filas: string[][];
  apaisado: boolean;
}

interface DiferenciaInforme { numeroGrafico: number; diferencias: string; }

interface CalendarioResumen {
  conductor: { matricula: number } | null;
  resumen: { errores: string } | null;
}

interface Asignacion {
  fecha: string;
  esSabado: boolean;
  esFestivo: boolean;
  graficosParaDia: number;
  descansosParaDia: number;
  graficosAsignados: number;
  noAsignados: string;
  inexistentes: string;
}

interface ConceptoExtendido { matricula: number; concepto: ConceptoReclamado; }

interface CabBasica {
  matricula: number;
  dias: Array<{ fecha: string; situacion: string; esFestivo: boolean }>;
}

const NOMBRES_CENTRO = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

/** Grupos de la barra lateral (ids internos + etiqueta visible). */
const GRUPOS_SIDEBAR: Array<{ titulo: string; informes: Array<[string, string]> }> = [
  {
    titulo: "Gráficos",
    informes: [
      ["comparar", "Comparar grupos de gráficos"],
      ["realizacion", "Realización de gráficos"],
    ],
  },
  {
    titulo: "Calendarios",
    informes: [
      ["estadisticasCal", "Estadísticas"],
      ["asignacion", "Asignación de gráficos"],
      ["errores", "Errores"],
    ],
  },
  {
    titulo: "Reclamaciones",
    informes: [
      ["estadisticasRecl", "Estadísticas"],
    ],
  },
];

const TITULOS: Record<string, string> = {
  comparar: "Comparar grupos de gráficos",
  realizacion: "Realización de los gráficos",
  estadisticasCal: "Estadísticas de calendarios",
  asignacion: "Asignación de gráficos en calendarios",
  errores: "Errores en calendarios",
  estadisticasRecl: "Estadísticas de reclamaciones",
};

const AYUDA: Record<string, string> = {
  comparar: "Gráficos que no existen en uno de los grupos y diferencias en los que existen en ambos.",
  realizacion: "Por cada gráfico del grupo elegido, en cuántos días del mes aparece en los calendarios del centro.",
  estadisticasCal: "Recuento de situaciones (JD, DS, FN, DC, OV…) por matrícula del centro, para el mes o el año.",
  asignacion: "Descansos por día, gráficos que se deben realizar según el grupo vigente, cuántos están asignados, los no asignados y los que se realizan sin estar en el grupo.",
  errores: "Este informe lista todos los errores detectados en los calendarios del período.",
  estadisticasRecl: "Conceptos reclamados en el período para el centro indicado y totales reclamados.",
};

/** es-ES "N2": "1.234,56" (formato `D()` del original). */
function d(v: number): string {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** `Utilidades.DiaConSemana`: "L-05". */
function diaConSemana(fecha: string): string {
  const dias = ["D", "L", "M", "X", "J", "V", "S"];
  const n = new Date(`${fecha}T12:00:00`).getUTCDay();
  return `${dias[n]}-${fecha.slice(8, 10)}`;
}

/** "dd-mm-aaaa" del concepto (como la columna Fecha de la captura). */
function fechaCorta(fecha: string): string {
  return fecha === "" ? "" : `${fecha.slice(8, 10)}-${fecha.slice(5, 7)}-${fecha.slice(0, 4)}`;
}

/** Unidades de dieta/pendiente → "0,##" (es-ES). */
function unidades(v: number): string {
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

/** Suma o resta un mes a "YYYY-MM". */
function desplazarMes(fecha: string, n: number): string {
  const [a, m] = fecha.split("-").map(Number) as [number, number];
  const dd = new Date(a, m - 1 + n, 1);
  return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`;
}

/** Recuento de situaciones por matrícula (Estadísticas de calendarios). */
function matrizSituaciones(basicos: CabBasica[]): { cabeceras: string[]; filas: string[][] } {
  const etiquetas = new Set<string>();
  const porMatricula = new Map<number, Map<string, number>>();
  for (const c of basicos) {
    const fila = porMatricula.get(c.matricula) ?? new Map<string, number>();
    for (const dia of c.dias) {
      const s = dia.situacion.trim();
      if (s === "") continue;
      const clave = /^[0-9]+\*?$/.test(s) ? "Trabajados" : s.replace(/\*$/, "");
      etiquetas.add(clave);
      fila.set(clave, (fila.get(clave) ?? 0) + 1);
    }
    porMatricula.set(c.matricula, fila);
  }
  const orden = Array.from(etiquetas).sort((a, b) =>
    a === "Trabajados" ? 1 : b === "Trabajados" ? -1 : a.localeCompare(b));
  const filas = [...porMatricula.keys()].sort((a, b) => a - b).map((mat) => {
    const f = porMatricula.get(mat) as Map<string, number>;
    return [String(mat), ...orden.map((e) => String(f.get(e) ?? 0))];
  });
  return { cabeceras: ["Matrícula", ...orden], filas };
}

export function PantallaInformes({ servidor, token, centro, mes, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  mes: string;
  onVolver: () => void;
}): ReactNode {
  const [informe, setInforme] = useState("comparar");
  const [anchoInf, setAnchoInf] = useState(230);
  const [resultado, setResultado] = useState<TablaInforme | null>(null);
  const [tarjetas, setTarjetas] = useState<Array<[string, string]>>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // controles por informe
  const [centroInforme, setCentroInforme] = useState(centro === "" ? "Todos" : centro);
  const [grupos, setGrupos] = useState<string[]>([]);
  const [grupo1, setGrupo1] = useState("");
  const [grupo2, setGrupo2] = useState("");
  const [grupoReal, setGrupoReal] = useState("");
  const [mesInforme, setMesInforme] = useState(mes === "" ? new Date().toISOString().slice(0, 7) : mes);
  const [añoCompleto, setAñoCompleto] = useState(false);
  const [lunVie, setLunVie] = useState(true);
  const [tipoEstad, setTipoEstad] = useState("Mensual");
  const [catFiltro, setCatFiltro] = useState("Todos");
  const [sitFiltro, setSitFiltro] = useState("Todos");

  /** Los grupos de gráficos del centro del informe (para comparar y realizar). */
  function cargarGrupos(c: string): void {
    setGrupos([]);
    setGrupo1("");
    setGrupo2("");
    setGrupoReal("");
    api<{ grupos: string[] }>(servidor, token, `graficos/grupos?centro=${NOMBRES_CENTRO.indexOf(c)}`)
      .then((r) => setGrupos(r.grupos))
      .catch(() => setGrupos([]));
  }

  useEffect(() => { cargarGrupos(centroInforme); }, [servidor, token, centroInforme]);

  // ---- helpers de generación ----

  function cerrarGeneracion(): void {
    setOcupado(false);
  }

  /** Meses del período: el mes solo o los 12 del año («Año completo»). */
  function mesesPeriodo(): string[] {
    if (!añoCompleto) return [mesInforme];
    const año = mesInforme.slice(0, 4);
    return Array.from({ length: 12 }, (_, i) => `${año}-${String(i + 1).padStart(2, "0")}`);
  }

  /** Descarga los básicos de cada mes del período (en paralelo). */
  async function basicosDe(meses: string[]): Promise<Array<{ fechaMes: string; filas: CabBasica[] }>> {
    const centroNum = NOMBRES_CENTRO.indexOf(centroInforme);
    return Promise.all(meses.map(async (m) => {
      const filtro = new URLSearchParams({ fecha: m });
      if (centroNum > 0) filtro.set("centro", String(centroNum));
      const r = await api<{ calendarios: CabBasica[] }>(servidor, token, `calendarios/basicos?${filtro}`);
      return { fechaMes: m, filas: r.calendarios };
    }));
  }

  async function generar(): Promise<void> {
    setOcupado(true);
    setError(null);
    const centroTitulo = centroInforme;
    const mesTitulo = `${mesInforme.slice(5, 7)}/${mesInforme.slice(0, 4)}`;
    try {
      if (informe === "comparar") {
        if (grupo1 === "" || grupo2 === "") {
          window.alert("Indica los dos grupos a comparar.");
          return;
        }
        const r = await api<{ diferencias: DiferenciaInforme[] }>(
          servidor, token,
          `graficos/diferencias/simples?fecha1=${grupo1}&fecha2=${grupo2}&centro=${NOMBRES_CENTRO.indexOf(centroInforme)}`);
        setResultado({
          titulo: `Comparación de grupos de gráficos · ${centroTitulo} · ` +
            `${grupo1.slice(8, 10)}-${grupo1.slice(5, 7)}-${grupo1.slice(0, 4)} / ` +
            `${grupo2.slice(8, 10)}-${grupo2.slice(5, 7)}-${grupo2.slice(0, 4)}`,
          descripcion: AYUDA.comparar,
          cabeceras: ["Gráfico", "Diferencias"],
          filas: r.diferencias.map((x) => [String(x.numeroGrafico), x.diferencias]),
          apaisado: false,
        });
      } else if (informe === "realizacion") {
        if (grupoReal === "") {
          window.alert("Indica el grupo de gráficos a comprobar.");
          return;
        }
        const [g, meses] = await Promise.all([
          api<{ graficos: Array<{ numero: number; turno: number }> }>(
            servidor, token,
            `graficos/entreFechas?desde=${grupoReal}&hasta=${grupoReal}&centro=${NOMBRES_CENTRO.indexOf(centroInforme)}`),
          basicosDe(mesesPeriodo()),
        ]);
        // Veces que aparece cada número del grupo en los calendarios del período.
        const veces = new Map<number, number>();
        for (const { filas } of meses) {
          for (const c of filas) {
            for (const dia of c.dias) {
              const n = Number.parseInt(dia.situacion.trim().replace(/\*$/, ""), 10);
              if (Number.isInteger(n) && n > 0) veces.set(n, (veces.get(n) ?? 0) + 1);
            }
          }
        }
        setResultado({
          titulo: `Realización de los gráficos · ${centroTitulo} · ${mesTitulo} · grupo del ` +
            `${grupoReal.slice(8, 10)}-${grupoReal.slice(5, 7)}-${grupoReal.slice(0, 4)}`,
          descripcion: AYUDA.realizacion,
          cabeceras: ["Gráfico", "Turno", "Días realizado"],
          filas: g.graficos.map((gr) => [
            String(gr.numero), String(gr.turno === 0 ? "" : gr.turno), String(veces.get(gr.numero) ?? 0),
          ]),
          apaisado: false,
        });
      } else if (informe === "estadisticasCal") {
        const meses = tipoEstad === "Anual"
          ? Array.from({ length: 12 }, (_, i) => `${mesInforme.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`)
          : [mesInforme];
        const mesesDatos = await basicosDe(meses);
        const { cabeceras, filas } = matrizSituaciones(mesesDatos.flatMap((m) => m.filas));
        setResultado({
          titulo: `Estadísticas de calendarios · ${centroTitulo} · ` +
            (tipoEstad === "Anual" ? mesInforme.slice(0, 4) : mesTitulo),
          descripcion: AYUDA.estadisticasCal,
          cabeceras,
          filas,
          apaisado: true,
        });
      } else if (informe === "asignacion") {
        const meses = mesesPeriodo();
        const centroNum = NOMBRES_CENTRO.indexOf(centroInforme);
        const partes = await Promise.all(meses.map((m) =>
          api<{ asignacion: Asignacion[] }>(servidor, token,
            `calendarios/estadisticas/asignacionGraficos?fecha=${m}&centro=${centroNum}`)));
        const filas: string[][] = [];
        for (const p of partes) {
          for (const a of p.asignacion) {
            if (lunVie && a.esSabado) continue;
            filas.push([
              diaConSemana(a.fecha), String(a.descansosParaDia), String(a.graficosParaDia),
              String(a.graficosAsignados), a.noAsignados, a.inexistentes,
            ]);
          }
        }
        setResultado({
          titulo: `Asignación de gráficos · ${centroTitulo} · ` +
            (añoCompleto ? mesInforme.slice(0, 4) : mesTitulo),
          descripcion: AYUDA.asignacion,
          cabeceras: ["Día", "Descansos", "Gráficos", "Asignados", "No asignados", "Inexistentes"],
          filas,
          apaisado: true,
        });
      } else if (informe === "errores") {
        const meses = mesesPeriodo();
        const centroNum = NOMBRES_CENTRO.indexOf(centroInforme);
        const partes = await Promise.all(meses.map((m) =>
          api<{ calendarios: CalendarioResumen[] }>(servidor, token, `calendarios?fecha=${m}&centro=${centroNum}`)));
        setResultado({
          titulo: `Errores de calendario · ${centroTitulo} · ` +
            (añoCompleto ? mesInforme.slice(0, 4) : mesTitulo),
          descripcion: AYUDA.errores,
          cabeceras: ["Matrícula", "Errores"],
          filas: partes.flatMap((p) => p.calendarios)
            .filter((c) => c.resumen !== null && c.resumen.errores !== "")
            .map((c) => [String(c.conductor?.matricula ?? 0), c.resumen?.errores ?? ""]),
          apaisado: false,
        });
      } else {
        // Estadísticas de reclamaciones: mes o año + filtros Cat./Sit.
        const año = añoCompleto;
        const url = año
          ? `reclamaciones/estadisticas/conceptosAno?año=${mesInforme.slice(0, 4)}&centro=${NOMBRES_CENTRO.indexOf(centroInforme)}`
          : `reclamaciones/estadisticas/conceptosMes?fecha=${mesInforme}&centro=${NOMBRES_CENTRO.indexOf(centroInforme)}`;
        const [r, cnd] = await Promise.all([
          api<{ conceptos: ConceptoExtendido[] }>(servidor, token, url),
          api<{ conductores: Array<{ matricula: number; categoria: number; situacion: number }> }>(
            servidor, token, "conductores?centro=0"),
        ]);
        const porMatricula = new Map(cnd.conductores.map((c) => [c.matricula, c]));
        const conceptos = r.conceptos.filter((x) => {
          const c = porMatricula.get(x.matricula);
          if (c === undefined) return catFiltro === "Todos" && sitFiltro === "Todos";
          return (catFiltro === "Todos" || Number(catFiltro) === c.categoria)
            && (sitFiltro === "Todos" || Number(sitFiltro) === c.situacion);
        });
        const filas = conceptos.map((x) => {
          const dif = x.concepto.horasReales - x.concepto.horasCobradas;
          return [
            String(x.matricula),
            fechaCorta(x.concepto.fecha),
            x.concepto.descripcion ?? "",
            String(x.concepto.graficoTrabajado),
            duracion(x.concepto.horasReales),
            duracion(x.concepto.horasCobradas),
            (dif < 0 ? "-" : "") + duracion(Math.abs(dif)),
            unidades(Math.round(x.concepto.importeTotal) / 100),
          ];
        });
        const totalImporte = conceptos.reduce((s, x) => s + Math.round(x.concepto.importeTotal), 0);
        const totalHoras = conceptos.reduce((s, x) => s + x.concepto.horasReales, 0);
        const totalDietas = conceptos
          .filter((x) => TiposDieta.includes(x.concepto.tipo))
          .reduce((s, x) => s + x.concepto.importeReal, 0);
        setResultado({
          titulo: `Estadísticas de reclamaciones · ${centroTitulo} · ` +
            (año ? mesInforme.slice(0, 4) : mesTitulo),
          descripcion: AYUDA.estadisticasRecl,
          cabeceras: ["Matrícula", "Fecha", "Descripción", "Gráfico", "Real", "En pijama", "Diferencia", "Importe"],
          filas,
          apaisado: true,
        });
        setTarjetas([
          ["Total conceptos reclamados", String(conceptos.length)],
          ["Total horas reclamadas", duracion(totalHoras)],
          ["Total dietas reclamadas", unidades(totalDietas)],
          ["Total importe reclamado", `${d(Math.round(totalImporte) / 100)} €`],
        ]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      cerrarGeneracion();
    }
  }

  /** `CrearPdf`: guarda el informe con diálogo del proceso principal. */
  async function crearPdf(): Promise<void> {
    if (resultado === null) return;
    setOcupado(true);
    setError(null);
    try {
      const bytes = await pdfInforme(
        resultado.titulo, resultado.descripcion, resultado.cabeceras, resultado.filas, resultado.apaisado,
      );
      const nombre = `${resultado.titulo.replace(/\//g, "-").replace(/·/g, "-")}.pdf`;
      if (window.mercurio !== undefined) {
        await window.mercurio.guardarPdf(bytes.buffer as ArrayBuffer, nombre);
      } else {
        const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = nombre;
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

  const cambiaMes = informe === "comparar" || informe === "estadisticasCal" ? null : (
    informe === "asignacion" ? (
      // Asignación navega por año.
      <>
        <button className="botonFlecha" onClick={() => setMesInforme(desplazarMes(mesInforme, -12))} disabled={ocupado} aria-label="Año anterior">←</button>
        <span className="tituloPeriodo">{mesInforme.slice(0, 4)}</span>
        <button className="botonFlecha" onClick={() => setMesInforme(desplazarMes(mesInforme, 12))} disabled={ocupado} aria-label="Año siguiente">→</button>
        <button className={`botonLote${añoCompleto ? " pulsado" : ""}`} onClick={() => setAñoCompleto(!añoCompleto)}>Año completo</button>
        <span className="etiquetaMini">Centro:</span>
        <select className="celda" value={centroInforme} onChange={(e) => { setCentroInforme(e.target.value); }}>
          {NOMBRES_CENTRO.map((c) => <option key={c}>{c}</option>)}
        </select>
      </>
    ) : (
      // Errores, Realización y Estadísticas de reclamaciones navegan por mes.
      <>
        <button className="botonFlecha" onClick={() => setMesInforme(desplazarMes(mesInforme, -1))} disabled={ocupado} aria-label="Mes anterior">←</button>
        <span className="tituloPeriodo">{MESES[Number(mesInforme.slice(5, 7)) - 1]} {mesInforme.slice(0, 4)}</span>
        <button className="botonFlecha" onClick={() => setMesInforme(desplazarMes(mesInforme, 1))} disabled={ocupado} aria-label="Mes siguiente">→</button>
        <button className={`botonLote${añoCompleto ? " pulsado" : ""}`} onClick={() => setAñoCompleto(!añoCompleto)}>Año completo</button>
        {informe === "estadisticasRecl" ? (
          <>
            <span className="etiquetaMini">Centro:</span>
            <select className="celda" value={centroInforme} onChange={(e) => { setCentroInforme(e.target.value); }}>
              {NOMBRES_CENTRO.map((c) => <option key={c}>{c}</option>)}
            </select>
            <span className="etiquetaMini">Cat:</span>
            <select className="celda" value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)}>
              <option value="Todos">Todos</option>
              {Object.values(CategoriaTrabajador).filter((v) => typeof v === "number").map((v) => (
                <option key={String(v)} value={String(v)}>{nombreEnum(CategoriaTrabajador, v as CategoriaTrabajador)}</option>
              ))}
            </select>
            <span className="etiquetaMini">Sit:</span>
            <select className="celda" value={sitFiltro} onChange={(e) => setSitFiltro(e.target.value)}>
              <option value="Todos">Todos</option>
              {Object.values(SituacionTrabajador).filter((v) => typeof v === "number").map((v) => (
                <option key={String(v)} value={String(v)}>{nombreEnum(SituacionTrabajador, v as SituacionTrabajador)}</option>
              ))}
            </select>
          </>
        ) : informe === "realizacion" ? (
          <>
            <span className="etiquetaMini">Centro:</span>
            <select className="celda" value={centroInforme} onChange={(e) => setCentroInforme(e.target.value)}>
              {NOMBRES_CENTRO.map((c) => <option key={c}>{c}</option>)}
            </select>
          </>
        ) : (
          <>
            <span className="etiquetaMini">Centro:</span>
            <select className="celda" value={centroInforme} onChange={(e) => setCentroInforme(e.target.value)}>
              {NOMBRES_CENTRO.map((c) => <option key={c}>{c}</option>)}
            </select>
          </>
        )}
      </>
    )
  );

  return (
    <div className="pagina paginaInformesO2">
      <div className="informesCuerpo">
        <div className="sidebarInformes" style={{ flex: `0 0 ${anchoInf}px` }}>
          <button className="boton botonVolverInf" onClick={onVolver} disabled={ocupado}>← Volver</button>
          {GRUPOS_SIDEBAR.map((grupo) => (
            <div key={grupo.titulo} className="grupoSidebar">
              <div className="tituloGrupoSidebar">{grupo.titulo}</div>
              {grupo.informes.map(([id, etiqueta]) => (
                <button
                  key={id}
                  className={`botonSidebar${informe === id ? " sel" : ""}`}
                  onClick={() => { setInforme(id); setResultado(null); setTarjetas([]); }}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          ))}
        </div>
        <SeparadorV ancho={anchoInf} onAncho={setAnchoInf} min={140} max={520} />
        <div className="informesPrincipal">
          <div className="cabeceraInformeO2">
            <h2>{TITULOS[informe]}</h2>
            <button className="botonFlecha" title={AYUDA[informe]} disabled>?</button>
          </div>
          {ocupado ? <span className="cargando">Trabajando…</span> : null}
          {error ? <span className="error" role="alert">{error}</span> : null}
          <div className="controlesInforme">
            {cambiaMes}
            {informe === "comparar" ? (
              <>
                <span className="etiquetaMini">Centro:</span>
                <select className="celda" value={centroInforme} onChange={(e) => setCentroInforme(e.target.value)}>
                  {NOMBRES_CENTRO.map((c) => <option key={c}>{c}</option>)}
                </select>
                <span className="etiquetaMini">Grupo 1:</span>
                <select className="celda" value={grupo1} onChange={(e) => setGrupo1(e.target.value)}>
                  <option value=""></option>
                  {grupos.map((g) => (
                    <option key={g} value={g}>{g.slice(8, 10)}-{g.slice(5, 7)}-{g.slice(0, 4)}</option>
                  ))}
                </select>
                <span className="etiquetaMini">Grupo 2:</span>
                <select className="celda" value={grupo2} onChange={(e) => setGrupo2(e.target.value)}>
                  <option value=""></option>
                  {grupos.map((g) => (
                    <option key={g} value={g}>{g.slice(8, 10)}-{g.slice(5, 7)}-{g.slice(0, 4)}</option>
                  ))}
                </select>
              </>
            ) : null}
            {informe === "estadisticasCal" ? (
              <>
                <span className="etiquetaMini">Tipo de estadística</span>
                <select className="celda" value={tipoEstad} onChange={(e) => setTipoEstad(e.target.value)}>
                  <option>Mensual</option>
                  <option>Anual</option>
                </select>
              </>
            ) : null}
          </div>
          <div className="controlesInforme">
            <button className="boton" onClick={() => void generar()} disabled={ocupado}>⇄ Generar informe</button>
            <button className="boton" onClick={() => void crearPdf()} disabled={ocupado || resultado === null}>📄 Crear PDF</button>
            {informe === "asignacion" ? (
              <button className={`botonLote${lunVie ? " pulsado" : ""}`} onClick={() => setLunVie(!lunVie)}>Lun-Vie</button>
            ) : null}
          </div>
          {resultado !== null ? (
            <div className="tablaInforme marcoRejilla">
              <table className="rejilla">
                <thead>
                  <tr>{resultado.cabeceras.map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {resultado.filas.map((f, i) => (
                    <tr key={i}>{f.map((v, j) => <td key={j}>{v}</td>)}</tr>
                  ))}
                  {resultado.filas.length === 0 ? (
                    <tr><td colSpan={resultado.cabeceras.length} className="vacio">Sin datos para el período.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
          {tarjetas.length > 0 ? (
            <div className="tarjetasTotales">
              {tarjetas.map(([t, v], i) => (
                <div key={t} className={`tarjetaTotal tarjeta${i}`.trim()}>
                  <span className="tituloTarjeta">{t}</span>
                  <span className="valorTarjeta">{v}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
