/**
 * Descarga del programa de escritorio (pendiente): enlazará al instalador
 * Windows de Mercurio (Electron) cuando exista la primera versión.
 */
import type { Metadata } from "next";
import EnConstruccion from "../../_componentes/en-construccion";
import Seccion from "../../_componentes/seccion";

export const metadata: Metadata = {
  title: "Software Mercurio · Mercurio",
};

export default function Pagina() {
  return (
    <Seccion titulo="Software Mercurio" requiereAdmin>
      <EnConstruccion nota="La descarga del programa para Windows llega con la versión de escritorio." />
    </Seccion>
  );
}
