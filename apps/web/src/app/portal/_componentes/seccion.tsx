/**
 * Marco de las pantallas de sección ("Calendario", "Pijama", …): barra de
 * contexto a todo el ancho con `matrícula: apellidos` (enlace a la portada) a
 * la izquierda y título de la sección en verde a la derecha, como en Orión 2.
 * La sesión se lee dentro de una frontera Suspense propia; el cascarón (barra
 * sin trabajador) se ve mientras llega.
 *
 * Uso: <Seccion titulo="Calendario" /> — no hace falta Suspense ajeno.
 */
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { conductores } from "@mercurio/db";
import { obtenerSesion } from "@/lib/sesion";
import { getDb } from "@/lib/bd";
import styles from "./orion.module.css";

export default function Seccion({ titulo, requiereAdmin, children }: {
  titulo: string;
  requiereAdmin?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className={styles.barra}>
        <span className={styles.barraTitulo}>{titulo}</span>
      </div>
    }>
      <Barra titulo={titulo} requiereAdmin={requiereAdmin ?? false}>
        {children}
      </Barra>
    </Suspense>
  );
}

async function Barra({ titulo, requiereAdmin, children }: {
  titulo: string;
  requiereAdmin: boolean;
  children?: React.ReactNode;
}) {
  const sesion = await obtenerSesion();
  if (sesion === null) redirect("/acceso");
  if (requiereAdmin && !sesion.esAdmin) redirect("/portal");

  let etiqueta = sesion.nombre;
  if (sesion.matricula > 0) {
    const [conductor] = await getDb()
      .select({ matricula: conductores.matricula, apellidos: conductores.apellidos })
      .from(conductores)
      .where(eq(conductores.matricula, sesion.matricula))
      .limit(1);
    if (conductor !== undefined) etiqueta = `${conductor.matricula}: ${conductor.apellidos}`;
  }

  return (
    <>
      <div className={styles.barra}>
        <Link href="/portal" className={styles.barraTrabajador} prefetch={false}>
          {etiqueta}
        </Link>
        <span className={styles.barraTitulo}>{titulo}</span>
      </div>
      <main className={styles.contenido}>{children}</main>
    </>
  );
}
