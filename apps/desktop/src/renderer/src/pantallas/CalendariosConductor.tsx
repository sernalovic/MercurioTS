/**
 * Calendarios de un conductor a lo largo de un año — aspecto de Orión 2
 * (`CalendariosConductorViewModel`): barra superior con «Volver» y
 * «Descartar Cambios», banda «CALENDARIOS DE matrícula», fila del año
 * (← 2026 →) con el botón «Detalle» y rejilla de los 12 meses (una fila
 * por calendario del año, 31 columnas). Doble clic abre el detalle.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import { RejillaCalendarios, type CabCalendario } from "../componentes/RejillaCalendarios";

export interface ConductorContexto {
  id: number;
  matricula: number;
  nombre: string;
  apellidos: string;
}

export function PantallaCalendariosConductor({ servidor, token, conductor, onVolver, onDetalle }: {
  servidor: string;
  token: string;
  conductor: ConductorContexto;
  onVolver: () => void;
  onDetalle: (idCalendario: number) => void;
}): ReactNode {
  const [año, setAño] = useState(() => new Date().getFullYear());
  const [filas, setFilas] = useState<CabCalendario[]>([]);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function cargar(): void {
    setOcupado(true);
    setError(null);
    api<{ calendarios: CabCalendario[] }>(servidor, token, `calendarios/basicos?idConductor=${conductor.id}&año=${año}`)
      .then((r) => {
        setFilas(r.calendarios);
        setSeleccion(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(cargar, [servidor, token, conductor.id, año]);

  return (
    <div className="pagina paginaCalendariosO2">
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver}>← Volver</button>
        {ocupado ? <span className="cargando">Cargando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
        <button className="boton" onClick={cargar} disabled={ocupado}>↺ Descartar Cambios</button>
      </div>
      <div className="marcoCalendarios">
        <div className="bandaTitulo">
          CALENDARIOS DE {conductor.matricula} - {conductor.nombre} {conductor.apellidos}
        </div>
        <div className="barraMes">
          <button className="botonFlecha" onClick={() => setAño((a) => a - 1)} disabled={ocupado} aria-label="Año anterior">←</button>
          <h2 className="tituloMes">{año}</h2>
          <button className="botonFlecha" onClick={() => setAño((a) => a + 1)} disabled={ocupado} aria-label="Año siguiente">→</button>
          <button
            className="boton"
            onClick={() => seleccion !== null && onDetalle(seleccion)}
            disabled={seleccion === null || ocupado}
          >
            📋 Detalle
          </button>
        </div>
        <RejillaCalendarios
          filas={filas}
          seleccion={seleccion}
          onSeleccion={setSeleccion}
          onDetalle={onDetalle}
        />
      </div>
      <p className="barraEstado">
        Calendarios: {filas.length}
        {seleccion !== null ? ` · Mes de ${filas.find((f) => f.id === seleccion)?.fecha.slice(5, 7)}/${año} seleccionado` : ""}
        {" · Doble clic en un calendario para su detalle."}
      </p>
    </div>
  );
}
