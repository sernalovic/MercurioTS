/**
 * Logs del sistema: pantalla placeholder del menú de administración (el
 * original no la implementa). De momento solo informa de que no hay ficheros.
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
      <EnConstruccion nota="De momento no hay ficheros de log disponibles." />
    </Seccion>
  );
}
