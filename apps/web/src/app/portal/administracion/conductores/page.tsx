/**
 * Gestión de conductores (pendiente): la pantalla visual de Orión 2
 * ("Gestiona a los conductores de una manera visual") llega en la siguiente
 * fase; de momento el enlace del menú de Administración muestra esto.
 */
import type { Metadata } from "next";
import EnConstruccion from "../../_componentes/en-construccion";
import Seccion from "../../_componentes/seccion";

export const metadata: Metadata = {
  title: "Conductores · Mercurio",
};

export default function Pagina() {
  return (
    <Seccion titulo="Conductores" requiereAdmin>
      <EnConstruccion nota="La gestión visual de conductores llega en las siguientes fases." />
    </Seccion>
  );
}
