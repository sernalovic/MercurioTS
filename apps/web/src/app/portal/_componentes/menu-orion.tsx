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
        <img src="/mercurio.ico" alt="Mercurio" className={styles.marcaIcono} />
        <span className={styles.marcaSistema}>Mercurio</span>
      </div>
      <button
        type="button"
        className={styles.hamburguesa}
        aria-label="Menú"
        aria-expanded={abierto}
        onClick={(e) => {
          // El botón está DENTRO del cajón: sin parar la burbuja, cerrar el
          // menú volvería a abrirlo en el mismo clic. Sin esto el cajón no
          // puede cerrarse nunca desde dentro (logout incluido).
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {/* El cajón queda SIEMPRE montado y se oculta con CSS, nunca se
          desmonta: al desmontarlo ({abierto && …}), el clic en «Cerrar
          sesión» retiraba el <form> del DOM antes de que el navegador
          disparara el submit, así que el server action nunca se ejecutaba
          (solo se cerraba el menú y seguías dentro). Oculto, el form sigue
          vivo y el envío funciona; al salir, redirect a /acceso. */}
      <nav
        className={styles.cajon}
        hidden={!abierto}
        onClick={() => setAbierto(false)}
      >
        {children}
      </nav>
    </header>
  );
}
