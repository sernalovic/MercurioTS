/**
 * Marco del portal portado de Orión 2: cabecera de marca con menú
 * hamburguesa y pie. El contenido del cajón (protege todo /portal y añade
 * Administración o la salida según los roles) llega servidor dentro de la
 * frontera Suspense; el resto de la cabecera es cascarón estático.
 */
import { Suspense } from "react";
import MenuOrion from "./_componentes/menu-orion";
import { ContenidoMenu } from "./_componentes/contenido-menu";
import styles from "./_componentes/orion.module.css";

export default function LayoutPortal(props: LayoutProps<"/portal">) {
  return (
    <>
      <MenuOrion>
        <Suspense fallback={<p className={styles.menuAviso}>…</p>}>
          <ContenidoMenu />
        </Suspense>
      </MenuOrion>
      {props.children}
      <footer className={styles.pie}>
        © 2026 - Mercurio - <a href="/privacidad">Privacidad</a>
      </footer>
    </>
  );
}
