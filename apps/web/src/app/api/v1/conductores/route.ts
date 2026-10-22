/**
 * `GET /api/v1/conductores` — listado ordenado por matrícula para la
 * rejilla del escritorio (la consulta de `ConductoresView`). Filtrable
 * por centro con `?centro=N` (0 = Todos). Solo administradores.
 */
import { eq } from "drizzle-orm";
import { conductores } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores gestionan conductores." }, { status: 403 });
  }

  const centro = new URL(request.url).searchParams.get("centro");
  const db = getDb();
  const filas = await db
    .select({
      id: conductores.id,
      centro: conductores.centro,
      categoria: conductores.categoria,
      situacion: conductores.situacion,
      matricula: conductores.matricula,
      isUsuario: conductores.isUsuario,
      fechaAntiguedad: conductores.fechaAntiguedad,
      porcentajeIrpf: conductores.porcentajeIrpf,
      numeroAfiliado: conductores.numeroAfiliado,
      isReduccionJornada: conductores.isReduccionJornada,
      porcentajeJornada: conductores.porcentajeJornada,
      nombre: conductores.nombre,
      apellidos: conductores.apellidos,
      telefono: conductores.telefono,
      email: conductores.email,
      acumuladasIniciales: conductores.acumuladasIniciales,
      dcsIniciales: conductores.dcsIniciales,
      dndsIniciales: conductores.dndsIniciales,
      plusDistancia: conductores.plusDistancia,
      notas: conductores.notas,
    })
    .from(conductores)
    .where(centro !== null && centro !== "" && centro !== "0" ? eq(conductores.centro, Number(centro)) : undefined)
    .orderBy(conductores.matricula);

  return Response.json({ conductores: filas });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
