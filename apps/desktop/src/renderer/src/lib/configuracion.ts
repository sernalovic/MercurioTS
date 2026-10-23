/**
 * Configuración del escritorio: la lee del puente de Electron
 * (`config.json` en userData) o de `localStorage` cuando la SPA corre
 * fuera de Electron (desarrollo en navegador).
 */

const CLAVE_LOCAL = "Mercurio.Config";
const SERVIDOR_DEFECTO = "https://mercurio-ts.vercel.app";

export interface Configuracion {
  Servidor: string;
  UsuarioUltimo: string;
  UltimoCentro: string;
  Token: string;
  Expira: number;
  /** Tamaños arrastrados de los separadores de paneles, por pantalla. */
  Medidas?: Record<string, number>;
}

export function configuracionPorDefecto(): Configuracion {
  return {
    Servidor: SERVIDOR_DEFECTO,
    UsuarioUltimo: "",
    UltimoCentro: "Bilbao",
    Token: "",
    Expira: 0,
  };
}

export async function leerConfig(): Promise<Configuracion> {
  if (window.mercurio) {
    const datos = (await window.mercurio.leerConfig()) as Partial<Configuracion>;
    return { ...configuracionPorDefecto(), ...datos };
  }
  const guardado = localStorage.getItem(CLAVE_LOCAL);
  if (!guardado) return configuracionPorDefecto();
  try {
    return { ...configuracionPorDefecto(), ...(JSON.parse(guardado) as Partial<Configuracion>) };
  } catch {
    return configuracionPorDefecto();
  }
}

export async function guardarConfig(configuracion: Configuracion): Promise<void> {
  if (window.mercurio) {
    await window.mercurio.guardarConfig({ ...configuracion });
    return;
  }
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(configuracion));
}
