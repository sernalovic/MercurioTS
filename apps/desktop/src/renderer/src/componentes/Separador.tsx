/**
 * Separadores móviles entre paneles (port de los `GridSplitter` del
 * original): arrastrar con el ratón ajusta el ancho (SeparadorV) o el
 * alto (SeparadorH) del panel colindante, que la pantalla guarda en su
 * estado. Según `lado` se controla el panel anterior (izquierda/arriba,
 * por defecto) o el posterior (derecha/abajo), y el controlado pasa a
 * tamaño fijo (px); el otro absorbe el resto (flex: 1).
 */
import type ReactNode from "react";

/** Separador vertical: ajusta el ancho del panel a un lado. */
export function SeparadorV({ ancho, onAncho, min = 100, max = 1400, lado = "izq" }: {
  ancho: number;
  onAncho: (valor: number) => void;
  min?: number;
  max?: number;
  /** Panel controlado: anterior (izquierda) o posterior (derecha). */
  lado?: "izq" | "der";
}): ReactNode {
  function abajo(e: React.MouseEvent<HTMLDivElement>): void {
    e.preventDefault();
    const x0 = e.clientX;
    const v0 = ancho;
    const mover = (ev: MouseEvent): void => {
      const delta = ev.clientX - x0;
      const nuevo = lado === "izq" ? v0 + delta : v0 - delta;
      onAncho(Math.min(max, Math.max(min, nuevo)));
    };
    const soltar = (): void => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      document.body.classList.remove("arrastrando");
    };
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    document.body.classList.add("arrastrando");
  }
  return <div className="separadorV" onMouseDown={abajo} role="separator" aria-orientation="vertical" />;
}

/** Separador horizontal: ajusta el alto del panel a un lado. */
export function SeparadorH({ alto, onAlto, min = 60, max = 1000, lado = "sup" }: {
  alto: number;
  onAlto: (valor: number) => void;
  min?: number;
  max?: number;
  /** Panel controlado: anterior (encima) o posterior (debajo). */
  lado?: "sup" | "inf";
}): ReactNode {
  function abajo(e: React.MouseEvent<HTMLDivElement>): void {
    e.preventDefault();
    const y0 = e.clientY;
    const v0 = alto;
    const mover = (ev: MouseEvent): void => {
      const delta = ev.clientY - y0;
      const nuevo = lado === "sup" ? v0 + delta : v0 - delta;
      onAlto(Math.min(max, Math.max(min, nuevo)));
    };
    const soltar = (): void => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      document.body.classList.remove("arrastrando");
    };
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
    document.body.classList.add("arrastrando");
  }
  return <div className="separadorH" onMouseDown={abajo} role="separator" aria-orientation="horizontal" />;
}
