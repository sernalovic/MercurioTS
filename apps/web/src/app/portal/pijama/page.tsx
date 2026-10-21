/**
 * Pijama del trabajador (port de la pantalla "Pijama" de Orión 2): igual
 * estructura que el calendario mensual pero mostrando las HORAS ACUMULADAS
 * (👥) y las CENAS (🌙) de cada día, más las tarjetas de DCs y DNDs
 * pendientes. El detalle de cada día edita acumuladas y dietas.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { aMinutos, type DiasCalendario } from "@mercurio/db";
import { Incidencia, Turno } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { estadoDelMes } from "@/lib/calendario";
import {
  ETIQUETA_INCIDENCIA, ETIQUETA_TURNO, MESES_NOMBRES, inicialSemana, textoDecimal, textoHora,
} from "@/lib/situaciones";
import { guardarDcsYDndsAction } from "./actions";
import Seccion from "../_componentes/seccion";
import styles from "../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Pijama · Mercurio",
};

export default function Pagina(props: PageProps<"/portal/pijama">) {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>}>
      <PijamaTrabajador searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PijamaTrabajador({ searchParams }: { searchParams: PageProps<"/portal/pijama">["searchParams"] }) {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");
  const { conductor } = trabajador;

  // Mes mostrado: ?ano=2026&mes=10.
  const params = await searchParams;
  const hoy = new Date();
  const ano = numeroDeQuery(params.ano) ?? hoy.getFullYear();
  const mes = numeroDeQuery(params.mes) ?? hoy.getMonth() + 1;
  if (mes < 1 || mes > 12) redirect(`/portal/pijama?ano=${ano}&mes=${hoy.getMonth() + 1}`);

  const { calendario, dias } = await estadoDelMes(db, conductor.id, ano, mes);
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  const siguiente = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  const url = (p: { ano: number; mes: number }) => `/portal/pijama?ano=${p.ano}&mes=${p.mes}`;

  return (
    <Seccion titulo="Pijama">
      <section className={styles.cajaResumen}>
        <div className={styles.resumenCabecera}>
          <Link className={styles.flecha} href={url(anterior)} prefetch={false} aria-label="Mes anterior">
            «
          </Link>
          <span className={styles.resumenTitulo}>
            {MESES_NOMBRES[mes - 1].toUpperCase()}-{ano}
          </span>
          <Link className={styles.flecha} href={url(siguiente)} prefetch={false} aria-label="Mes siguiente">
            »
          </Link>
        </div>
      </section>

      <BarraGuardar ano={ano} mes={mes} />

      {/* Pendientes del mes (columnas TotalDcsPendientes / TotalDndsPendientes). */}
      <div className={styles.tarjetaDato}>
        <span>DCs pendientes</span>
        <strong>{textoDecimal(Number(calendario?.totalDcsPendientes ?? 0), 4)}</strong>
      </div>
      <div className={styles.tarjetaDato}>
        <span>DNDs pendientes</span>
        <strong>{textoDecimal(Number(calendario?.totalDndsPendientes ?? 0), 4)}</strong>
      </div>

      <span className={`${styles.cinta} ${styles.cintaAzul}`}>
        Resumen del mes
      </span>
      <div className={styles.listaDias}>
        {dias.map((d) => (
          <FilaDia key={d.fecha} fecha={d.fecha} fila={d.fila} ano={ano} mes={mes} />
        ))}
      </div>

      <BarraGuardar ano={ano} mes={mes} />
    </Seccion>
  );
}

/** Barra "Volver" + "Guardar DCs y DNDs" (arriba y abajo, como en Orión 2). */
function BarraGuardar({ ano, mes }: { ano: number; mes: number }) {
  const accion = guardarDcsYDndsAction.bind(null, { ano, mes });
  return (
    <form className={styles.volverZona} action={accion}>
      <Link className={styles.botonAzul} href="/portal">
        Volver
      </Link>
      <button className={styles.botonVerde} type="submit">
        Guardar DCs y DNDs
      </button>
    </form>
  );
}

/** Fila de un día del pijama: situación + acumuladas (👥) y cena (🌙). */
function FilaDia({ fecha, fila, ano, mes }: {
  fecha: string;
  fila: DiasCalendario | null;
  ano: number;
  mes: number;
}) {
  const dia = Number(fecha.slice(8, 10));
  const abreviatura = inicialSemana(fecha);
  const esSabado = abreviatura === "SÁB";
  const esDomingo = abreviatura === "DOM";

  // Igual que el calendario: lo TRABAJADO si hay; si no, lo ANUAL.
  let incidencia: Incidencia | null = null;
  let numero = 0;
  let turno = 0;
  let acumuladas: number | null = null;
  let cena = 0;
  let esFestivo = false;
  if (fila !== null) {
    esFestivo = fila.esFestivo;
    acumuladas = fila.TrabajadoAcumuladas === null ? null : aMinutos(fila.TrabajadoAcumuladas);
    cena = Number(fila.TrabajadoCena);
    if (fila.TrabajadoIncidencia !== Incidencia.Inactivo) {
      incidencia = fila.TrabajadoIncidencia;
      numero = fila.TrabajadoNumero;
      turno = fila.TrabajadoTurno;
    } else if (fila.AnualIncidencia !== Incidencia.Inactivo) {
      incidencia = fila.AnualIncidencia;
      numero = fila.AnualNumero;
      turno = fila.AnualTurno;
    }
  }

  const esTrabajo = incidencia === Incidencia.Trabajo || incidencia === Incidencia.TrabajoJD || incidencia === Incidencia.TrabajoFN;
  const esDescansoLargo = incidencia === Incidencia.JD || incidencia === Incidencia.FN;
  const clasesDeFila = [
    styles.filaDia,
    esDescansoLargo ? styles.diaDescanso : "",
    esFestivo ? styles.diaFestivo : "",
  ].filter(Boolean).join(" ");

  return (
    <Link
      className={clasesDeFila}
      href={`/portal/pijama/${dia}?ano=${ano}&mes=${mes}`}
      prefetch={false}
    >
      <span className={`${styles.diaNumero} ${esSabado ? styles.diaSabado : ""} ${esDomingo ? styles.diaDomingo : ""}`}>
        {String(dia).padStart(2, "0")}
      </span>
      <span className={styles.diaSemana}>{abreviatura}</span>
      <span className={`${styles.diaContenidoPijama}`}>
        {incidencia === null ? (
          <span className={styles.diaSinDatos}>Sin actualizar</span>
        ) : esTrabajo ? (
          <span className={styles.diaSituacion}>
            <span>Trabajo</span>
            {numero > 0 && <span>/ {numero} · {ETIQUETA_TURNO[turno as Turno]}</span>}
          </span>
        ) : (
          <span className={styles.diaSituacion}>{ETIQUETA_INCIDENCIA[incidencia]}</span>
        )}
        <span className={styles.diaPijamaDatos}>
          {acumuladas !== null && acumuladas > 0 && <span>👥 {textoHora(acumuladas)}</span>}
          {cena > 0 && <span>🌙 {textoDecimal(cena)}</span>}
        </span>
      </span>
    </Link>
  );
}

function numeroDeQuery(valor: string | string[] | undefined): number | null {
  if (valor === undefined || Array.isArray(valor)) return null;
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}
