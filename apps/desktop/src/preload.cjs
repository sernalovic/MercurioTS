// Puente seguro entre el renderer y el proceso principal.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("mercurio", {
  version: process.env.npm_package_version ?? "0.1.0",
});
