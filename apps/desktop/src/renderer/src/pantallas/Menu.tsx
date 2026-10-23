import type { ReactNode } from "react";
/**
 * Menú principal al estilo de Orión 2: mosaico de tarjetas con icono y
 * rótulo, cabecera con el logo y el selector de centro, pie con la URL del
 * servidor y el botón de Usuarios (solo súper) abajo a la derecha.
 */
import type { SesionInfo } from "../lib/api";
import type { NombrePantalla } from "../App";
import iconoMercurio from "../assets/mercurio.ico";

const VERSION = "0.1.0";

const TILES: { destino: NombrePantalla; titulo: string; icono: string }[] = [
  { destino: "conductores", titulo: "Trabajadores", icono: "👥" },
  { destino: "graficos", titulo: "Gráficos", icono: "🛣️" },
  { destino: "calendarios", titulo: "Calendarios", icono: "📅" },
  { destino: "lineas", titulo: "Líneas", icono: "🚏" },
  { destino: "informes", titulo: "Informes", icono: "📄" },
  { destino: "nominas", titulo: "Nóminas", icono: "🧮" },
  { destino: "reclamaciones", titulo: "Reclamaciones", icono: "⚖️" },
  { destino: "convenios", titulo: "Convenios", icono: "🤝" },
  { destino: "herramientas", titulo: "Herramientas", icono: "🛠️" },
  { destino: "opciones", titulo: "Opciones", icono: "⚙️" },
];

export function PantallaMenu({ sesion, servidor, centro, onCentro, irA }: {
  sesion: SesionInfo;
  servidor: string;
  centro: string;
  onCentro: (centro: string) => void;
  irA: (destino: NombrePantalla) => void;
}): ReactNode {
  return (
    <div className="menuO2">
      <div className="cabeceraMenu">
        <span className="logoMenu"><img src={iconoMercurio} alt="" /> Mercurio <small>{VERSION}</small></span>
        <label className="centroMenu">
          Centro Actual:
          <select value={centro} onChange={(e) => onCentro(e.target.value)}>
            {["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mosaico">
        {TILES.map((t) => (
          <button key={t.destino} className="tarjetaTile" onClick={() => irA(t.destino)}>
            <span className="iconoTile">{t.icono}</span>
            <span className="rotuloTile">{t.titulo.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <div className="pieMenu">
        <span className="urlServidor">{servidor}</span>
        <span className="hueco" />
        {sesion.esSuper ? (
          <button className="botonUsuarios" onClick={() => irA("usuarios")}>🧑‍💼 Usuarios</button>
        ) : null}
      </div>
    </div>
  );
}
