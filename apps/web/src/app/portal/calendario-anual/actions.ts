"use server";

/**
 * Server Action del Calendario anual: guarda la situación o el gráfico anual
 * de cada día del mes ("3002" → Trabajo 3002; "JD" → JD; vacío → en blanco).
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Incidencia } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { conductorDeCesion } from "@/lib/trabajador";
import { guardarCalendarioAnual, type ValorAnual } from "@/lib/calendario";
import { CODIGOS_ANUALES } from "@/lib/situaciones";

/** Casilla del Calendario annual → incidencia y gráfico. */
function valorAnualDe(dia: number, valor: FormDataEntryValue | null): ValorAnual {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (texto === "") return { dia, incidencia: Incidencia.Inactivo, numero: 0 };
  if (/^\d{1,5}$/.test(texto)) return { dia, incidencia: Incidencia.Trabajo, numero: Number(texto) };
  const incidencia = CODIGOS_ANUALES[texto.toUpperCase()];
  if (incidencia === undefined) {
    throw new Error(`Situación no válida: "${texto}" (día ${dia})`);
  }
  return { dia, incidencia, numero: 0 };
}

export async function guardar(
  claves: { ano: number; mes: number },
  accion: FormData,
): Promise<void> {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");

  const valores: ValorAnual[] = [];
  for (let dia = 1; dia <= 31; dia++) {
    valores.push(valorAnualDe(dia, accion.get(`d${String(dia).padStart(2, "0")}`)));
  }

  await guardarCalendarioAnual(db, {
    usuarioId: trabajador.sesion.id,
    conductorId: trabajador.conductor.id,
    ano: claves.ano,
    mes: claves.mes,
    valores,
  });

  revalidatePath("/portal");
  revalidatePath("/portal/calendario");
  revalidatePath("/portal/calendario-anual");
  redirect(`/portal/calendario-anual?ano=${claves.ano}&mes=${claves.mes}`);
}
