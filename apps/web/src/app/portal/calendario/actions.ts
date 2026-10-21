"use server";

/**
 * Server Action del Calendario (a nivel de mes): botón "Generar
 * reclamación", que lanza el motor de cálculo del dominio (REGLAS 14) y
 * vuelve a la pantalla con un aviso del resultado.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { generarReclamacionMensual } from "@/lib/reclamaciones";

export async function generarReclamacionAction(
  claves: { ano: number; mes: number },
): Promise<void> {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");

  const resultado = await generarReclamacionMensual(db, {
    usuarioId: trabajador.sesion.id,
    conductorId: trabajador.conductor.id,
    ano: claves.ano,
    mes: claves.mes,
    ahora: new Date().toISOString().slice(0, 19).replace("T", " "),
  });

  revalidatePath("/portal/calendario");
  revalidatePath("/portal/reclamaciones");
  redirect(`/portal/calendario?ano=${claves.ano}&mes=${claves.mes}` +
    `&aviso=${encodeURIComponent(resultado.mensaje)}&ok=${resultado.ok ? 1 : 0}`);
}
