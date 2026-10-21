"use server";

/**
 * Server Action del detalle del día del PIJAMA: guarda situación, gráfico,
 * comité, horas acumuladas y dietas; no toca turno ni horarios.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CodigoIncidencia, Incidencia } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { guardarDiaPijama } from "@/lib/calendario";

/** "07:15" (input time) → minutos desde medianoche; "" → null. */
function minutosDeHora(valor: FormDataEntryValue | null): number | null {
  if (typeof valor !== "string" || valor.trim() === "") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(valor.trim());
  if (m === null) throw new Error(`Hora no válida: "${valor}"`);
  const minutos = Number(m[1]) * 60 + Number(m[2]);
  if (minutos < 0 || minutos > 24 * 60) throw new Error(`Hora fuera de rango: "${valor}"`);
  return minutos;
}

/** Decimal con coma o punto → número; vacío → 0. */
function decimalDe(valor: FormDataEntryValue | null): number {
  if (typeof valor !== "string" || valor.trim() === "") return 0;
  const n = Number(valor.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`Número no válido: "${valor}"`);
  return n;
}

function enteroDe(valor: FormDataEntryValue | null): number {
  return Math.round(decimalDe(valor));
}

export async function guardar(
  claves: { ano: number; mes: number; dia: number },
  accion: FormData,
): Promise<void> {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");

  const datos = {
    incidencia: Number(accion.get("situacion")) as Incidencia,
    codigo: Number(accion.get("comite")) as CodigoIncidencia,
    numero: enteroDe(accion.get("grafico")),
    acumuladas: minutosDeHora(accion.get("acumuladas")),
    desayuno: decimalDe(accion.get("desayuno")),
    comida: decimalDe(accion.get("comida")),
    cena: decimalDe(accion.get("cena")),
  };

  await guardarDiaPijama(db, {
    usuarioId: trabajador.sesion.id,
    conductorId: trabajador.conductor.id,
    ano: claves.ano,
    mes: claves.mes,
    dia: claves.dia,
    datos,
  });

  revalidatePath("/portal");
  revalidatePath("/portal/pijama");
  redirect(`/portal/pijama?ano=${claves.ano}&mes=${claves.mes}`);
}
