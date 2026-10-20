"use server";

import { redirect } from "next/navigation";
import { cerrarSesion } from "@/lib/sesion";

/** Port de LogoutModel: cierra la sesión y vuelve a la pantalla de acceso. */
export async function cerrar(): Promise<void> {
  await cerrarSesion();
  redirect("/acceso");
}
