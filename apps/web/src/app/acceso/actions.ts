"use server";

/**
 * Estado del formulario de acceso: el texto del error, o null si no hay.
 * La autenticación real necesita la base de datos (ORM por decidir), de momento
 * se valida lo mínimo y devuelve un error de "sin conexión".
 */
export async function iniciarSesion(_estado: string | null, formData: FormData): Promise<string | null> {
  const usuario = String(formData.get("usuario") ?? "").trim();
  const clave = String(formData.get("clave") ?? "");

  if (usuario === "" || clave === "") return "Introduce el usuario y la clave.";

  // TODO: comprobar credenciales contra la base de datos cuando esté el ORM.
  return "Autenticación no disponible todavía: la base de datos no está conectada.";
}
