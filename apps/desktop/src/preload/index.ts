/**
 * Puente aislado entre el proceso principal y la SPA. La SPA solo ve
 * `window.mercurio` — nada de Node ni del proceso.
 */
import { contextBridge, ipcRenderer } from "electron/renderer";

contextBridge.exposeInMainWorld("mercurio", {
  /** Lee la configuración guardada (config.json). */
  leerConfig: (): Promise<unknown> => ipcRenderer.invoke("config:leer"),
  /** Guarda la configuración completa. */
  guardarConfig: (configuracion: unknown): Promise<boolean> =>
    ipcRenderer.invoke("config:guardar", configuracion),
  /** Diálogo de guardar PDF + escritura + apertura (Pdf.Reclamacion + Pdf.Abrir). */
  guardarPdf: (datos: ArrayBuffer, nombreDefecto: string): Promise<string | null> =>
    ipcRenderer.invoke("pdf:guardar", datos, nombreDefecto),
});
