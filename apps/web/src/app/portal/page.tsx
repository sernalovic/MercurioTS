import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { obtenerSesion } from "@/lib/sesion";
import { cerrar } from "./actions";
import styles from "./portal.module.css";

export const metadata: Metadata = {
  title: "Portal · Mercurio",
};

export default function PaginaPortal() {
  // La sesión es un dato de petición: se lee dentro de la frontera
  // (cacheComponents exige Suspense para lo que no se puede prerrenderizar).
  return (
    <main className={styles.centro}>
      <Suspense fallback={<p className={styles.cargando}>Cargando…</p>}>
        <Sesion />
      </Suspense>
    </main>
  );
}

async function Sesion() {
  const sesion = await obtenerSesion();
  if (sesion === null) redirect("/acceso");

  const roles: string[] = [];
  if (sesion.esAdmin) roles.push("Administración");
  if (sesion.esSuper) roles.push("Super");

  return (
    <section className={styles.tarjeta}>
      <h1 className={styles.titulo}>Bienvenido, {sesion.nombre}</h1>
      <p className={styles.detalle}>Matrícula {sesion.matricula}</p>
      {roles.length > 0 && <p className={styles.detalle}>{roles.join(" · ")}</p>}
      <form className={styles.formulario} action={cerrar}>
        <button className={styles.boton} type="submit">
          Cerrar sesión
        </button>
      </form>
      <p className={styles.siguiente}>
        El calendario, la nómina y las reclamaciones llegan en las siguientes pantallas.
      </p>
    </section>
  );
}
