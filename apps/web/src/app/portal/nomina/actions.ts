"use server";

/**
 * Server Action de "Importes en nómina": guarda los 13 totales del mes
 * tal y como los introduce el trabajador (euros con coma o punto).
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { guardarImportes, type DatosImportes } from "@/lib/calendario";

/** Decimal con coma o punto → número; vacío → 0. */
function decimalDe(valor: FormDataEntryValue | null): number {
  if (typeof valor !== "string" || valor.trim() === "") return 0;
  const n = Number(valor.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`Importe no válido: "${valor}"`);
  return n;
}

const CAMPOS: Array<[keyof DatosImportes, string]> = [
  ["sabados", "sabados"], ["festivos", "festivos"], ["nocturnidad", "nocturnidad"],
  ["nocturnidadParcial", "nocturnidadParcial"], ["paqueteria", "paqueteria"],
  ["limpieza", "limpieza"], ["menorDescanso", "menorDescanso"], ["navidad", "navidad"],
  ["viaje", "viaje"], ["quebranto", "quebranto"], ["dietas", "dietas"],
  ["refuerzos", "refuerzos"], ["dndsCobrados", "dndsCobrados"],
];

export async function guardar(
  claves: { ano: number; mes: number },
  accion: FormData,
): Promise<void> {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");

  const datos = Object.fromEntries(
    CAMPOS.map(([campo, name]) => [campo, decimalDe(accion.get(name))]),
  ) as unknown as DatosImportes;

  await guardarImportes(db, {
    usuarioId: trabajador.sesion.id,
    conductorId: trabajador.conductor.id,
    ano: claves.ano,
    mes: claves.mes,
    datos,
  });

  revalidatePath("/portal");
  revalidatePath("/portal/nomina");
  redirect(`/portal/nomina?ano=${claves.ano}&mes=${claves.mes}`);
}
