/**
 * Datos de trabajador/a (port de la pantalla de Orión 2): ficha del
 * conductor con nombre, apellidos, email, teléfono, fecha de antigüedad y
 * porcentaje de IRPF. Sin barra de sección: el título incluye la matrícula.
 */
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { aNumero } from "@mercurio/db";
import { obtenerSesion } from "@/lib/sesion";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { textoDecimal } from "@/lib/situaciones";
import { guardar } from "./actions";
import styles from "../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Datos de trabajador/a · Mercurio",
};

export default function Pagina() {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>} >
      <FichaTrabajador />
    </Suspense>
  );
}

async function FichaTrabajador() {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) {
    const sesion = await obtenerSesion();
    redirect(sesion === null ? "/acceso" : "/portal"); // administrador sin matrícula
  }
  const c = trabajador.conductor;

  const botones = (
    <div className={styles.volverZona}>
      <Link className={styles.botonAzul} href="/portal">
        Volver
      </Link>
      <button className={styles.botonVerde} type="submit">
        Guardar cambios
      </button>
    </div>
  );

  return (
    <main className={styles.contenido}>
      <h2 className={styles.datosTitulo}>
        Datos de trabajador/a: <span className={styles.datosMatricula}>{c.matricula}</span>
      </h2>

      <form action={guardar}>
        {botones}

        <div className={styles.filaDato}>
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" type="text" defaultValue={c.nombre} />
        </div>
        <div className={styles.filaDato}>
          <label htmlFor="apellidos">Apellidos</label>
          <input id="apellidos" name="apellidos" type="text" defaultValue={c.apellidos} />
        </div>
        <div className={styles.filaDato}>
          <label htmlFor="email">E-Mail</label>
          <input id="email" name="email" type="email" defaultValue={c.email ?? ""} />
        </div>
        <p className={styles.notaAtencion}>
          <strong>ATENCIÓN:</strong> <em>Cambiar este email NO cambia el email del usuario.</em>
        </p>
        <div className={styles.filaDato}>
          <label htmlFor="telefono">Teléfono</label>
          <input id="telefono" name="telefono" type="tel" defaultValue={c.telefono ?? ""} />
        </div>
        <div className={styles.filaDato}>
          <label htmlFor="fechaAntiguedad">Fecha antigüedad</label>
          <input
            id="fechaAntiguedad"
            name="fechaAntiguedad"
            type="date"
            defaultValue={c.fechaAntiguedad.slice(0, 10)}
          />
        </div>
        <div className={styles.filaDato}>
          <label htmlFor="porcentajeIrpf">Porcentaje I.R.P.F.</label>
          <input
            id="porcentajeIrpf"
            name="porcentajeIrpf"
            type="text"
            inputMode="decimal"
            defaultValue={textoDecimal(aNumero(c.porcentajeIrpf))}
          />
        </div>

        {botones}
      </form>
    </main>
  );
}
