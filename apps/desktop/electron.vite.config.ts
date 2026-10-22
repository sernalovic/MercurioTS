import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

/**
 * electron-vite construye tres partes:
 * - `main`: proceso principal (Node de Electron).
 * - `preload`: puente aislado entre procesos (`contextBridge`).
 * - `renderer`: SPA React con Vite (el resto de la app), CSS plano.
 */
export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: { plugins: [react()] },
});
