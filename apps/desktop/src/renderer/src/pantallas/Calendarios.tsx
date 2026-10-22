/**
 * Pantalla Calendarios (mosaico del menú): rejilla mensual de todos los
 * calendarios del centro con las tres vistas (Trabajados/Anuales/
 * Virtuales) — port de `CalendariosViewModel`. El detalle del calendario
 * y las operaciones del mes (JDs, festivos, resúmenes, regenerar y
 * pegar) entran con las fases siguientes.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import { RejillaCalendarios, type CabCalendario } from "../componentes/RejillaCalendarios";

/** Mismos valores y orden que `CentroTrabajo` del dominio. */
const CENTROS = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];

const VISTAS: { etiqueta: string; tipo: string }[] = [
  { etiqueta: "Trabajados", tipo: "trabajados" },
  { etiqueta: "Anuales", tipo: "anuales" },
  { etiqueta: "Virtuales", tipo: "virtuales" },
];

export function PantallaCalendarios({ servidor, token, centro, mes, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  mes: string;
  onVolver: () => void;
}): ReactNode {
  const [vista, setVista] = useState(0);
  const [filas, setFilas] = useState<CabCalendario[]>([]);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function cargar(): void {
    setOcupado(true);
    setError(null);
    const filtro = new URLSearchParams({ fecha: mes });
    if (centro !== "Todos") filtro.set("centro", String(CENTROS.indexOf(centro)));
    filtro.set("tipo", VISTAS[vista].tipo);
    api<{ calendarios: CabCalendario[] }>(servidor, token, `calendarios/basicos?${filtro}`)
      .then((r) => {
        setFilas(r.calendarios);
        setSeleccion(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(cargar, [servidor, token, centro, mes, vista]);

  async function borrarCalendario(): Promise<void> {
    const fila = filas.find((f) => f.id === seleccion);
    if (fila === undefined) return;
    if (
      !window.confirm(
        `Vas a eliminar el calendario de la matrícula ${fila.matricula}.\n\n¿Quieres continuar?`,
      )
    ) {
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      await api(servidor, token, `calendarios/${fila.id}`, { metodo: "DELETE" });
      cargar();
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  const [año, mesNum] = [Number(mes.slice(0, 4)), Number(mes.slice(5, 7))];
  const fechaMes = new Date(año, mesNum - 1);

  return (
    <div className="pagina">
      <div className="cabeceraPagina">
        <h2 className="tituloPagina">Calendarios de {fechaMes.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</h2>
        {ocupado ? <span className="cargando">Cargando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
        <label className="etiquetaMini">Vista:</label>
        <select className="combo" value={String(vista)} onChange={(e) => setVista(Number(e.target.value))}>
          {VISTAS.map((v, i) => <option key={v.tipo} value={String(i)}>{v.etiqueta}</option>)}
        </select>
      </div>
      <div className="opcionesPagina">
        <span className="hueco" />
        <button className="boton" onClick={onVolver}>Volver</button>
        <button className="boton" onClick={() => cargar()} disabled={ocupado}>Recargar</button>
        <button className="boton" disabled title="Disponible con la fase de Detalle">Detalle</button>
        <button className="boton" disabled title="Disponible con la fase de pegado desde Excel">Añadir calendarios (pegar)</button>
        <button className="boton" onClick={borrarCalendario} disabled={seleccion === null || ocupado}>Borrar calendario</button>
        <button className="boton" disabled title="Disponible al portar las operaciones del mes">Ajustar JDs</button>
        <button className="boton" disabled title="Disponible al portar las operaciones del mes">Marcar festivos</button>
        <button className="boton" disabled title="Disponible al portar las operaciones del mes">Recalcular resúmenes</button>
        <button className="boton" disabled title="Disponible al portar las operaciones del mes">Regenerar todos</button>
      </div>
      <RejillaCalendarios filas={filas} seleccion={seleccion} onSeleccion={setSeleccion} />
      <p className="pendiente">Detalle del calendario y operaciones del mes: fases siguientes.</p>
    </div>
  );
}
