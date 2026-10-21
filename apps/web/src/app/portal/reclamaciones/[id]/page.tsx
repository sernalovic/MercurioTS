/**
 * Detalle de reclamación (port de "Detalle reclamación" de Orión 2): los
 * conceptos de la reclamación con Real / Pijama / Dif. Solo lectura.
 */
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TipoReclamacion } from "@mercurio/domain";
import { aMinutos } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import {
  reclamacionPorId, esUnidades, type ReclamacionConConceptos,
} from "@/lib/reclamaciones";
import { textoDecimal, textoEuros, textoHora } from "@/lib/situaciones";
import Seccion from "../../_componentes/seccion";
import styles from "../../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Reclamación · Mercurio",
};

export default function Pagina(props: PageProps<"/portal/reclamaciones/[id]">) {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>} >
      <Detalle params={props.params} />
    </Suspense>
  );
}

async function Detalle({ params }: { params: PageProps<"/portal/reclamaciones/[id]">["params"] }) {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");

  const crudos = await params;
  const id = Number(crudos.id);
  if (!Number.isInteger(id)) redirect("/portal/reclamaciones");

  const reclamacion = await reclamacionPorId(db, trabajador.conductor.id, id);
  if (reclamacion === null) redirect("/portal/reclamaciones");

  return (
    <Seccion titulo="Reclamación">
      <div className={styles.volverZona}>
        <Link className={styles.botonAzul} href="/portal/reclamaciones">
          Volver
        </Link>
      </div>

      <h2 className={styles.reclamacionTitular}>
        Código de reclamación: {reclamacion.fila.codigo}
      </h2>

      {reclamacion.conceptos.map((c, indice) => (
        <Concepto key={c.id} concepto={c} indice={indice} />
      ))}
    </Seccion>
  );
}

/** Tarjeta de un concepto con Real / Pijama / Dif. (cebra índice par/impar). */
function Concepto({ concepto: c, indice }: { concepto: ReclamacionConConceptos["conceptos"][number]; indice: number }) {
  const clases = [
    styles.tarjetaReclamacion,
    indice % 2 === 1 ? styles.tarjetaGris : "",
  ].filter(Boolean).join(" ");

  // La fila de cifras: horas (HH:MM) si las hay; si no, importes (unidades
  // de dietas/DCs/DNDs o euros del resto). En BD llegan strings (interval/numeric).
  const horasReales = aMinutos(c.horasReales);
  const horasCobradas = aMinutos(c.horasCobradas);
  const importeReal = Number(c.importeReal);
  const importeCobrado = Number(c.importeCobrado);
  const importeTotal = Number(c.importeTotal);
  const hayHoras = horasReales !== 0 || horasCobradas !== 0;
  const hayImportes = !hayHoras && (importeReal !== 0 || importeCobrado !== 0);

  const cifras = hayHoras ? (
    <span className={styles.conceptoCifras}>
      <span>Real: <em>{textoHora(horasReales)}</em></span>
      <span>Pijama: <em>{textoHora(horasCobradas)}</em></span>
      <span>Dif.: <em>{textoHora(horasReales - horasCobradas)}</em></span>
    </span>
  ) : hayImportes ? (
    <span className={styles.conceptoCifras}>
      <span>Real: <em>{cifraDe(c.tipo, importeReal)}</em></span>
      <span>Pijama: <em>{cifraDe(c.tipo, importeCobrado)}</em></span>
      <span>Dif.: <em>{cifraDe(c.tipo, importeReal - importeCobrado)}</em></span>
    </span>
  ) : null;

  return (
    <div className={clases}>
      <span className={styles.conceptoTitulo}>{c.descripcion}</span>
      {cifras}
      {(c.graficoTrabajado !== 0 || Math.round(importeTotal) !== 0) && (
        <span className={styles.conceptoCifras}>
          {c.graficoTrabajado !== 0 && <span>Gráfico: <em>{c.graficoTrabajado}</em></span>}
          {Math.round(importeTotal) !== 0 && (
            <span className={styles.conceptoImporte}>
              Importe reclamado: <em>{textoEuros(importeTotal)} €</em>
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/** Unidades (dietas 2 dec, DCs/DNDs 4 dec) o céntimos → euros según el tipo. */
function cifraDe(tipo: TipoReclamacion, valor: number): string {
  if (!esUnidades(tipo)) return textoEuros(valor);
  const decimales = tipo === TipoReclamacion.TotalDc || tipo === TipoReclamacion.TotalDnd ? 4 : 2;
  return textoDecimal(valor, decimales);
}
