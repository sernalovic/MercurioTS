/**
 * Reclamaciones (port de la pantalla "Reclamaciones" de Orión 2): lista por
 * año de las reclamaciones del trabajador con sus totales. Solo lectura; la
 * reclamación se abre en el detalle.
 */
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import {
  dietasTotales, estadoDe, horasTotales, importeDietas, importeTotal,
  reclamacionesDelAño,
} from "@/lib/reclamaciones";
import { MESES_NOMBRES, textoDecimal, textoEuros, textoHora } from "@/lib/situaciones";
import Seccion from "../_componentes/seccion";
import styles from "../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Reclamaciones · Mercurio",
};

export default function Pagina(props: PageProps<"/portal/reclamaciones">) {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>} >
      <ReclamacionesTrabajador searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ReclamacionesTrabajador({ searchParams }: { searchParams: PageProps<"/portal/reclamaciones">["searchParams"] }) {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");
  const { conductor } = trabajador;

  // Año mostrado: ?ano=2026.
  const params = await searchParams;
  const ano = numeroDeQuery(params.ano) ?? new Date().getFullYear();

  const lista = await reclamacionesDelAño(db, conductor.id, ano);
  const anterior = ano - 1;
  const siguiente = ano + 1;
  const url = (a: number) => `/portal/reclamaciones?ano=${a}`;

  return (
    <Seccion titulo="Reclamaciones">
      <section className={styles.cajaResumen}>
        <div className={styles.resumenCabecera}>
          <Link className={styles.flecha} href={url(anterior)} prefetch={false} aria-label="Año anterior">
            «
          </Link>
          <span className={styles.resumenTitulo}>Año {ano}</span>
          <Link className={styles.flecha} href={url(siguiente)} prefetch={false} aria-label="Año siguiente">
            »
          </Link>
        </div>
      </section>

      <div className={styles.volverZona}>
        <Link className={styles.botonAzul} href="/portal">
          Volver
        </Link>
      </div>

      {lista.map((r, indice) => {
        // Cebra verde/gris como el original; "En curso" lleva borde ámbar.
        const clases = [
          styles.tarjetaReclamacion,
          indice % 2 === 1 ? styles.tarjetaGris : "",
          estadoDe(r.fila).startsWith("En curso") ? styles.reclamacionEnCurso : "",
        ].filter(Boolean).join(" ");
        return (
          <Link
            key={r.fila.id}
            className={clases}
            href={`/portal/reclamaciones/${r.fila.id}`}
            prefetch={false}
          >
            <span className={styles.reclamacionCabecera}>
              <strong>
                {MESES_NOMBRES[Number(r.fila.fecha.slice(5, 7)) - 1].charAt(0).toUpperCase()
                  + MESES_NOMBRES[Number(r.fila.fecha.slice(5, 7)) - 1].slice(1)} - {r.fila.fecha.slice(0, 4)}
              </strong>
              <span>{estadoDe(r.fila)}</span>
            </span>
            <span className={styles.reclamacionCodigo}>
              Código de reclamación: <em>{r.fila.codigo}</em>
            </span>
            <span className={styles.reclamacionDatos}>
              <span>
                🕐 <em>{textoHora(horasTotales(r.conceptos))}</em>
              </span>
              <span>
                🍴 <em>
                  {textoDecimal(dietasTotales(r.conceptos))} ({textoEuros(importeDietas(r.conceptos))} €)
                </em>
              </span>
              <span>
                € <em>{textoEuros(importeTotal(r.conceptos))}</em>
              </span>
            </span>
          </Link>
        );
      })}

      <div className={styles.volverZona}>
        <Link className={styles.botonAzul} href="/portal">
          Volver
        </Link>
      </div>
    </Seccion>
  );
}

function numeroDeQuery(valor: string | string[] | undefined): number | null {
  if (valor === undefined || Array.isArray(valor)) return null;
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}
