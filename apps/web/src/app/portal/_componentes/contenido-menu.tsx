/**
 * Contenido del cajón del menú cuando hay sesión: protege el portal desde el
 * layout (sin sesión, manda a /acceso) y enlaza la administración solo con el
 * rol adecuado. Cada server action de cada página sigue validándose por su
 * cuenta.
 *
 * Uso: dentro de una frontera Suspense en `portal/layout.tsx`.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { cerrar } from "../actions";
import styles from "./orion.module.css";

export async function ContenidoMenu() {
  const sesion = await obtenerSesion();
  if (sesion === null) redirect("/acceso");

  return (
    <>
      <Link className={styles.menuEnlace} href="/portal/calendario">
        Calendario
      </Link>
      <Link className={styles.menuEnlace} href="/portal/pijama">
        Pijama
      </Link>
      <Link className={styles.menuEnlace} href="/portal/nomina">
        Importes en nómina
      </Link>
      <Link className={styles.menuEnlace} href="/portal/reclamaciones">
        Reclamaciones
      </Link>
      <Link className={styles.menuEnlace} href="/portal/calendario-anual">
        Calendario anual
      </Link>
      <Link className={styles.menuEnlace} href="/portal/datos">
        Datos de trabajador/a
      </Link>
      {sesion.esAdmin && (
        <Link className={styles.menuEnlace} href="/portal/administracion">
          Administración
        </Link>
      )}
      <form className={styles.menuSalida} action={cerrar}>
        <button type="submit">Cerrar sesión</button>
      </form>
    </>
  );
}
