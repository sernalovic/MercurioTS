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
  /** Ventana Opciones → General: no reutilizar la sesión al abrir. */
  PedirSesion: boolean;
  /** Ventana Opciones → General: abrir el PDF tras generarlo. */
  AbrirPdf: boolean;
  /** Ventana Opciones → Rutas: carpeta por defecto de los PDFs de informes. */
  CarpetaInformes: string;
  /** Ventana Opciones → Rutas: logotipo para informes y reclamaciones. */
  LogoRuta: string;
  /** Ventana Opciones → Rutas: marca de agua para las reclamaciones. */
  MarcaAguaRuta: string;
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
    PedirSesion: true,
    AbrirPdf: true,
    CarpetaInformes: "",
    LogoRuta: "",
    MarcaAguaRuta: "",
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
