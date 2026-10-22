/**
 * Declaración del puente expuesto por el preload (`window.mercurio`).
 * En desarrollo la SPA se puede abrir en un navegador normal: entonces
 * no existe el puente y la configuración se guarda en `localStorage` —
 * así las pantallas se prueban sin arrancar Electron.
 */

declare global {
  interface Window {
    mercurio?: {
      leerConfig(): Promise<unknown>;
      guardarConfig(configuracion: unknown): Promise<boolean>;
      guardarPdf(datos: ArrayBuffer, nombreDefecto: string): Promise<string | null>;
    };
  }
}

export {};
