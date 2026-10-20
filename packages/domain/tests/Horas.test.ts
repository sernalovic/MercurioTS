import { describe, expect, it } from "vitest";
import { Duracion, EnHoras, Max } from "../src/Horas";

// Espejo de los tests xUnit de Horas (CalculosHorarioTests.cs) y utilidades.
describe("Horas.Duracion", () => {
  it("cruza medianoche (22:00 → 1:00 = 3h, como en el original)", () => {
    expect(Duracion(22 * 60, 1 * 60)).toBe(3 * 60);
  });

  it("mismo día (6:00 → 13:00 = 7h)", () => {
    expect(Duracion(6 * 60, 13 * 60)).toBe(7 * 60);
  });

  it("instante igual → 0 minutos (literal del C#: d === 0 no cruza medianoche)", () => {
    expect(Duracion(6 * 60, 6 * 60)).toBe(0);
  });

  it("horarios ausentes → 0", () => {
    expect(Duracion(null, 13 * 60)).toBe(0);
    expect(Duracion(6 * 60, null)).toBe(0);
  });
});

describe("Horas.EnHoras / Max", () => {
  it("convierte minutos a horas decimales", () => {
    expect(EnHoras(90)).toBe(1.5);
    expect(EnHoras(30)).toBe(0.5);
  });

  it("Max", () => {
    expect(Max(440, 480)).toBe(480);
    expect(Max(480, 0)).toBe(480);
  });
});
