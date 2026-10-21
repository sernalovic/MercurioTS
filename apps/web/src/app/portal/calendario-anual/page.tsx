/**
 * Calendario anual (port de la pantalla de Orión 2): la situación o el número
 * de gráfico ANUAL de cada día del mes, un campo por día. Es lo que la
 * empresa planifica; el guardado escribe el bloque Anual del mes.
 */
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { estadoDelMes } from "@/lib/calendario";
import { MESES_NOMBRES, codigoAnualDe } from "@/lib/situaciones";
import { guardar } from "./actions";
import Seccion from "../_componentes/seccion";
import styles from "../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Calendario anual · Mercurio",
};

export default function Pagina(props: PageProps<"/portal/calendario-anual">) {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>} >
      <AnualTrabajador searchParams={props.searchParams} />
    </Suspense>
  );
}

async function AnualTrabajador({ searchParams }: { searchParams: PageProps<"/portal/calendario-anual">["searchParams"] }) {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");
  const { conductor } = trabajador;

  // Mes mostrado: ?ano=2026&mes=10.
  const params = await searchParams;
  const hoy = new Date();
  const ano = numeroDeQuery(params.ano) ?? hoy.getFullYear();
  const mes = numeroDeQuery(params.mes) ?? hoy.getMonth() + 1;
  if (mes < 1 || mes > 12) redirect(`/portal/calendario-anual?ano=${ano}&mes=${hoy.getMonth() + 1}`);

  const { dias } = await estadoDelMes(db, conductor.id, ano, mes);
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  const siguiente = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  const url = (p: { ano: number; mes: number }) => `/portal/calendario-anual?ano=${p.ano}&mes=${p.mes}`;

  const accion = guardar.bind(null, { ano, mes });
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
    <Seccion titulo="Calendario anual">
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

      <form className={styles.zonaSinTarjeta} action={accion}>
        {botones}

        <p className={styles.detalleAyuda}>
          Introduce la situación o el número de gráfico de cada día de tu{" "}
          <strong>calendario anual</strong>. Si tienes dudas de como introducir
          la situación, consulta la{" "}
          <span className={styles.ayudaEnlace} title="Página de ayuda pendiente">AYUDA</span>
        </p>

        {dias.map((d) => {
          const dia = Number(d.fecha.slice(8, 10));
          const valor = d.fila === null ? "" : codigoAnualDe(d.fila.AnualIncidencia, d.fila.AnualNumero);
          return (
            <div className={styles.filaImporte} key={d.fecha}>
              <label htmlFor={`d${dia}`}>Día {String(dia).padStart(2, "0")}</label>
              <input
                id={`d${dia}`}
                name={`d${String(dia).padStart(2, "0")}`}
                type="text"
                autoCapitalize="characters"
                defaultValue={valor}
              />
            </div>
          );
        })}

        {botones}
      </form>
    </Seccion>
  );
}

function numeroDeQuery(valor: string | string[] | undefined): number | null {
  if (valor === undefined || Array.isArray(valor)) return null;
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}
