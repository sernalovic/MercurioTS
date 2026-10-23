/**
 * Pantalla Informes — port de `InformesViewModel` + `InformesView`: combo con
 * los cinco informes, combos de grupos para comparar, «Generar» monta la
 * tabla en el cliente a partir de los datos del servidor y «Crear PDF» la
 * vuelca con `Pdf.Informe` (pdf-lib, guardado por IPC).
 */
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { pedirTexto } from "../lib/dialogos";
import { pdfInforme } from "../lib/pdf";
interface DiferenciaInforme { numeroGrafico: number; diferencias: string; }

import { CentroTrabajo, TipoReclamacion, nombreEnum, type ConceptoReclamado } from "@mercurio/domain";

/** `TablaInforme` del original. */
interface TablaInforme {
  titulo: string;
  descripcion: string;
  cabeceras: string[];
  filas: string[][];
  apaisado: boolean;
}

const INFORMES = [
  "Errores en calendarios",
  "Asignación de gráficos",
  "Comparar grupos de gráficos",
  "Estadísticas de reclamaciones (mes)",
  "Estadísticas de reclamaciones (año)",
] as const;

const NOMBRES_CENTRO = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];

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

export function PantallaInformes({ servidor, token, centro, mes, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  mes: string;
  onVolver: () => void;
}): ReactNode {
  const [informe, setInforme] = useState<string>(INFORMES[0]);
  const [grupos, setGrupos] = useState<string[]>([]);
  const [fechaGrupo1, setFechaGrupo1] = useState("");
  const [fechaGrupo2, setFechaGrupo2] = useState("");
  const [resultado, setResultado] = useState<TablaInforme | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** `CargarAsync`: los grupos de gráficos del centro (para comparar). */
  function cargar(): void {
    setOcupado(true);
    setError(null);
    if (centro === "Todos") {
      setGrupos([]);
      setOcupado(false);
      return;
    }
    api<{ grupos: string[] }>(servidor, token, `graficos/grupos?centro=${NOMBRES_CENTRO.indexOf(centro)}`)
      .then((r) => setGrupos(r.grupos))
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(cargar, [servidor, token, centro]);

  // ---- comandos ----

  async function generar(): Promise<void> {
    setOcupado(true);
    setError(null);
    const centroTitulo = centro;
    const mesTitulo = `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;
    try {
      if (informe === "Errores en calendarios") {
        const r = await api<{ calendarios: CalendarioResumen[] }>(
          servidor, token, `calendarios?fecha=${mes}&centro=${NOMBRES_CENTRO.indexOf(centro)}`);
        setResultado({
          titulo: `Errores de calendario · ${centroTitulo} · ${mesTitulo}`,
          descripcion: "Este informe lista todos los errores detectados en los calendarios del mes.",
          cabeceras: ["Matrícula", "Errores"],
          filas: r.calendarios
            .filter((c) => c.resumen !== null && c.resumen.errores !== "")
            .map((c) => [String(c.conductor?.matricula ?? 0), c.resumen?.errores ?? ""]),
          apaisado: false,
        });
      } else if (informe === "Asignación de gráficos") {
        const r = await api<{ asignacion: Asignacion[] }>(
          servidor, token, `calendarios/estadisticas/asignacionGraficos?fecha=${mes}&centro=${NOMBRES_CENTRO.indexOf(centro)}`);
        setResultado({
          titulo: `Asignación de gráficos · ${centroTitulo} · ${mesTitulo}`,
          descripcion: "Descansos por día, gráficos que se deben realizar según el grupo vigente, cuántos están asignados, los no asignados y los que se realizan sin estar en el grupo.",
          cabeceras: ["Día", "Gráficos", "Descansos", "Asignados", "No asignados", "Inexistentes"],
          filas: r.asignacion.map((a) => [
            diaConSemana(a.fecha), String(a.graficosParaDia), String(a.descansosParaDia),
            String(a.graficosAsignados), a.noAsignados, a.inexistentes,
          ]),
          apaisado: true,
        });
      } else if (informe === "Comparar grupos de gráficos") {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fechaGrupo1.trim()) || !/^\d{2}\/\d{2}\/\d{4}$/.test(fechaGrupo2.trim())) {
          window.alert("Indica las fechas de los dos grupos a comparar (dd/mm/aaaa).");
          return;
        }
        const iso = (texto: string): string => {
          const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
          return m === null ? "" : `${m[3]}-${m[2]}-${m[1]}`;
        };
        const f1 = iso(fechaGrupo1);
        const f2 = iso(fechaGrupo2);
        const r = await api<{ diferencias: DiferenciaInforme[] }>(
          servidor, token, `graficos/diferencias/simples?fecha1=${f1}&fecha2=${f2}&centro=${NOMBRES_CENTRO.indexOf(centro)}`);
        setResultado({
          titulo: `Comparación de grupos de gráficos · ${fechaGrupo1.replace(/\//g, "-")} / ${fechaGrupo2.replace(/\//g, "-")}`,
          descripcion: "Gráficos que no existen en uno de los grupos y diferencias en los que existen en ambos.",
          cabeceras: ["Gráfico", "Diferencias"],
          filas: r.diferencias.map((x) => [String(x.numeroGrafico), x.diferencias]),
          apaisado: false,
        });
      } else {
        const año = informe.endsWith("(año)");
        const url = año
          ? `reclamaciones/estadisticas/conceptosAno?año=${mes.slice(0, 4)}&centro=${NOMBRES_CENTRO.indexOf(centro)}`
          : `reclamaciones/estadisticas/conceptosMes?fecha=${mes}&centro=${NOMBRES_CENTRO.indexOf(centro)}`;
        const r = await api<{ conceptos: ConceptoExtendido[] }>(servidor, token, url);
        const filas = r.conceptos.map((c) => [
          String(c.matricula),
          c.concepto.fecha === "" ? "" : `${c.concepto.fecha.slice(8, 10)}-${c.concepto.fecha.slice(5, 7)}-${c.concepto.fecha.slice(0, 4)}`,
          nombreEnum(TipoReclamacion, c.concepto.tipo),
          c.concepto.descripcion ?? "",
          d(Math.round(c.concepto.importeTotal) / 100),
          c.concepto.resuelto ? "Sí" : "No",
        ]);
        const total = r.conceptos.reduce((s, c) => s + Math.round(c.concepto.importeTotal), 0);
        filas.push(["", "", "", "TOTAL", d(total / 100), ""]);
        setResultado({
          titulo: `Estadísticas de reclamaciones · ${centroTitulo} · ${año ? mes.slice(0, 4) : mesTitulo}`,
          descripcion: "Conceptos reclamados en el período para el centro indicado y totales reclamados.",
          cabeceras: ["Matrícula", "Fecha", "Tipo", "Concepto", "Importe", "Resuelto"],
          filas,
          apaisado: true,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
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

  return (
    <div className="pagina">
      <div className="cabeceraPagina">
        <h2 className="tituloPagina">Informes</h2>
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
      </div>
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver} disabled={ocupado}>Volver</button>
        <select className="celda comboInformes" value={informe} onChange={(e) => setInforme(e.target.value)}>
          {INFORMES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <span className="etiqueta">Grupos (comparar):</span>
        <input
          className="celda"
          list="gruposInformes"
          value={fechaGrupo1}
          placeholder={grupos[0] ?? ""}
          onChange={(e) => setFechaGrupo1(e.target.value)}
        />
        <input
          className="celda"
          list="gruposInformes"
          value={fechaGrupo2}
          placeholder={grupos[0] ?? ""}
          onChange={(e) => setFechaGrupo2(e.target.value)}
        />
        <datalist id="gruposInformes">
          {grupos.map((g) => <option key={g} value={g.split("-").reverse().join("/")} />)}
        </datalist>
        <button className="botonPrincipal" onClick={generar} disabled={ocupado}>Generar</button>
        <button className="boton" onClick={crearPdf} disabled={ocupado || resultado === null}>Crear PDF</button>
      </div>
      {resultado !== null ? (
        <>
          <div className="cabeceraInforme">
            <h3>{resultado.titulo}</h3>
            <p>{resultado.descripcion}</p>
          </div>
          <div className="tablaInforme">
            <table className="rejilla">
              <thead>
                <tr>{resultado.cabeceras.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {resultado.filas.map((f, i) => (
                  <tr key={i}>{f.map((v, j) => <td key={j}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
