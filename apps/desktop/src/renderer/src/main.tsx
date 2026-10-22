/**
 * Punto de entrada de la SPA del escritorio.
 */
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./css/global.css";

const raiz = document.getElementById("raiz");
if (raiz) createRoot(raiz).render(<App />);
