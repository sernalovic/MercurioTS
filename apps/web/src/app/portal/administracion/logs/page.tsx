/**
 * Logs del sistema (pendiente): el archivo de excepciones y códigos de error
 * del servidor se publicará junto con el registro de actividad.
 */
import type { Metadata } from "next";
import EnConstruccion from "../../_componentes/en-construccion";
import Seccion from "../../_componentes/seccion";

export const metadata: Metadata = {
  title: "Logs del sistema · Mercurio",
};

export default function Pagina() {
  return (
    <Seccion titulo="Logs del sistema" requiereAdmin>
      <EnConstruccion nota="El archivo de logs del servidor llega en las siguientes fases." />
    </Seccion>
  );
}
