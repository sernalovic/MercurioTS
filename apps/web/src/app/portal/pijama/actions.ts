"use server";

/**
 * Server Action del Pijama: botón "Guardar DCs y DNDs", que recalcula el
 * saldo de DCs y DNDs pendientes del mes a partir de los descansos colocados
 * por el trabajador (REGLAS-CALCULO.md 15).
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { guardarDcsYDnds } from "@/lib/calendario";

export async function guardarDcsYDndsAction(
  claves: { ano: number; mes: number },
): Promise<void> {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");

  await guardarDcsYDnds(db, {
    usuarioId: trabajador.sesion.id,
    conductorId: trabajador.conductor.id,
    ano: claves.ano,
    mes: claves.mes,
  });

  revalidatePath("/portal/pijama");
  redirect(`/portal/pijama?ano=${claves.ano}&mes=${claves.mes}`);
}
