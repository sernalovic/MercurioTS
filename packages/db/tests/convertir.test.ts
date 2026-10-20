import { describe, expect, it } from "vitest";
import { aCentimos, aIntervalo, aMinutos, aNumerico } from "../src/convertir";

describe("convertir (interval ↔ minutos)", () => {
  it("interpreta intervalos simples y acepta horas sobre 24", () => {
    expect(aMinutos("07:20:00")).toBe(440);
    expect(aMinutos("5:00:00")).toBe(300);
    expect(aMinutos("00:15:00")).toBe(15);
    expect(aMinutos("1 day 06:00:00")).toBe(1800); // 30 h
    expect(aMinutos("-01:00:00")).toBe(-60);
  });

  it("serializa minutos a interval y va y vuelve", () => {
    expect(aIntervalo(440)).toBe("07:20:00");
    expect(aIntervalo(0)).toBe("00:00:00");
    expect(aIntervalo(-60)).toBe("-01:00:00");
    expect(aMinutos(aIntervalo(1439))).toBe(1439);
    expect(aMinutos(aIntervalo(1800))).toBe(1800); // el dia cruzado sobrevive al viaje
  });
});

describe("convertir (numeric ↔ céntimos)", () => {
  it("dinero exacto en céntimos", () => {
    expect(aCentimos("15.37")).toBe(1537);
    expect(aCentimos("0.10")).toBe(10);
    expect(aCentimos("-32.50")).toBe(-3250);
    expect(aNumerico(1537)).toBe("15.37");
    expect(aNumerico(10)).toBe("0.10");
    expect(aCentimos(aNumerico(123456))).toBe(123456);
  });
});
