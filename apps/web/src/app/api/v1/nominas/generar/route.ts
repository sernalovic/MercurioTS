/**
 * `POST /api/v1/nominas/generar?fecha=AAAA-MM-DD&idConductor=N` — genera (o
 * regenera) la nómina mensual del conductor con `CalculosNomina` del dominio
 * (port de `NominasController.Generar` + `ServicioCalendarios.GenerarNominaAsync`).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { generarNominaServidor } from "@/lib/nominasReclamaciones";

export async function POST(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden generar nóminas." }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const fecha = (params.get("fecha") ?? "").slice(0, 10);
  const idConductor = Number(params.get("idConductor") ?? "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return Response.json({ error: "Indica la fecha (fecha=AAAA-MM-DD)." }, { status: 400 });
  }
  if (!Number.isInteger(idConductor) || idConductor <= 0) {
    return Response.json({ error: "Indica el conductor (idConductor=N)." }, { status: 400 });
  }
  const db = getDb();
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  const nomina = await generarNominaServidor(db, fecha, idConductor, sesion.id, ahora);
  if (nomina === null) {
    return Response.json(
      { error: "Falta el calendario del mes o el convenio del año." },
      { status: 400 },
    );
  }
  return Response.json({ nomina });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
