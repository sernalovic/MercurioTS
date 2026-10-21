/**
 * Detalle del día del Pijama (port de "Detalle día Pijama" de Orión 2):
 * situación, gráfico y comité (comunes con el calendario) más las horas
 * acumuladas y las dietas (desayuno/comida/cena) tal y como aparecen en el
 * pijama. No se tocan turnos ni horarios.
 */
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { aMinutos, aNumero, type DiasCalendario } from "@mercurio/db";
import { Incidencia } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { diaConcreto } from "@/lib/calendario";
import {
  ETIQUETAS_CODIGOS, ETIQUETAS_SITUACIONES,
  MESES_NOMBRES, inicialSemana, textoDecimal, textoHora,
} from "@/lib/situaciones";
import { guardar } from "./actions";
import Seccion from "../../_componentes/seccion";
import styles from "../../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Detalle del día · Mercurio",
};

/** Vista lista para el formulario (minutos y decimales convertidos). */
interface VistaPijama {
  incidencia: number;
  codigo: number;
  numero: number;
  acumuladas: number | null; // minutos
  desayuno: number;
  comida: number;
  cena: number;
}

export default function Pagina(props: PageProps<"/portal/pijama/[dia]">) {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>}>
      <Detalle params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Detalle({
  params, searchParams,
}: {
  params: PageProps<"/portal/pijama/[dia]">["params"];
  searchParams: PageProps<"/portal/pijama/[dia]">["searchParams"];
}) {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");

  const crudos = await params;
  const consultas = await searchParams;
  const dia = Number(crudos.dia);
  const ano = numeroDeQuery(consultas.ano) ?? new Date().getFullYear();
  const mes = numeroDeQuery(consultas.mes) ?? new Date().getMonth() + 1;
  if (!Number.isInteger(dia) || dia < 1 || dia > 31 || mes < 1 || mes > 12) {
    redirect("/portal/pijama");
  }

  const encontrada = await diaConcreto(db, trabajador.conductor.id, ano, mes, dia);
  if (encontrada === null) redirect(`/portal/pijama?ano=${ano}&mes=${mes}`);
  const vista = vistaDeFila(encontrada.fila);

  const accion = guardar.bind(null, { ano, mes, dia });
  const fechaCorta = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const botones = (
    <div className={styles.accionesDetalle}>
      <Link className={styles.botonAzul} href={`/portal/pijama?ano=${ano}&mes=${mes}`}>
        Volver
      </Link>
      <button className={styles.botonVerde} type="submit">
        Guardar cambios
      </button>
    </div>
  );

  return (
    <Seccion titulo="Pijama">
      <form className={styles.zonaSinTarjeta} action={accion}>
        {botones}
        <h2 className={styles.detalleTitulo}>
          {String(dia).padStart(2, "0")} - {MESES_NOMBRES[mes - 1].toUpperCase()} - {ano} ({inicialSemana(fechaCorta)})
        </h2>
        <div className={styles.tarjetaFormulario}>
          <div className={styles.filaFormulario}>
            <label htmlFor="situacion">Situación</label>
            <select
              id="situacion"
              name="situacion"
              className={`${styles.control} ${styles.controlSelecto}`}
              defaultValue={String(vista.incidencia)}
            >
              {ETIQUETAS_SITUACIONES.map((s) => (
                <option key={s.valor} value={s.valor}>{s.etiqueta}</option>
              ))}
            </select>
          </div>
          <div className={styles.filaFormulario}>
            <label htmlFor="grafico">Gráfico</label>
            <input
              id="grafico"
              name="grafico"
              type="number"
              min={0}
              inputMode="numeric"
              className={`${styles.control} ${styles.controlCorto}`}
              defaultValue={vista.numero === 0 ? "" : vista.numero}
            />
          </div>
          <div className={styles.filaFormulario}>
            <label htmlFor="comite">Comité</label>
            <select
              id="comite"
              name="comite"
              className={`${styles.control} ${styles.controlSelecto}`}
              defaultValue={String(vista.codigo)}
            >
              {ETIQUETAS_CODIGOS.map((s) => (
                <option key={s.valor} value={s.valor}>{s.etiqueta}</option>
              ))}
            </select>
          </div>
        </div>

        <p className={styles.detalleAyuda}>
          Si cambias la situación o el gráfico, guarda los cambios sin rellenar el resto de datos.
        </p>

        <div className={styles.tarjetaFormulario}>
          <div className={styles.filaFormulario}>
            <label htmlFor="acumuladas">Horas acumuladas</label>
            <input
              id="acumuladas"
              name="acumuladas"
              type="time"
              className={`${styles.control} ${styles.controlCorto}`}
              defaultValue={vista.acumuladas === null ? "" : textoHora(vista.acumuladas)}
            />
          </div>
          <div className={styles.filaFormulario}>
            <label htmlFor="desayuno">Desayuno</label>
            <input
              id="desayuno"
              name="desayuno"
              type="text"
              inputMode="decimal"
              className={`${styles.control} ${styles.controlCorto}`}
              defaultValue={textoDecimal(vista.desayuno)}
            />
          </div>
          <div className={styles.filaFormulario}>
            <label htmlFor="comida">Comida</label>
            <input
              id="comida"
              name="comida"
              type="text"
              inputMode="decimal"
              className={`${styles.control} ${styles.controlCorto}`}
              defaultValue={textoDecimal(vista.comida)}
            />
          </div>
          <div className={styles.filaFormulario}>
            <label htmlFor="cena">Cena</label>
            <input
              id="cena"
              name="cena"
              type="text"
              inputMode="decimal"
              className={`${styles.control} ${styles.controlCorto}`}
              defaultValue={textoDecimal(vista.cena)}
            />
          </div>
        </div>

        <p className={styles.detalleAyuda}>
          Introduce las horas acumuladas y las dietas tal y como aparecen en el pijama, aunque estén mal.
        </p>
        {botones}
      </form>
    </Seccion>
  );
}

/** Convierte la fila del esquema en la vista del formulario del pijama. */
function vistaDeFila(fila: DiasCalendario | null): VistaPijama {
  if (fila === null) {
    return { incidencia: Incidencia.Trabajo, codigo: 0, numero: 0, acumuladas: null, desayuno: 0, comida: 0, cena: 0 };
  }
  // Se edita lo TRABAJADO; si está vacío, se parte de lo ANUAL (planificado).
  const usaAnual =
    fila.TrabajadoIncidencia === Incidencia.Inactivo && fila.AnualIncidencia !== Incidencia.Inactivo;
  return {
    incidencia: usaAnual ? fila.AnualIncidencia : fila.TrabajadoIncidencia,
    codigo: usaAnual ? fila.AnualCodigo : fila.TrabajadoCodigo,
    numero: usaAnual ? fila.AnualNumero : fila.TrabajadoNumero,
    acumuladas: fila.TrabajadoAcumuladas === null ? null : aMinutos(fila.TrabajadoAcumuladas),
    desayuno: aNumero(fila.TrabajadoDesayuno),
    comida: aNumero(fila.TrabajadoComida),
    cena: aNumero(fila.TrabajadoCena),
  };
}

function numeroDeQuery(valor: string | string[] | undefined): number | null {
  if (valor === undefined || Array.isArray(valor)) return null;
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}
