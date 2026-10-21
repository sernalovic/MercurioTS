/**
 * Trabajadores (port de la pantalla de Orión 2): listado de conductores con
 * centro, matrícula, acumuladas, DCs/DNDs iniciales y plus de distancia, y
 * acciones de edición (lápiz) y borrado (papelera). Solo administración.
 */
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { aMinutos, conductores } from "@mercurio/db";
import { ETIQUETA_CENTRO, textoHora } from "@/lib/situaciones";
import { obtenerSesion } from "@/lib/sesion";
import { getDb } from "@/lib/bd";
import { borrar } from "./actions";
import styles from "../../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Trabajadores · Mercurio",
};

export default function Pagina(props: PageProps<"/portal/administracion/conductores">) {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>} >
      <Listado searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Listado({ searchParams }: { searchParams: PageProps<"/portal/administracion/conductores">["searchParams"] }) {
  const db = getDb();
  const sesion = await obtenerSesion();
  if (sesion === null) redirect("/acceso");
  if (!sesion.esAdmin) redirect("/portal");

  const params = await searchParams;
  const aviso = params.error === undefined
    ? null
    : params.error === "duplicada"
      ? "No se ha guardado: otra matrícula ya usa ese número."
      : "No se ha guardado: revisa los datos de la ficha.";

  const filas = await db.select({
    id: conductores.id,
    matricula: conductores.matricula,
    nombre: conductores.nombre,
    apellidos: conductores.apellidos,
    centro: conductores.centro,
    acumuladasIniciales: conductores.acumuladasIniciales,
    dcsIniciales: conductores.dcsIniciales,
    dndsIniciales: conductores.dndsIniciales,
    plusDistancia: conductores.plusDistancia,
  })
    .from(conductores)
    .orderBy(asc(conductores.matricula));

  return (
    <main className={styles.contenido}>
      {aviso !== null && <span className={`${styles.cinta} ${styles.cintaRoja}`}>{aviso}</span>}

      <div className={styles.trabajadoresCabecera}>
        <h2 className={styles.trabajadoresTitulo}>Trabajadores</h2>
        <div className={styles.trabajadoresBotones}>
          <Link className={styles.botonAzul} href="/portal/administracion">
            Volver
          </Link>
          <Link className={styles.botonCian} href="/portal/administracion/conductores/nuevo">
            + Nuevo
          </Link>
        </div>
      </div>
      <hr className={styles.separadorTrabajadores} />

      <table className={styles.tablaTrabajadores}>
        <thead>
          <tr>
            <th>Centro</th>
            <th className={styles.celdaNumero}>Matrícula</th>
            <th>Nombre</th>
            <th>Apellidos</th>
            <th className={styles.celdaNumero}>Acum.</th>
            <th className={styles.celdaNumero}>DCs</th>
            <th className={styles.celdaNumero}>DNDs</th>
            <th className={styles.celdaNumero}>P.Dist.</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id}>
              <td>{ETIQUETA_CENTRO[f.centro]}</td>
              <td className={styles.celdaNumero}>{f.matricula}</td>
              <td>{f.nombre}</td>
              <td>{f.apellidos}</td>
              <td className={styles.celdaNumero}>{textoHora(aMinutos(f.acumuladasIniciales))}</td>
              <td className={styles.celdaNumero}>{Number(f.dcsIniciales).toFixed(5)}</td>
              <td className={styles.celdaNumero}>{Number(f.dndsIniciales).toFixed(5)}</td>
              <td className={styles.celdaNumero}>{Number(f.plusDistancia).toFixed(2)}</td>
              <td>
                <span className={styles.accionesFila}>
                  <Link
                    className={styles.botonLapiz}
                    href={`/portal/administracion/conductores/${f.id}`}
                    aria-label={`Editar trabajador ${f.matricula}`}
                    prefetch={false}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z" />
                    </svg>
                  </Link>
                  <form action={borrar.bind(null, f.id)}>
                    <button className={styles.botonPapelera} type="submit" aria-label={`Borrar trabajador ${f.matricula}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z" />
                      </svg>
                    </button>
                  </form>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
