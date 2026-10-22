import type { ReactNode } from "react";
/**
 * Marcador de las pantallas aún no replicadas (migración fase a fase);
 * conserva el botón "Volver" del `PaginaViewModel` del original.
 */
import type { NombrePantalla } from "../App";

export function PantallaPendiente({ nombre, irA }: {
  nombre: NombrePantalla;
  irA: (destino: NombrePantalla) => void;
}): ReactNode {
  return (
    <div className="pagina">
      <div className="paginacampos">
        <h2 className="titulo">TODO: {nombre}</h2>
        <button className="boton" onClick={() => irA("menu")}>Volver</button>
      </div>
      <p className="pendiente">Esta pantalla todavía no está replicada: entra en las fases de la migración del escritorio.</p>
    </div>
  );
}
