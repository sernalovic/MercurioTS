import type { ReactNode } from "react";
/**
 * Menú principal: mosaico de tiles como `PrincipalView` del original.
 * `Usuarios` solo se muestra a los súper (igual que allí).
 */
import type { SesionInfo } from "../lib/api";
import type { NombrePantalla } from "../App";

const TILES: { destino: NombrePantalla; titulo: string }[] = [
  { destino: "conductores", titulo: "Conductores" },
  { destino: "graficos", titulo: "Gráficos" },
  { destino: "calendarios", titulo: "Calendarios" },
  { destino: "reclamaciones", titulo: "Reclamaciones" },
  { destino: "nominas", titulo: "Nóminas" },
  { destino: "convenios", titulo: "Convenios" },
  { destino: "lineas", titulo: "Líneas" },
  { destino: "informes", titulo: "Informes" },
  { destino: "herramientas", titulo: "Herramientas" },
];

export function PantallaMenu({ sesion, irA }: {
  sesion: SesionInfo;
  irA: (destino: NombrePantalla) => void;
}): ReactNode {
  return (
    <div className="menu">
      <div className="tiles">
        {TILES.map((t) => (
          <button key={t.destino} className="tile" onClick={() => irA(t.destino)}>
            {t.titulo}
          </button>
        ))}
        {sesion.esSuper ? (
          <button className="tile" onClick={() => irA("usuarios")}>Usuarios</button>
        ) : null}
      </div>
    </div>
  );
}
