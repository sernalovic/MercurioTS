/**
 * Mercurio de escritorio: proceso principal.
 *
 * Ventana única (como la Shell WPF del original) + almacenamiento de la
 * configuración en `%APPDATA%\Mercurio\config.json` — mismo lugar que
 * usaba `Servicios\Api.cs\Configuracion` del original.
 */
import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "node:path";
import fs from "node:fs";

/** Mismo fichero y campos que la app WPF (`Servicios\Api.cs`). */
export interface Configuracion {
  Servidor: string;
  UsuarioUltimo: string;
  UltimoCentro: string;
  Token: string;
  Expira: number; // instante de expiración del token (ms Unix); 0 si no hay
}

export const SERVIDOR_DEFECTO = "https://mercurio-ts.vercel.app";

function ficheroConfig(): string {
  return path.join(app.getPath("userData"), "config.json");
}

function configuracionPorDefecto(): Configuracion {
  return {
    Servidor: SERVIDOR_DEFECTO,
    UsuarioUltimo: "",
    UltimoCentro: "Bilbao",
    Token: "",
    Expira: 0,
  };
}

let configuracion: Configuracion | undefined;

export function leerConfig(): Configuracion {
  if (configuracion !== undefined) return configuracion;
  try {
    const leido = JSON.parse(fs.readFileSync(ficheroConfig(), "utf8")) as Partial<Configuracion>;
    configuracion = { ...configuracionPorDefecto(), ...leido };
  } catch {
    configuracion = configuracionPorDefecto();
  }
  return configuracion;
}

export function guardarConfig(nueva: Configuracion): void {
  if (typeof nueva?.Servidor !== "string") {
    throw new Error("Configuración no válida");
  }
  configuracion = nueva;
  fs.writeFileSync(ficheroConfig(), JSON.stringify(nueva, null, 2), "utf8");
}

function crearVentana(): BrowserWindow {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: "Mercurio",
    backgroundColor: "#F4F5F7",
    autoHideMenuBar: true,
    icon: undefined,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Toda la app vive en la SPA: el menu propio de Electron solo estorba.
  Menu.setApplicationMenu(null);

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void ventana.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void ventana.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return ventana;
}

// El original forzaba el render por software por tarjetas gráficas
// problemáticas (`RenderOptions.SoftwareOnly`); mismo motivo aquí.
app.disableHardwareAcceleration();

ipcMain.handle("config:leer", () => leerConfig());
ipcMain.handle("config:guardar", (_evento, nueva: Configuracion) => {
  guardarConfig(nueva);
  return true;
});

app.whenReady().then(() => {
  crearVentana();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
