/** Bloque común de las secciones todavía sin implementar. */
import Link from "next/link";
import styles from "./orion.module.css";

export default function EnConstruccion({ nota }: { nota?: string }) {
  return (
    <>
      <Link href="/portal" className={styles.botonAzul}>
        Volver
      </Link>
      <p className={styles.notaConstruccion}>
        {nota ?? "Esta pantalla todavía no está disponible: llega en la siguiente fase del portal."}
      </p>
    </>
  );
}
