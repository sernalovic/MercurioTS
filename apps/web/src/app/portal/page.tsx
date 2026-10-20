/**
 * Portada del portal, port de Orión 2: saludo del trabajador, gráfico anual
 * de resúmenes (trabajados / descansos / vacaciones) y tarjetas del menú.
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { conductores, resumenes, calendarios } from "@mercurio/db";
import { obtenerSesion } from "@/lib/sesion";
import { getDb } from "@/lib/bd";
import styles from "./_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Portal · Mercurio",
};

/** Semáforo del menú portado de Orión 2. */
const TARJETAS_TRABAJADOR = [
  {
    titulo: "Calendario",
    texto: "Accede a tu calendario para actualizar los datos del día a día.",
    color: "cintaAzul",
    ruta: "/portal/calendario",
  },
  {
    titulo: "Pijama",
    texto: "Accede a tu pijama y actualiza los datos según el pijama proporcionado por la empresa.",
    color: "cintaAzul",
    ruta: "/portal/pijama",
  },
  {
    titulo: "Importes en nómina",
    texto: "Introduce los importes que aparecen en la nómina y los DCs y DNDs pendientes del pijama.",
    color: "cintaAzul",
    ruta: "/portal/nomina",
  },
  {
    titulo: "Reclamaciones",
    texto: "Lleva un seguimiento de las reclamaciones que tienes activas y de las que ya están resueltas.",
    color: "cintaAzul",
    ruta: "/portal/reclamaciones",
  },
  {
    titulo: "Calendario anual",
    texto: "Introduce el calendario anual que te ha dado la empresa para que quede guardado.",
    color: "cintaAmarilla",
    ruta: "/portal/calendario-anual",
  },
  {
    titulo: "Datos de trabajador/a",
    texto: "Consulta o modifica tus datos de trabajador/a, como por ejemplo la fecha de antigüedad o el porcentaje de I.R.P.F.",
    color: "cintaAzul",
    ruta: "/portal/datos",
  },
] as const;

const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

export default function PaginaPortal(props: PageProps<"/portal">) {
  // La sesión, el trabajador y el resumen son datos de petición: frontera
  // Suspense (cacheComponents).
  return (
    <main className={styles.contenido}>
      <Suspense fallback={<p className={styles.espera}>Cargando…</p>}>
        <Portada searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Portada({ searchParams }: { searchParams: PageProps<"/portal">["searchParams"] }) {
  const sesion = await obtenerSesion();
  if (sesion === null) redirect("/acceso");

  // Trabajador vinculado a la cuenta (AspNetUsers.Matricula → Conductores).
  const db = getDb();
  const [conductor] = sesion.matricula > 0
    ? await db.select().from(conductores).where(eq(conductores.matricula, sesion.matricula)).limit(1)
    : [];

  // Año mostrado: ?ano=XXXX (port del selector con « » de Orión 2).
  const params = await searchParams;
  const bruto = params.ano;
  const pedido = Number(Array.isArray(bruto) ? bruto[0] : bruto);
  const ano = Number.isInteger(pedido) && pedido >= 2020 && pedido <= 2050 ? pedido : new Date().getFullYear();

  // Resúmenes de cada mes del año para el gráfico. Los tres grupos son los
  // mismos totalizadores del dominio (totalDiasTrabajados, totalDescansos,
  // totalDiasVacaciones).
  const filas = conductor === undefined ? [] : await db
    .select({
      fecha: calendarios.fecha,
      diasTrabajo: resumenes.diasTrabajo,
      diasTrabajoJD: resumenes.diasTrabajoJD,
      diasTrabajoFN: resumenes.diasTrabajoFN,
      diasDC: resumenes.diasDC,
      diasJD: resumenes.diasJD,
      diasFN: resumenes.diasFN,
      diasDS: resumenes.diasDS,
      diasDF: resumenes.diasDF,
      diasOV: resumenes.diasOV,
      diasOVJD: resumenes.diasOVJD,
      diasOVFN: resumenes.diasOVFN,
    })
    .from(calendarios)
    .innerJoin(resumenes, eq(resumenes.calendarioId, calendarios.id))
    .where(
      and(
        eq(calendarios.conductorId, conductor.id),
        gte(calendarios.fecha, `${ano}-01-01`),
        lte(calendarios.fecha, `${ano}-12-31`),
      ),
    )
    .orderBy(asc(calendarios.fecha));

  const serie = MESES_CORTOS.map((etiqueta, indice) => {
    const fila = filas.find((f) => Number(f.fecha.slice(5, 7)) === indice + 1);
    return {
      etiqueta,
      trabajados: fila === undefined ? 0 : fila.diasTrabajo + fila.diasTrabajoJD + fila.diasTrabajoFN + fila.diasDC,
      descansos: fila === undefined ? 0 : fila.diasJD + fila.diasFN + fila.diasDS + fila.diasDF,
      vacaciones: fila === undefined ? 0 : fila.diasOV + fila.diasOVJD + fila.diasOVFN,
    };
  });
  // Escala apilada: el mes más alto ocupa la caja completa; cada segmento
  // es su parte del total del mes.
  const maximo = Math.max(1, ...serie.map((s) => s.trabajados + s.descansos + s.vacaciones));

  const tarjetas = sesion.esAdmin
    ? [...TARJETAS_TRABAJADOR, {
        titulo: "Administración",
        texto: "Accede al panel de administración.",
        color: "cintaRoja",
        ruta: "/portal/administracion",
      } as const]
    : TARJETAS_TRABAJADOR;

  return (
    <div>
      {conductor !== undefined && (
        <>
          <h1 className={styles.trabajador}>
            {conductor.matricula}: {conductor.apellidos}
          </h1>
          <p className={styles.afiliacion}>Nº afiliación: {conductor.numeroAfiliado}</p>
        </>
      )}
      <h2 className={styles.bienvenida}>
        Bienvenido{sesion.esAdmin && conductor === undefined ? `, ${sesion.nombre}` : ""} a Mercurio
      </h2>

      {conductor !== undefined && (
        <section className={styles.cajaResumen}>
          <div className={styles.resumenCabecera}>
            <Link className={styles.flecha} href={`/portal?ano=${ano - 1}`} prefetch={false} aria-label="Año anterior">
              «
            </Link>
            <span className={styles.resumenTitulo}>{ano}</span>
            <Link className={styles.flecha} href={`/portal?ano=${ano + 1}`} prefetch={false} aria-label="Año siguiente">
              »
            </Link>
          </div>
          <div className={styles.cuerpoResumen}>
            <div className={styles.leyenda}>
              <span><i className={`${styles.punto} ${styles.puntoTrabajados}`} />Trabajados</span>
              <span><i className={`${styles.punto} ${styles.puntoDescansos}`} />Descansos</span>
              <span><i className={`${styles.punto} ${styles.puntoVacaciones}`} />Vacaciones</span>
            </div>
            <div className={styles.grafico}>
              {serie.map((mes) => (
                <div key={mes.etiqueta} className={styles.columnaMes}>
                  <div>
                    {mes.trabajados > 0 && (
                      <div style={{ height: `${(mes.trabajados / maximo) * 96}px`, background: "#f06292" }} />
                    )}
                    {mes.descansos > 0 && (
                      <div style={{ height: `${(mes.descansos / maximo) * 96}px`, background: "#2a7de1" }} />
                    )}
                    {mes.vacaciones > 0 && (
                      <div style={{ height: `${(mes.vacaciones / maximo) * 96}px`, background: "#ffb74d" }} />
                    )}
                  </div>
                  <span className={styles.etiquetaMes}>{mes.etiqueta}</span>
                </div>
              ))}
            </div>
            {filas.length === 0 && (
              <p className={styles.resumenNota}>Aún no hay calendario cargado para este año.</p>
            )}
          </div>
        </section>
      )}

      <section className={styles.tarjetas}>
        {tarjetas.map((tarjeta) => (
          <Link key={tarjeta.ruta} href={tarjeta.ruta} className={styles.tarjeta} prefetch={false}>
            <span className={`${styles.cinta} ${styles[tarjeta.color]}`}>{tarjeta.titulo}</span>
            <span className={styles.tarjetaTexto}>{tarjeta.texto}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
