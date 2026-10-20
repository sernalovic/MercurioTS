import type { Metadata } from "next";
import FormularioAcceso from "./FormularioAcceso";
import styles from "./acceso.module.css";

export const metadata: Metadata = {
  title: "Acceso · Mercurio",
};

export default function Acceso() {
  return (
    <main className={styles.pantalla}>
      <section className={styles.tarjeta}>
        <div className={styles.cabecera}>
          <h1 className={styles.titulo}>Mercurio</h1>
          <p className={styles.subtitulo}>
            Portal de gráficos, nóminas y reclamaciones
          </p>
        </div>
        <FormularioAcceso />
      </section>
    </main>
  );
}
