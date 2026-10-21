"use server";

/**
 * Server Actions de la gestión de trabajadores ("Trabajadores" de Orión 2):
 * alta/edición de la ficha desde la página `/…/[id]` y borrado desde el
 * listado. Solo para cuentas administradoras.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { aIntervalo, aTextoNumerico, conductores } from "@mercurio/db";
import { CentroTrabajo, CategoriaTrabajador, SituacionTrabajador } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { obtenerSesion } from "@/lib/sesion";

const LISTA = "/portal/administracion/conductores";

function textoDe(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Entero del formulario (vacío → porDefecto). */
function enteroDe(valor: FormDataEntryValue | null, porDefecto = 0): number {
  if (typeof valor !== "string" || valor.trim() === "") return porDefecto;
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : porDefecto;
}

/** Decimal con coma del formulario (vacío → porDefecto). */
function decimalDe(valor: FormDataEntryValue | null, porDefecto = 0): number {
  if (typeof valor !== "string" || valor.trim() === "") return porDefecto;
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : porDefecto;
}

/** "01:15" (junto a "-01:15") → minutos desde medianoche; vacío → 0. */
function minutosDe(valor: FormDataEntryValue | null): number {
  if (typeof valor !== "string" || valor.trim() === "") return 0;
  const m = /^(-)?(\d{1,3}):(\d{2})$/.exec(valor.trim());
  if (m === null) return 0;
  const minutos = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === undefined ? minutos : -minutos;
}

async function asegurarAdmin() {
  const sesion = await obtenerSesion();
  if (sesion === null) redirect("/acceso");
  if (!sesion.esAdmin) redirect("/portal");
  return sesion;
}

/** Guarda la ficha (alta con `id` vacío, edición con número). */
export async function guardar(formData: FormData): Promise<void> {
  const db = getDb();
  const sesion = await asegurarAdmin();
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");

  const idTexto = textoDe(formData.get("id"));
  const esAlta = idTexto === "";
  const destino = `${LISTA}/${esAlta ? "nuevo" : idTexto}`;

  const matricula = enteroDe(formData.get("matricula"));
  const nombre = textoDe(formData.get("nombre"));
  const apellidos = textoDe(formData.get("apellidos"));
  if (matricula <= 0 || nombre === "" || apellidos === "") {
    redirect(`${destino}?error=datos`);
  }

  // La matrícula es única: comprueba choques con otro trabajador.
  const [duplicada] = await db.select({ id: conductores.id })
    .from(conductores)
    .where(and(
      eq(conductores.matricula, matricula),
      esAlta ? undefined : ne(conductores.id, Number(idTexto)),
    ))
    .limit(1);
  if (duplicada !== undefined) redirect(`${destino}?error=duplicada`);

  const email = textoDe(formData.get("email"));
  const telefono = textoDe(formData.get("telefono"));
  const notas = textoDe(formData.get("notas"));
  const comunes = {
    matricula,
    centro: Number(formData.get("centro")) as CentroTrabajo,
    categoria: Number(formData.get("categoria")) as CategoriaTrabajador,
    situacion: Number(formData.get("situacion")) as SituacionTrabajador,
    nombre,
    apellidos,
    email: email === "" ? null : email,
    telefono: telefono === "" ? null : telefono,
    numeroAfiliado: enteroDe(formData.get("afiliacion")),
    isReduccionJornada: formData.get("reduccion") === "on",
    acumuladasIniciales: aIntervalo(minutosDe(formData.get("acumuladas"))),
    dcsIniciales: aTextoNumerico(decimalDe(formData.get("dcs"))),
    dndsIniciales: aTextoNumerico(decimalDe(formData.get("dnds"))),
    plusDistancia: aTextoNumerico(decimalDe(formData.get("plusDistancia"))),
    notas: notas === "" ? null : notas,
    modifiedDate: ahora,
    modifiedBy: sesion.id,
  };

  if (esAlta) {
    const hoy = new Date().toISOString().slice(0, 10);
    await db.insert(conductores).values({
      ...comunes,
      isUsuario: false,
      fechaAntiguedad: `${hoy} 00:00:00`,
      porcentajeIrpf: "0.00",
      porcentajeJornada: 100,
    });
  } else {
    // Los campos fuera de la ficha (antigüedad, IRPF, IsUsuario…) no se tocan.
    await db.update(conductores)
      .set(comunes)
      .where(eq(conductores.id, Number(idTexto)));
  }

  revalidatePath(LISTA);
  revalidatePath("/portal/administracion");
  // Los saldos de DCs/DNDs y el IRPF salen de la ficha del conductor.
  revalidatePath("/portal");
  revalidatePath("/portal/calendario");
  revalidatePath("/portal/importes");
  redirect(LISTA);
}

/** Borra el trabajador desde el listado (las filas asociadas van en cascada). */
export async function borrar(id: number): Promise<void> {
  const db = getDb();
  await asegurarAdmin();
  await db.delete(conductores).where(eq(conductores.id, id));

  revalidatePath(LISTA);
  revalidatePath("/portal");
}
