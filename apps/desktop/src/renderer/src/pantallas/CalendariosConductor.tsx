/**
 * Calendarios de un conductor a lo largo de un año — port de
 * `CalendariosConductorViewModel`, la pantalla abierta por «Ver
 * calendarios» desde Conductores. El detalle de cada mes entra con la
 * fase de Detalle.
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

export function PantallaCalendariosConductor({ servidor, token, conductor, onVolver }: {
  servidor: string;
  token: string;
  conductor: ConductorContexto;
  onVolver: () => void;
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

  const titulo = `Calendarios de ${conductor.matricula} - ${conductor.nombre} ${conductor.apellidos}`;

  return (
    <div className="pagina">
      <div className="cabeceraPagina">
        <h2 className="tituloPagina">{titulo}</h2>
        {ocupado ? <span className="cargando">Cargando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
        <button className="boton" onClick={() => setAño((a) => a + 1)} disabled={ocupado}>Año siguiente ▶</button>
        <button className="boton" onClick={() => setAño((a) => a - 1)} disabled={ocupado}>◀ Año anterior</button>
      </div>
      <div className="opcionesPagina">
        <span className="hueco" />
        <button className="boton" onClick={onVolver}>Volver</button>
        <button className="boton" onClick={() => cargar()} disabled={ocupado}>Recargar</button>
        <button className="boton" disabled title="Disponible con la fase de Detalle">Detalle</button>
      </div>
      <RejillaCalendarios filas={filas} seleccion={seleccion} onSeleccion={setSeleccion} />
      <p className="pendiente">El detalle de cada calendario entra con la fase de Detalle.</p>
    </div>
  );
}
