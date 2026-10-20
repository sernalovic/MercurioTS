import type { Metadata } from "next";
import EnConstruccion from "../_componentes/en-construccion";
import Seccion from "../_componentes/seccion";

export const metadata: Metadata = {
  title: "Administración · Mercurio",
};

export default function Pagina() {
  return (
    <Seccion titulo="Administración" requiereAdmin>
      <EnConstruccion nota="El panel de administración (conductores, logs del sistema y descarga de software) llega en las siguientes fases." />
    </Seccion>
  );
}
