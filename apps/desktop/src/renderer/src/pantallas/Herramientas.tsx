/**
 * Pantalla Herramientas — port de `HerramientasViewModel` + `HerramientasView`:
 * dos paneles, «Extraer calendarios crudos a un archivo de Excel» (los días
 * del mes o del año con su servicio trabajado completo, en el cliente con
 * exceljs + IPC) y el acceso a «Extraer gráficos».
 */
import { useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { excelTabla, type CeldaExcel } from "../lib/excel";
import {
  CategoriaGrafico, CategoriaTrabajador, CentroTrabajo, CodigoIncidencia,
  Incidencia, SituacionTrabajador, TipoDia, Turno, nombreEnum,
  type Calendario,
} from "@mercurio/domain";

const NOMBRES_CENTRO = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];

/** Cabeceras del Excel crudo (orden y textos del original). */
const CABECERAS_CRUDO = [
  "Matrícula", "Categoría", "Situación", "Reducción jornada", "Centro", "Fecha", "Es festivo", "Incidencia", "Código", "Gráfico",
  "Categoría gráfico", "Tipo día", "Turno", "Inicio", "Final", "Inicio partido", "Final partido", "Valoración", "Tiempo total",
  "Tiempo partido", "Trabajadas", "Trabajadas convenio", "Tiempo vacío", "Acumuladas", "Nocturnas", "Desayuno", "Comida", "Cena",
  "Tiene paquetería", "Plus paquetería", "Facturado paquetería", "Limpieza", "Plus menor descanso", "Dnd cobrado", "Dnds cobrados por descanso",
];

/** `Utilidades.Duracion`: "" si es cero. */
function duracion(min: number): string {
  if (min === 0) return "";
  const s = min < 0 ? "-" : "";
  const t = Math.abs(min);
  return `${s}${Math.trunc(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** `Utilidades.Hora`: "hh:mm" de un instante en minutos, null → "". */
function hora(min: number | null): string {
  if (min === null) return "";
  const t = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function PantallaHerramientas({ servidor, token, centro, mes, onVolver, onExtraer }: {
  servidor: string;
  token: string;
  centro: string;
  mes: string;
  onVolver: () => void;
  onExtraer: () => void;
}): ReactNode {
  const [añoCompleto, setAñoCompleto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * `CalendariosCrudos`: baja los calendarios del período, aplana los días
   * con el servicio trabajado y los escribe en un Excel con diálogo.
   */
  async function calendariosCrudos(): Promise<void> {
    setOcupado(true);
    setError(null);
    try {
      const numeroCentro = NOMBRES_CENTRO.indexOf(centro);
      const meses = añoCompleto
        ? Array.from({ length: 12 }, (_, m) => `${mes.slice(0, 4)}-${String(m + 1).padStart(2, "0")}-01`)
        : [mes];
      const todos: Calendario[] = [];
      for (const f of meses) {
        const r = await api<{ calendarios: Calendario[] }>(servidor, token, `calendarios?fecha=${f}&centro=${numeroCentro}`);
        todos.push(...r.calendarios);
      }
      if (todos.length === 0) {
        window.alert("No se han encontrado calendarios para el período y centro seleccionados.");
        return;
      }
      const filas: CeldaExcel[][] = [];
      for (const c of todos) {
        for (const d of [...c.dias].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
          const s = d.servicioTrabajado;
          filas.push([
            c.conductor?.matricula ?? 0,
            nombreEnum(CategoriaTrabajador, c.conductor?.categoria ?? 0),
            nombreEnum(SituacionTrabajador, c.conductor?.situacion ?? 0),
            c.conductor?.isReduccionJornada === true,
            nombreEnum(CentroTrabajo, c.centro),
            d.fecha,
            d.esFestivo,
            nombreEnum(Incidencia, s.incidencia),
            nombreEnum(CodigoIncidencia, s.codigo),
            s.numero,
            nombreEnum(CategoriaGrafico, s.categoria),
            nombreEnum(TipoDia, s.tipoDia),
            nombreEnum(Turno, s.turno),
            hora(s.inicio), hora(s.final), hora(s.inicioPartido), hora(s.finalPartido),
            duracion(s.valoracion), duracion(s.tiempoTotal), duracion(s.tiempoPartido),
            duracion(s.trabajadas), duracion(s.trabajadasConvenio), duracion(s.tiempoVacio),
            duracion(s.acumuladas), duracion(s.nocturnas),
            s.desayuno, s.comida, s.cena,
            s.tienePlusPaqueteria,
            Math.round(s.plusPaqueteria) / 100,
            Math.round(s.facturadoPaqueteria) / 100,
            s.limpieza,
            Math.round(s.plusMenorDescanso) / 100,
            d.dndCobrado,
            d.dndsCobradosPorDescanso,
          ]);
        }
      }
      const bytes = await excelTabla("Calendarios", CABECERAS_CRUDO, filas);
      const nombre = `Calendarios ${centro} ${añoCompleto ? mes.slice(0, 4) : mes.slice(0, 7)}.xlsx`;
      if (window.mercurio !== undefined) {
        await window.mercurio.guardarExcel(bytes.buffer as ArrayBuffer, nombre);
      } else {
        const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }));
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
        <h2 className="tituloPagina">Herramientas</h2>
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
      </div>
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver} disabled={ocupado}>Volver</button>
      </div>
      <div className="herramientasPaneles">
        <div className="panel">
          <h3 className="tituloSeccion">Extraer calendarios crudos a un archivo de Excel</h3>
          <p>Exporta todos los días de los calendarios del centro y mes seleccionados arriba, con su servicio trabajado completo.</p>
          <label className="casilla">
            <input type="checkbox" checked={añoCompleto} onChange={(e) => setAñoCompleto(e.target.checked)} />
            Año completo
          </label>
          <button className="botonPrincipal" onClick={calendariosCrudos} disabled={ocupado}>Crear Excel</button>
        </div>
        <div className="panel">
          <h3 className="tituloSeccion">Extraer gráficos</h3>
          <p>Genera un grupo de gráficos (centro y fecha de validez) a partir del texto de los PDF de gráficos de la empresa.</p>
          <button className="botonPrincipal" onClick={onExtraer} disabled={ocupado}>Abrir</button>
        </div>
      </div>
    </div>
  );
}
