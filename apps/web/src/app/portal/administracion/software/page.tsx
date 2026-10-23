/**
 * Descarga del programa de escritorio: enlaza al instalador Windows de
 * Mercurio (Electron) publicado como última release del repositorio. El
 * nombre del fichero es estable (`Mercurio-Setup.exe`, fijado en
 * `electron-builder.yml`), así que la URL «latest/download» siempre apunta
 * a la versión más reciente sin tocar código.
 */
import type { Metadata } from "next";
import Seccion from "../../_componentes/seccion";
import styles from "../../_componentes/orion.module.css";

/** Instalador de la última release (nombre de asset estable). */
const URL_DESCARGA =
  "https://github.com/sernalovic/MercurioTS/releases/latest/download/Mercurio-Setup.exe";

export const metadata: Metadata = {
  title: "Software Mercurio · Mercurio",
};

export default function Pagina() {
  return (
    <Seccion titulo="Software Mercurio" requiereAdmin>
      <div className={styles.descarga}>
        <p className={styles.descargaTexto}>Instala Mercurio en tu equipo Windows.</p>
        <p>
          <a className={styles.descargaBoton} href={URL_DESCARGA} download>
            Descargar Mercurio para Windows
          </a>
        </p>
        <p className={styles.descargaNota}>
          Instalador de 64 bits (≈110 MB). Se instala solo para tu usuario, sin
          necesidad de administrador.
        </p>
      </div>
    </Seccion>
  );
}
