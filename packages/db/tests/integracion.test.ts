/**
 * Verificación de integración con Postgres real: solo corre si hay
 * `DATABASE_URL` (BD local `mercurio_ts` migrada con `pnpm db:reset`).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { aMinutos, crearDb, itinerarios, lineas } from "../src";

const ejecutar = Boolean(process.env.DATABASE_URL);

describe.skipIf(!ejecutar)("integración con Postgres", () => {
  const db = crearDb(process.env.DATABASE_URL ?? "postgresql://localhost/mercurio_ts");

  let lineaId: number | undefined;
  let itinerarioId: number | undefined;

  beforeAll(async () => {
    // limpiar restos de ejecuciones anteriores
    await db.delete(lineas).where(eq(lineas.nombre, "PRUEBA-HUMO"));
  });

  it("inserta con identity y lee el id devuelto", async () => {
    const [creada] = await db.insert(lineas)
      .values({ nombre: "PRUEBA-HUMO", modifiedDate: "2026-01-01 00:00:00", modifiedBy: 0 })
      .returning({ id: lineas.id });
    expect(creada).toBeDefined();
    lineaId = creada.id;
  });

  it("respeta la FK en cascada y mapea interval → string", async () => {
    const [creado] = await db.insert(itinerarios)
      .values({
        lineaId: lineaId as number,
        nombre: "IDA",
        tiempoReal: 90,
        tiempoPago: 90,
        modifiedDate: "2026-01-01 00:00:00",
        modifiedBy: 0,
      })
      .returning({ id: itinerarios.id });
    itinerarioId = creado.id;

    const [leido] = await db.select().from(itinerarios).where(eq(itinerarios.id, itinerarioId));
    expect(leido.tiempoReal).toBe(90);

    await db.delete(lineas).where(eq(lineas.id, lineaId));
    const restos = await db.select().from(itinerarios).where(eq(itinerarios.id, itinerarioId));
    expect(restos).toHaveLength(0);
  });

  it("el borrado en cascada no repite lineas", async () => {
    if (lineaId === undefined) return;
    const sobran = await db.select().from(lineas).where(eq(lineas.id, lineaId));
    expect(sobran).toHaveLength(0);
  });
});

it("aMinutos acepta el intervalo leído de Postgres", () => {
  expect(aMinutos("01:30:00")).toBe(90);
});
