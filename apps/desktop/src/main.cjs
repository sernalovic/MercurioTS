// Proceso principal de Electron. Punto de entrada de la app de escritorio.
const { app, BrowserWindow } = require("electron");
const path = require("node:path");

function crearVentana() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Mercurio",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Con drainual, luego cargará la UI de administración (por ahora, una página local).
  win.removeMenu();
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(crearVentana);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
