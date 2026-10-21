/**
 * Editar trabajador (port de la ficha de Orión 2): campos apilados con la
 * matrícula, centro, categoría, situación, datos personales, acumuladas,
 * DCs/DNDs, plus de distancia, reducción de jornada y notas. La ruta
 * `/portal/administracion/conductores/nuevo` da de alta un trabajador nuevo.
 */
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { aMinutos, aNumero, conductores } from "@mercurio/db";
import type { Conductores } from "@mercurio/db";
import {
  ETIQUETAS_CATEGORIAS, ETIQUETAS_CENTROS, ETIQUETAS_SITUACIONES_TRABAJADOR, textoDecimal,
} from "@/lib/situaciones";
import { obtenerSesion } from "@/lib/sesion";
import { getDb } from "@/lib/bd";
import { guardar } from "../actions";
import styles from "../../../_componentes/orion.module.css";

const LISTA = "/portal/administracion/conductores";

export const metadata: Metadata = {
  title: "Editar trabajador · Mercurio",
};

export default function Pagina(props: PageProps<"/portal/administracion/conductores/[id]">) {
  return (
    <Suspense fallback={<div className={styles.barra}><span className={styles.barraTitulo}>Conductores</span></div>} >
      <Ficha params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

/** Valores del formulario: de la fila existente o vacíos para la alta. */
function valoresDe(ficha: Conductores | null) {
  if (ficha === null) {
    return {
      id: "", matricula: "", nombre: "", apellidos: "",
      centro: "1", categoria: "0", situacion: "2",
      afiliacion: "0", email: "", telefono: "",
      acumuladas: "00:00", dcs: textoDecimal(0, 5), dnds: textoDecimal(0, 5),
      plusDistancia: textoDecimal(0, 2), reduccion: false, notas: "",
    };
  }
  const minutos = aMinutos(ficha.acumuladasIniciales);
  return {
    id: String(ficha.id),
    matricula: String(ficha.matricula),
    nombre: ficha.nombre,
    apellidos: ficha.apellidos,
    centro: String(ficha.centro),
    categoria: String(ficha.categoria),
    situacion: String(ficha.situacion),
    afiliacion: String(ficha.numeroAfiliado),
    email: ficha.email ?? "",
    telefono: ficha.telefono ?? "",
    acumuladas: `${minutos < 0 ? "-" : ""}${textoHoraPositiva(Math.abs(minutos))}`,
    dcs: textoDecimal(aNumero(ficha.dcsIniciales), 5),
    dnds: textoDecimal(aNumero(ficha.dndsIniciales), 5),
    plusDistancia: textoDecimal(aNumero(ficha.plusDistancia), 2),
    reduccion: ficha.isReduccionJornada,
    notas: ficha.notas ?? "",
  };
}

async function Ficha({
  params,
  searchParams,
}: {
  params: PageProps<"/portal/administracion/conductores/[id]">["params"];
  searchParams: PageProps<"/portal/administracion/conductores/[id]">["searchParams"];
}) {
  const db = getDb();
  const sesion = await obtenerSesion();
  if (sesion === null) redirect("/acceso");
  if (!sesion.esAdmin) redirect("/portal");

  const { id } = await params;

  const esAlta = id === "nuevo";
  const numeroId = Number(id);
  if (!esAlta && !Number.isInteger(numeroId)) redirect(LISTA);

  const fila = esAlta ? null : (await db.select().from(conductores).where(eq(conductores.id, numeroId)).limit(1))[0];
  if (!esAlta && fila === undefined) redirect(LISTA);

  const valores = valoresDe(fila ?? null);

  const query = await searchParams;
  const aviso = query.error === undefined
    ? null
    : query.error === "duplicada"
      ? "Otro trabajador ya usa esa matrícula."
      : "Revisa la matrícula, el nombre y los apellidos.";

  return (
    <>
      <div className={styles.barra}>
        <span className={styles.barraEditar}>
          {esAlta ? "Nuevo trabajador" : `Editar trabajador ${valores.matricula}`}
        </span>
        <Link className={styles.barraTitulo} href={LISTA} prefetch={false}>
          Conductores
        </Link>
      </div>
      <main className={styles.contenido}>
        {aviso !== null && <span className={`${styles.cinta} ${styles.cintaRoja}`}>{aviso}</span>}

        <form action={guardar}>
          <input type="hidden" name="id" value={valores.id} />

          <div className={styles.filaDato}>
            <label htmlFor="matricula">Matrícula</label>
            <input id="matricula" name="matricula" type="text" inputMode="numeric" defaultValue={valores.matricula} />
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="centro">Centro</label>
            <select id="centro" name="centro" defaultValue={valores.centro}>
              {ETIQUETAS_CENTROS.map((c) => (
                <option key={c.valor} value={String(c.valor)}>{c.etiqueta}</option>
              ))}
            </select>
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="categoria">Categoría</label>
            <select id="categoria" name="categoria" defaultValue={valores.categoria}>
              {ETIQUETAS_CATEGORIAS.map((c) => (
                <option key={c.valor} value={String(c.valor)}>{c.etiqueta}</option>
              ))}
            </select>
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="situacion">Situación</label>
            <select id="situacion" name="situacion" defaultValue={valores.situacion}>
              {ETIQUETAS_SITUACIONES_TRABAJADOR.map((s) => (
                <option key={s.valor} value={String(s.valor)}>{s.etiqueta}</option>
              ))}
            </select>
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" name="nombre" type="text" defaultValue={valores.nombre} />
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="apellidos">Apellidos</label>
            <input id="apellidos" name="apellidos" type="text" defaultValue={valores.apellidos} />
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="afiliacion">Nº Afiliación</label>
            <input
              id="afiliacion"
              name="afiliacion"
              type="text"
              inputMode="numeric"
              defaultValue={valores.afiliacion}
            />
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="email">E-Mail</label>
            <input id="email" name="email" type="email" defaultValue={valores.email} />
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="telefono">Teléfono</label>
            <input id="telefono" name="telefono" type="tel" defaultValue={valores.telefono} />
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="acumuladas">Acumuladas</label>
            <input
              id="acumuladas"
              name="acumuladas"
              type="text"
              inputMode="numeric"
              defaultValue={valores.acumuladas}
            />
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="dcs">DCs</label>
            <input id="dcs" name="dcs" type="text" inputMode="decimal" defaultValue={valores.dcs} />
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="dnds">DNDs</label>
            <input id="dnds" name="dnds" type="text" inputMode="decimal" defaultValue={valores.dnds} />
          </div>
          <div className={styles.filaDato}>
            <label htmlFor="plusDistancia">Plus distancia</label>
            <input
              id="plusDistancia"
              name="plusDistancia"
              type="text"
              inputMode="decimal"
              defaultValue={valores.plusDistancia}
            />
          </div>

          <div className={styles.filaInterruptor}>
            <label className={styles.interruptor}>
              <input id="reduccion" name="reduccion" type="checkbox" defaultChecked={valores.reduccion} />
              <span className={styles.interruptorCirculo} />
            </label>
            <span>Reducción de jornada</span>
          </div>

          <div className={styles.filaDato}>
            <label htmlFor="notas">Notas</label>
            <textarea id="notas" name="notas" defaultValue={valores.notas} />
          </div>

          <div className={styles.volverZona}>
            <Link className={styles.botonAzul} href={LISTA} prefetch={false}>
              Volver
            </Link>
            <button className={styles.botonVerde} type="submit">
              💾 Guardar
            </button>
          </div>
        </form>
      </main>
    </>
  );
}

/** "00:00" sin signo (el signo lo añade la llamada con negativos). */
function textoHoraPositiva(minutos: number): string {
  const abs = Math.round(minutos);
  return `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
