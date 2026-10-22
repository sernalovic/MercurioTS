import type { ReactNode } from "react";
/**
 * Barra superior persistente del shell: logotipo, estado de la sesión
 * y los dos selectores compartidos (centro de trabajo y mes) que
 * recargaban cada pantalla al cambiar — el corazón de la Shell del
 * `MainWindow` original.
 */
import type { SesionInfo } from "../lib/api";

const CENTROS = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function formatearMes(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  return `${MESES[numero - 1]} de ${anio}`;
}

export function Barra({ sesion, expira, centro, mes, onCentro, onMes, onCerrar }: {
  sesion: SesionInfo;
  expira: number;
  centro: string;
  mes: string;
  onCentro: (centro: string) => void;
  onMes: (mes: string) => void;
  onCerrar: () => void;
}): ReactNode {
  const mover = (meses: number): void => {
    const [anio, numero] = mes.split("-").map(Number);
    const fecha = new Date(Date.UTC(anio, numero - 1 + meses, 1));
    onMes(`${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  // El original mostraba "sesión válida hasta las 0h del {expira-1d}":
  // el token vale hasta la medianoche del día anterior a su caducidad.
  const fecha = new Date(expira - 24 * 60 * 60 * 1000);
  const dia = fecha.toLocaleDateString("es-ES", { timeZone: "UTC" });

  const cerrar = (): void => {
    if (window.confirm("¿Cerrar la sesión?")) onCerrar();
  };

  return (
    <header className="barra">
      <span className="logotipo-chico">MERCURIO</span>

      <span className="etiquetabarra">Centro:</span>
      <select className="combo" value={centro} onChange={(e) => onCentro(e.target.value)}>
        {CENTROS.map((c) => <option key={c}>{c}</option>)}
      </select>

      <button className="botonflecha" onClick={() => mover(-1)} aria-label="Mes anterior">◀</button>
      <span className="mes">{formatearMes(mes)}</span>
      <button className="botonflecha" onClick={() => mover(1)} aria-label="Mes siguiente">▶</button>

      <span className="sesion">
        Usuario: <strong>{sesion.nombre}</strong>
        {" · "}
        sesión válida hasta las 0h del <strong>{dia}</strong>
      </span>
      <button className="botonsalir" onClick={cerrar}>Cerrar sesión</button>
    </header>
  );
}
