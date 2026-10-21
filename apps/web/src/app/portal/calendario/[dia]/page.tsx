/**
 * Detalle del día (port de "Detalle día calendario" de Orión 2): situación,
 * gráfico, comité, turno, horas (con partido), paquetería, vehículos,
 * refuerzos, DND cobrado y notas. El formulario guarda el servicio
 * TRABAJADO vía Server Action; si la fila solo tiene lo ANUAL, parte de
 * esos valores.
 */
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { aCentimos, aMinutos, aNumero, type DiasCalendario } from "@mercurio/db";
import { Incidencia } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { diaConcreto } from "@/lib/calendario";
import {
  ETIQUETAS_CODIGOS, ETIQUETAS_SITUACIONES, ETIQUETAS_TURNOS,
  MESES_NOMBRES, inicialSemana, textoEuros, textoHora,
} from "@/lib/situaciones";
import { guardar } from "./actions";
import Seccion from "../../_componentes/seccion";
import styles from "../../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Detalle del día · Mercurio",
};

/** Vista lista para el formulario (tiempos en minutos, importes convertidos). */
interface VistaDia {
  incidencia: number;
  codigo: number;
  numero: number;
  turno: number;
  inicio: number | null;
  final: number | null;
  inicioPartido: number | null;
  finalPartido: number | null;
  facturadoPaqueteria: number; // céntimos
  limpieza: number; // unidades
  vehiculos: string;
  refuerzos: number;
  dndCobrado: boolean;
  notas: string;
}

export default function Pagina(props: PageProps<"/portal/calendario/[dia]">) {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>}>
      <Detalle params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Detalle({
  params, searchParams,
}: {
  params: PageProps<"/portal/calendario/[dia]">["params"];
  searchParams: PageProps<"/portal/calendario/[dia]">["searchParams"];
}) {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");

  // Parámetros de la ruta (?)
  const crudos = await params;
  const consultas = await searchParams;
  const dia = Number(crudos.dia);
  const ano = numeroDeQuery(consultas.ano) ?? new Date().getFullYear();
  const mes = numeroDeQuery(consultas.mes) ?? new Date().getMonth() + 1;
  if (!Number.isInteger(dia) || dia < 1 || dia > 31 || mes < 1 || mes > 12) {
    redirect("/portal/calendario");
  }

  const encontrada = await diaConcreto(db, trabajador.conductor.id, ano, mes, dia);
  if (encontrada === null) redirect(`/portal/calendario?ano=${ano}&mes=${mes}`);
  const vista = vistaDeFila(encontrada.fila);

  const accion = guardar.bind(null, { ano, mes, dia });
  const fechaCorta = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  return (
    <Seccion titulo="Detalle del día">
      <h2 className={styles.detalleTitulo}>
        {String(dia).padStart(2, "0")} - {MESES_NOMBRES[mes - 1].toUpperCase()} - {ano} ({inicialSemana(fechaCorta)})
      </h2>
      <p className={styles.detalleAyuda}>
        Introduce los datos del día tal y como has trabajado. Si el día es un descanso
        (JD, DC, F6…), no hace falta poner gráfico ni horas.
      </p>
      <form className={styles.tarjetaFormulario} action={accion}>
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
        <div className={styles.filaFormulario}>
          <label htmlFor="turno">Turno</label>
          <select
            id="turno"
            name="turno"
            className={`${styles.control} ${styles.controlSelecto}`}
            defaultValue={String(vista.turno)}
          >
            {ETIQUETAS_TURNOS.map((s) => (
              <option key={s.valor} value={s.valor}>{s.etiqueta}</option>
            ))}
          </select>
        </div>
        <div className={styles.filaFormulario}>
          <label htmlFor="inicio">Horas</label>
          <div className={styles.filaParcial}>
            <span className={styles.campoHora}>
              <label htmlFor="inicio">Inicio</label>
              <input
                id="inicio"
                name="inicio"
                type="time"
                className={styles.control}
                defaultValue={vista.inicio === null ? "" : textoHora(vista.inicio)}
              />
            </span>
            <span className={styles.campoHora}>
              <label htmlFor="final">Final</label>
              <input
                id="final"
                name="final"
                type="time"
                className={styles.control}
                defaultValue={vista.final === null ? "" : textoHora(vista.final)}
              />
            </span>
          </div>
        </div>
        <div className={styles.filaFormulario}>
          <label htmlFor="inicioPartido">Partido</label>
          <div className={styles.filaParcial}>
            <span className={styles.campoHora}>
              <label htmlFor="inicioPartido">Inicio</label>
              <input
                id="inicioPartido"
                name="inicioPartido"
                type="time"
                className={styles.control}
                defaultValue={vista.inicioPartido === null ? "" : textoHora(vista.inicioPartido)}
              />
            </span>
            <span className={styles.campoHora}>
              <label htmlFor="finalPartido">Final</label>
              <input
                id="finalPartido"
                name="finalPartido"
                type="time"
                className={styles.control}
                defaultValue={vista.finalPartido === null ? "" : textoHora(vista.finalPartido)}
              />
            </span>
          </div>
        </div>
        <div className={styles.filaFormulario}>
          <label htmlFor="facturadoPaqueteria">Facturado paq.</label>
          <input
            id="facturadoPaqueteria"
            name="facturadoPaqueteria"
            type="number"
            step="0.01"
            className={`${styles.control} ${styles.controlCorto}`}
            defaultValue={textoEuros(vista.facturadoPaqueteria)}
          />
        </div>
        <div className={styles.filaFormulario}>
          <label htmlFor="limpiezas">Limpiezas</label>
          <input
            id="limpiezas"
            name="limpiezas"
            type="number"
            step="0.01"
            className={`${styles.control} ${styles.controlCorto}`}
            defaultValue={String(vista.limpieza)}
          />
        </div>
        <div className={styles.filaFormulario}>
          <label htmlFor="vehiculos">Vehículos</label>
          <input
            id="vehiculos"
            name="vehiculos"
            type="text"
            className={styles.control}
            defaultValue={vista.vehiculos}
            placeholder="424 404"
          />
        </div>
        <div className={styles.filaFormulario}>
          <label htmlFor="refuerzos">Refuerzos</label>
          <input
            id="refuerzos"
            name="refuerzos"
            type="number"
            min={0}
            inputMode="numeric"
            className={`${styles.control} ${styles.controlCorto}`}
            defaultValue={String(vista.refuerzos)}
          />
        </div>
        <div className={styles.filaFormulario}>
          <label htmlFor="dndCobrado">DND cobrado</label>
          <input
            id="dndCobrado"
            name="dndCobrado"
            type="checkbox"
            className={styles.controlCheck}
            defaultChecked={vista.dndCobrado}
          />
        </div>
        <div className={styles.filaFormulario}>
          <label htmlFor="notas">Notas</label>
          <textarea
            id="notas"
            name="notas"
            className={`${styles.control} ${styles.areaNotas}`}
            defaultValue={vista.notas}
          />
        </div>
        <div className={styles.accionesDetalle}>
          <Link className={styles.botonAzul} href={`/portal/calendario?ano=${ano}&mes=${mes}`}>
            Volver
          </Link>
          <button className={styles.botonVerde} type="submit">
            Guardar cambios
          </button>
        </div>
      </form>
    </Seccion>
  );
}

/** Convierte la fila del esquema (interval/numeric como cadenas) en vista. */
function vistaDeFila(fila: DiasCalendario | null): VistaDia {
  if (fila === null) {
    // Día sin apuntar: Trabajo en blanco por defecto.
    return {
      incidencia: Incidencia.Trabajo, codigo: 0, numero: 0, turno: 0,
      inicio: null, final: null, inicioPartido: null, finalPartido: null,
      facturadoPaqueteria: 0, limpieza: 0, vehiculos: "", refuerzos: 0,
      dndCobrado: false, notas: "",
    };
  }
  // Se edita lo TRABAJADO; si está vacío, se parte de lo ANUAL (planificado).
  const usaAnual =
    fila.TrabajadoIncidencia === Incidencia.Inactivo && fila.AnualIncidencia !== Incidencia.Inactivo;
  return {
    incidencia: usaAnual ? fila.AnualIncidencia : fila.TrabajadoIncidencia,
    codigo: usaAnual ? fila.AnualCodigo : fila.TrabajadoCodigo,
    numero: usaAnual ? fila.AnualNumero : fila.TrabajadoNumero,
    turno: usaAnual ? fila.AnualTurno : fila.TrabajadoTurno,
    inicio: aMinutosDeQuery(usaAnual ? fila.AnualInicio : fila.TrabajadoInicio),
    final: aMinutosDeQuery(usaAnual ? fila.AnualFinal : fila.TrabajadoFinal),
    inicioPartido: aMinutosDeQuery(usaAnual ? fila.AnualInicioPartido : fila.TrabajadoInicioPartido),
    finalPartido: aMinutosDeQuery(usaAnual ? fila.AnualFinalPartido : fila.TrabajadoFinalPartido),
    facturadoPaqueteria: aCentimos(fila.TrabajadoFacturadoPaqueteria),
    limpieza: aNumero(fila.TrabajadoLimpieza),
    vehiculos: fila.vehiculos ?? "",
    refuerzos: fila.refuerzos,
    dndCobrado: fila.dndCobrado,
    notas: fila.notas ?? "",
  };
}

/** "07:15:00" → minutos; null → null. */
function aMinutosDeQuery(intervalo: string | null): number | null {
  return intervalo === null ? null : aMinutos(intervalo);
}

function numeroDeQuery(valor: string | string[] | undefined): number | null {
  if (valor === undefined || Array.isArray(valor)) return null;
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}
