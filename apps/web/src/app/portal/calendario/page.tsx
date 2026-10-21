/**
 * Calendario del trabajador (port de la pantalla "Calendario" de Orión 2):
 * selector de mes, filas por día con la situación (Trabajo + gráfico y turno
 * con horas, descansos, días festivos…), vehículos, notas e insignias de
 * comité, y enlace al detalle de cada día.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { aMinutos, type DiasCalendario } from "@mercurio/db";
import { Incidencia, Turno, CodigoIncidencia } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { estadoDelMes } from "@/lib/calendario";
import {
  ETIQUETA_CODIGO, ETIQUETA_INCIDENCIA, ETIQUETA_TURNO, MESES_NOMBRES,
  inicialSemana, textoHora,
} from "@/lib/situaciones";
import Seccion from "../_componentes/seccion";
import styles from "../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Calendario · Mercurio",
};

export default function Pagina(props: PageProps<"/portal/calendario">) {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>}>
      <CalendarioTrabajador searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CalendarioTrabajador({ searchParams }: { searchParams: PageProps<"/portal/calendario">["searchParams"] }) {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");
  const { conductor } = trabajador;

  // Mes mostrado: ?ano=2026&mes=10 (port del selector con « »).
  const params = await searchParams;
  const hoy = new Date();
  const ano = numeroDeQuery(params.ano) ?? hoy.getFullYear();
  const mes = numeroDeQuery(params.mes) ?? hoy.getMonth() + 1;
  if (mes < 1 || mes > 12) redirect(`/portal/calendario?ano=${ano}&mes=${hoy.getMonth() + 1}`);

  const { dias } = await estadoDelMes(db, conductor.id, ano, mes);
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  const siguiente = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  const url = (p: { ano: number; mes: number }) => `/portal/calendario?ano=${p.ano}&mes=${p.mes}`;

  return (
    <Seccion titulo="Calendario">
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

      <div className={styles.volverZona}>
        <Link className={styles.botonAzul} href="/portal">
          Volver
        </Link>
      </div>

      <span className={`${styles.cinta} ${styles.cintaAzul}`}>
        Resumen del mes
      </span>
      <div className={styles.listaDias}>
        {dias.map((d) => (
          <FilaDia key={d.fecha} fecha={d.fecha} fila={d.fila} ano={ano} mes={mes} />
        ))}
      </div>
    </Seccion>
  );
}

/** Fila de un día del calendario (port de las filas de Orión 2). */
function FilaDia({ fecha, fila, ano, mes }: {
  fecha: string;
  fila: DiasCalendario | null;
  ano: number;
  mes: number;
}) {
  const dia = Number(fecha.slice(8, 10));
  const esSabado = inicialSemana(fecha) === "SÁB";
  const esDomingo = inicialSemana(fecha) === "DOM";

  // Lo que se enseña: lo TRABAJADO si se ha apuntado algo; si no, lo ANUAL.
  let incidencia: Incidencia | null = null;
  let numero = 0;
  let turno = 0;
  let inicio: string | null = null;
  let final: string | null = null;
  let codigo = 0;
  let vehiculos: string | null = null;
  let notas: string | null = null;
  let esFestivo = false;
  if (fila !== null) {
    esFestivo = fila.esFestivo;
    vehiculos = fila.vehiculos;
    notas = fila.notas;
    if (fila.TrabajadoIncidencia !== Incidencia.Inactivo) {
      incidencia = fila.TrabajadoIncidencia;
      numero = fila.TrabajadoNumero;
      turno = fila.TrabajadoTurno;
      codigo = fila.TrabajadoCodigo;
      inicio = fila.TrabajadoInicio === null ? null : textoHora(aMinutos(fila.TrabajadoInicio));
      final = fila.TrabajadoFinal === null ? null : textoHora(aMinutos(fila.TrabajadoFinal));
    } else if (fila.AnualIncidencia !== Incidencia.Inactivo) {
      incidencia = fila.AnualIncidencia;
      numero = fila.AnualNumero;
      turno = fila.AnualTurno;
      codigo = fila.AnualCodigo;
      inicio = fila.AnualInicio === null ? null : textoHora(aMinutos(fila.AnualInicio));
      final = fila.AnualFinal === null ? null : textoHora(aMinutos(fila.AnualFinal));
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
      href={`/portal/calendario/${dia}?ano=${ano}&mes=${mes}`}
      prefetch={false}
    >
      <span className={`${styles.diaNumero} ${esSabado ? styles.diaSabado : ""} ${esDomingo ? styles.diaDomingo : ""}`}>
        {String(dia).padStart(2, "0")}
      </span>
      <span className={styles.diaSemana}>{inicialSemana(fecha)}</span>
      <span className={styles.diaContenido}>
        {incidencia === null ? (
          <span className={styles.diaSinDatos}>Sin actualizar</span>
        ) : esTrabajo ? (
          <>
            <span className={styles.diaSituacion}>
              <span>Trabajo</span>
              {numero > 0 && <span>/ {numero} · {ETIQUETA_TURNO[turno as Turno]}</span>}
              {inicio !== null && final !== null && (
                <span className={styles.diaTextoHoras}>⏱ {inicio} - {final}</span>
              )}
            </span>
            <span className={styles.diaExtras}>
              {codigo !== 0 && <span className={styles.insigniaHS}>{ETIQUETA_CODIGO[codigo as CodigoIncidencia]}</span>}
              {vehiculos !== null && <span className={styles.vehiculos}>🚚 {vehiculos}</span>}
              {(fila?.refuerzos ?? 0) > 0 && <span>+{fila?.refuerzos}</span>}
              {notas !== null && <span className={styles.notasIcono} title={notas}>💬</span>}
            </span>
          </>
        ) : (
          <span className={styles.diaSituacion}>{ETIQUETA_INCIDENCIA[incidencia]}</span>
        )}
      </span>
    </Link>
  );
}

function numeroDeQuery(valor: string | string[] | undefined): number | null {
  if (valor === undefined || Array.isArray(valor)) return null;
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}
