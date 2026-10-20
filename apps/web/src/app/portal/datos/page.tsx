import type { Metadata } from "next";
import EnConstruccion from "../_componentes/en-construccion";
import Seccion from "../_componentes/seccion";

export const metadata: Metadata = {
  title: "Datos del trabajador · Mercurio",
};

export default function Pagina() {
  return <Seccion titulo="Datos de trabajador/a"><EnConstruccion /></Seccion>;
}
