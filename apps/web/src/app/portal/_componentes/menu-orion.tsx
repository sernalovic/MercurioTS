"use client";

/**
 * Cabecera de marca con menú hamburguesa, port de Orión 2. El contenido del
 * cajón (navegación, sección de administración y salir) llega servidor dentro
 * de una frontera Suspense del layout, como `children`.
 */
import { useState } from "react";
import styles from "./orion.module.css";

export default function MenuOrion({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <header className={styles.cabecera}>
      <div className={styles.marca}>
        <span className={styles.marcaUgt}>UGT FeSMC</span>
        <span className={styles.marcaSistema}>Mercurio</span>
      </div>
      <button
        type="button"
        className={styles.hamburguesa}
        aria-label="Menú"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {abierto && (
        <nav className={styles.cajon} onClick={() => setAbierto(false)}>
          {children}
        </nav>
      )}
    </header>
  );
}
