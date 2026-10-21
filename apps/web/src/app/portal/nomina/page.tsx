/**
 * Importes en nómina (port de la pantalla de Orión 2): los 13 totales del
 * mes tal y como aparecen en la nómina, para que el trabajador los meta a
 * mano. Es un formulario por MES (no por día).
 */
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { aNumero } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { importesDelMes } from "@/lib/calendario";
import { MESES_NOMBRES, textoDecimal } from "@/lib/situaciones";
import { guardar } from "./actions";
import Seccion from "../_componentes/seccion";
import styles from "../_componentes/orion.module.css";

export const metadata: Metadata = {
  title: "Importes en nómina · Mercurio",
};

/** Vista lista para el formulario (numeric string → número). */
interface VistaImportes {
  sabados: number;
  festivos: number;
  nocturnidad: number;
  nocturnidadParcial: number;
  paqueteria: number;
  limpieza: number;
  menorDescanso: number;
  navidad: number;
  viaje: number;
  quebranto: number;
  dietas: number;
  refuerzos: number;
  dndsCobrados: number;
}

const CAMPOS: Array<{ name: keyof VistaImportes; etiqueta: string }> = [
  { name: "sabados", etiqueta: "Plus sábados" },
  { name: "festivos", etiqueta: "Plus festivos" },
  { name: "nocturnidad", etiqueta: "Plus de nocturnidad" },
  { name: "nocturnidadParcial", etiqueta: "Plus de nocturnidad parcial" },
  { name: "paqueteria", etiqueta: "Plus de paquetería" },
  { name: "limpieza", etiqueta: "Plus de limpieza" },
  { name: "menorDescanso", etiqueta: "Plus por menor descanso" },
  { name: "navidad", etiqueta: "Plus de Navidad" },
  { name: "viaje", etiqueta: "Plus de viaje" },
  { name: "quebranto", etiqueta: "Quebranto de moneda" },
  { name: "dietas", etiqueta: "Importe dietas" },
  { name: "refuerzos", etiqueta: "Importe por refuerzos" },
  { name: "dndsCobrados", etiqueta: "Importe DNDs cobrados" },
];

export default function Pagina(props: PageProps<"/portal/nomina">) {
  return (
    <Suspense fallback={<main className={styles.contenido}><p className={styles.espera}>Cargando…</p></main>} >
      <ImportesTrabajador searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ImportesTrabajador({ searchParams }: { searchParams: PageProps<"/portal/nomina">["searchParams"] }) {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");
  const { conductor } = trabajador;

  // Mes mostrado: ?ano=2026&mes=10.
  const params = await searchParams;
  const hoy = new Date();
  const ano = numeroDeQuery(params.ano) ?? hoy.getFullYear();
  const mes = numeroDeQuery(params.mes) ?? hoy.getMonth() + 1;
  if (mes < 1 || mes > 12) redirect(`/portal/nomina?ano=${ano}&mes=${hoy.getMonth() + 1}`);

  const fila = await importesDelMes(db, conductor.id, ano, mes);
  const vista: VistaImportes = fila === null ? {
    sabados: 0, festivos: 0, nocturnidad: 0, nocturnidadParcial: 0, paqueteria: 0,
    limpieza: 0, menorDescanso: 0, navidad: 0, viaje: 0, quebranto: 0,
    dietas: 0, refuerzos: 0, dndsCobrados: 0,
  } : {
    sabados: aNumero(fila.totalImportePlusSabados),
    festivos: aNumero(fila.totalImportePlusFestivos),
    nocturnidad: aNumero(fila.totalImportePlusNocturnidad),
    nocturnidadParcial: aNumero(fila.totalImportePlusNocturnidadParcial),
    paqueteria: aNumero(fila.totalImportePlusPaqueteria),
    limpieza: aNumero(fila.totalImportePlusLimpieza),
    menorDescanso: aNumero(fila.totalImportePlusMenorDescanso),
    navidad: aNumero(fila.totalImportePlusNavidad),
    viaje: aNumero(fila.totalImportePlusViaje),
    quebranto: aNumero(fila.totalQuebrantoMoneda),
    dietas: aNumero(fila.totalImporteDietas),
    refuerzos: aNumero(fila.totalRefuerzos),
    dndsCobrados: aNumero(fila.totalImporteDndsCobrados),
  };

  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  const siguiente = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  const url = (p: { ano: number; mes: number }) => `/portal/nomina?ano=${p.ano}&mes=${p.mes}`;

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
    <Seccion titulo="Importes en nómina">
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
          Introduce los importes tal y como aparecen en la nómina, aunque no estén bien.
        </p>

        {CAMPOS.map((c) => (
          <div className={styles.filaImporte} key={c.name}>
            <label htmlFor={c.name}>{c.etiqueta}</label>
            <input
              id={c.name}
              name={c.name}
              type="text"
              inputMode="decimal"
              defaultValue={textoDecimal(vista[c.name])}
            />
          </div>
        ))}

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
