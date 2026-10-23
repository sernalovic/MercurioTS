/**
 * `POST /api/v1/cuenta/enviarEmail` — envía el correo masivo de la pantalla
 * «Usuarios» (port de `AccountController.SendMail`, con política Admin y el
 * mismo mensaje si no hay SMTP configurado en el entorno).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function POST(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden enviar correos." }, { status: 403 });
  }
  let dto: { asunto?: string; cuerpo?: string; direcciones?: Array<{ nombre?: string; email?: string }> };
  try {
    dto = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  const anfitrion = process.env.SMTP_HOST;
  if (!anfitrion) {
    return Response.json({ error: "No hay servidor SMTP configurado (sección Smtp del entorno)." }, { status: 501 });
  }
  const direcciones = (dto.direcciones ?? []).filter((d) => typeof d.email === "string" && d.email.includes("@"));
  if (direcciones.length === 0) {
    return Response.json({ error: "No hay destinatarios con email." }, { status: 400 });
  }
  const nodemailer = await import("nodemailer");
  const transporte = nodemailer.createTransport({
    host: anfitrion,
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "1",
    auth: process.env.SMTP_USER === undefined ? undefined : {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_CLAVE ?? "",
    },
  });
  await transporte.sendMail({
    from: process.env.SMTP_DE ?? "Mercurio <noreply@mercurio.local>",
    to: direcciones.map((d) => ({ name: d.nombre ?? "", address: d.email as string })),
    subject: String(dto.asunto ?? ""),
    text: String(dto.cuerpo ?? ""),
  });
  return new Response(null, { status: 204 });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
