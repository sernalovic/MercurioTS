import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { obtenerSesion } from "@/lib/sesion";
import FormularioAcceso from "./FormularioAcceso";
import styles from "./acceso.module.css";

export const metadata: Metadata = {
  title: "Acceso · Mercurio",
};

export default function Acceso() {
  // Con sesión abierta la pantalla de acceso manda al portal (como el
  // LoginPath del original). Verificación REAL, pero dentro de la frontera.
  return (
    <main className={styles.pantalla}>
      <Suspense fallback={<section className={styles.tarjeta} />}>
        <SesionAbierta />
      </Suspense>
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

async function SesionAbierta() {
  const sesion = await obtenerSesion();
  if (sesion !== null) redirect("/portal");
  return null;
}
