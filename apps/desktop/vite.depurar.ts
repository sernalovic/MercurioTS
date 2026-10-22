import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Solo para depurar el renderer en un navegador normal, sin Electron. */
export default defineConfig({
  root: "src/renderer",
  plugins: [react()],
  server: { port: 5273, strictPort: true },
});
