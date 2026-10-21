/**
 * Administración (port del menú de Orión 2): tarjetas para la gestión de
 * conductores, los logs del sistema y la descarga del programa de escritorio.
 * Solo para cuentas administradoras; sin barra de sección.
 */
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/bd";
import { obtenerSesion } from "@/lib/sesion";
import { conductorDeCesion } from "@/lib/trabajador";
import styles from "../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Administración · Mercurio",
};

export default function Pagina() {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>} >
      <MenuAdministracion />
    </Suspense>
  );
}

async function MenuAdministracion() {
  const db = getDb();
  const sesion = await obtenerSesion();
  if (sesion === null) redirect("/acceso");
  if (!sesion.esAdmin) redirect("/portal");
  const trabajador = await conductorDeCesion(db);

  return (
    <main className={styles.contenido}>
      {trabajador !== null && (
        <p className={styles.adminTrabajador}>
          {trabajador.conductor.matricula}: {trabajador.conductor.apellidos}
        </p>
      )}
      <h2 className={styles.adminTitulo}>Administración</h2>
      <div className={styles.centroFila}>
        <Link className={styles.botonAzul} href="/portal">
          Volver
        </Link>
      </div>

      <Link className={styles.adminTarjeta} href="/portal/administracion/conductores">
        <span className={styles.adminCabeceraAzul}>Conductores</span>
        <span className={styles.adminCuerpo}>
          Gestiona a los conductores de una manera visual.
        </span>
      </Link>

      <Link className={styles.adminTarjeta} href="/portal/administracion/logs">
        <span className={styles.adminCabeceraRoja}>Logs del sistema</span>
        <span className={styles.adminCuerpo}>
          Accede al archivo de logs del sistema para ver excepciones y códigos
          de error producidos en el servidor.
        </span>
      </Link>

      <Link className={styles.adminTarjeta} href="/portal/administracion/software">
        <span className={styles.adminCabeceraRoja}>Software Mercurio</span>
        <span className={styles.adminCuerpo}>
          Descarga el programa Mercurio para Windows.
        </span>
      </Link>
    </main>
  );
}
