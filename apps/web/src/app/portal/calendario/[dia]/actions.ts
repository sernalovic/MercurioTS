"use server";

/**
 * Server Action del detalle del día: valida el formulario, guarda el
 * servicio TRABAJADO y vuelve a la lista del calendario.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CodigoIncidencia, Incidencia, Turno } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { guardarDia } from "@/lib/calendario";

/** "07:15" (input time) → minutos desde medianoche; "" → null. */
function minutosDeHora(valor: FormDataEntryValue | null): number | null {
  if (typeof valor !== "string" || valor.trim() === "") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(valor.trim());
  if (m === null) throw new Error(`Hora no válida: "${valor}"`);
  const minutos = Number(m[1]) * 60 + Number(m[2]);
  if (minutos < 0 || minutos > 24 * 60) throw new Error(`Hora fuera de rango: "${valor}"`);
  return minutos;
}

function enteroDe(valor: FormDataEntryValue | null, porDefecto = 0): number {
  if (typeof valor !== "string" || valor.trim() === "") return porDefecto;
  const n = Number(valor.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`Número no válido: "${valor}"`);
  return n;
}

export async function guardar(
  claves: { ano: number; mes: number; dia: number },
  accion: FormData,
): Promise<void> {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");

  const form = accion;
  const datos = {
    incidencia: Number(form.get("situacion")) as Incidencia,
    codigo: Number(form.get("comite")) as CodigoIncidencia,
    turno: Number(form.get("turno")) as Turno,
    numero: enteroDe(form.get("grafico")),
    inicio: minutosDeHora(form.get("inicio")),
    final: minutosDeHora(form.get("final")),
    inicioPartido: minutosDeHora(form.get("inicioPartido")),
    finalPartido: minutosDeHora(form.get("finalPartido")),
    facturadoPaqueteria: Math.round(enteroDe(form.get("facturadoPaqueteria")) * 100),
    limpieza: enteroDe(form.get("limpiezas")),
    vehiculos: typeof form.get("vehiculos") === "string" ? String(form.get("vehiculos")) : null,
    refuerzos: enteroDe(form.get("refuerzos")),
    dndCobrado: form.get("dndCobrado") === "on",
    notas: typeof form.get("notas") === "string" ? String(form.get("notas")) : null,
  };

  await guardarDia(db, {
    usuarioId: trabajador.sesion.id,
    conductorId: trabajador.conductor.id,
    ano: claves.ano,
    mes: claves.mes,
    dia: claves.dia,
    datos,
  });

  revalidatePath("/portal");
  revalidatePath("/portal/calendario");
  redirect(`/portal/calendario?ano=${claves.ano}&mes=${claves.mes}`);
}
