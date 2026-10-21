"use server";

/**
 * Server Action de "Datos de trabajador/a": guarda la ficha del conductor.
 * El email de la CUENTA de usuario no se toca con este formulario.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/bd";
import { conductorDeCesion, guardarDatosConductor, type DatosConductor } from "@/lib/trabajador";

function textoDe(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Decimal con coma o punto → "N.NN" para la BD; vacío → "0". */
function decimalDe(valor: FormDataEntryValue | null): string {
  const texto = textoDe(valor);
  if (texto === "") return "0";
  const n = Number(texto.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`Número no válido: "${texto}"`);
  return String(n);
}

export async function guardar(accion: FormData): Promise<void> {
  const db = getDb();
  const trabajador = await conductorDeCesion(db);
  if (trabajador === null) redirect("/acceso");

  const nombre = textoDe(accion.get("nombre"));
  const apellidos = textoDe(accion.get("apellidos"));
  if (nombre === "" || apellidos === "") {
    throw new Error("El nombre y los apellidos no pueden quedar vacíos.");
  }

  const fechaCorta = textoDe(accion.get("fechaAntiguedad"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCorta)) {
    throw new Error(`Fecha de antigüedad no válida: "${fechaCorta}"`);
  }

  const email = textoDe(accion.get("email"));
  const telefono = textoDe(accion.get("telefono"));
  const datos: DatosConductor = {
    nombre,
    apellidos,
    email: email === "" ? null : email,
    telefono: telefono === "" ? null : telefono,
    fechaAntiguedad: `${fechaCorta} 00:00:00`,
    porcentajeIrpf: decimalDe(accion.get("porcentajeIrpf")),
  };

  await guardarDatosConductor(db, {
    usuarioId: trabajador.sesion.id,
    conductorId: trabajador.conductor.id,
    datos,
  });

  revalidatePath("/portal");
  revalidatePath("/portal/datos");
}
