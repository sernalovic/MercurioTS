import { describe, expect, it } from "vitest";
import { Duracion } from "../src/Horas";

// Primer test del port: espejo de "Duracion_cruza_medianoche" en CalculosHorarioTests.cs.
describe("Horas.Duracion", () => {
  it("cruza medianoche (22:00 → 1:00 = 3h, como en el original)", () => {
    expect(Duracion(22 * 60, 1 * 60)).toBe(3 * 60);
  });

  it("mismo día (6:00 → 13:00 = 7h)", () => {
    expect(Duracion(6 * 60, 13 * 60)).toBe(7 * 60);
  });

  it("instante igual → 0 minutos", () => {
    expect(Duracion(6 * 60, 6 * 60)).toBe(24 * 60);
  });
});
