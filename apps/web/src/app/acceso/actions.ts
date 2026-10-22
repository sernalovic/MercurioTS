"use server";

/**
 * Inicio de sesión del portal: delega la verificación en la lógica
 * compartida con la API del escritorio (`lib/autenticacion.ts`) y crea
 * la cookie de sesión antes de redirigir al portal.
 */
import { redirect } from "next/navigation";
import { entrarCon } from "@/lib/autenticacion";
import { crearSesion } from "@/lib/sesion";

export async function iniciarSesion(estado: string | null, formData: FormData): Promise<string | null> {
  const usuario = String(formData.get("usuario") ?? "").trim();
  const clave = String(formData.get("clave") ?? "");

  if (usuario === "" || clave === "") return "Introduce el usuario y la clave.";

  const intento = await entrarCon(usuario, clave);
  if ("error" in intento) return intento.error;

  await crearSesion(intento.sesion);
  redirect("/portal"); // LoginModel: LocalRedirect…"/Portal"
}
