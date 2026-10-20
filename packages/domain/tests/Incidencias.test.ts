import { describe, expect, it } from "vitest";
import {
  CodigoIncidencia, Incidencia, TipoDia,
} from "../src/enums";
import {
  abreviatura, asignar, esTrabajo, parse, texto, tipoDiaPorFecha,
} from "../src/Incidencias";

// Espejo de IncidenciasTests.cs.
describe("Incidencias.parse", () => {
  const casos: Array<[string | null, Incidencia, number]> = [
    ["123", Incidencia.Trabajo, 123],
    ["*45>", Incidencia.Trabajo, 45],
    ["OV-JD", Incidencia.OVJD, 0],
    ["trabajofn", Incidencia.TrabajoFN, 0],
    ["oh", Incidencia.DC, 0],
    ["xyz", Incidencia.Inactivo, 0],
  ];

  for (const [texto_ , inc, numero] of casos) {
    it(`parse "${texto_}" → ${inc}/${numero}`, () => {
      expect(parse(texto_)).toEqual({ incidencia: inc, numero });
    });
  }

  it("texto vacío → inactivo", () => {
    expect(parse(null)).toEqual({ incidencia: Incidencia.Inactivo, numero: 0 });
    expect(parse("   ")).toEqual({ incidencia: Incidencia.Inactivo, numero: 0 });
  });
});

describe("Incidencias.texto", () => {
  it("marca trabajo en descanso con asterisco", () => {
    expect(texto(Incidencia.TrabajoJD, 12, CodigoIncidencia.Ninguno)).toBe("12*");
    expect(texto(Incidencia.OV, 0, CodigoIncidencia.Ninguno)).toBe("OV");
    expect(texto(Incidencia.Inactivo, 0, CodigoIncidencia.Ninguno)).toBe("");
  });
});

describe("Incidencias.asignar", () => {
  it("sobre descanso usa la variante", () => {
    expect(asignar(Incidencia.JD, Incidencia.E)).toBe(Incidencia.EJD);
    expect(asignar(Incidencia.FN, Incidencia.Trabajo)).toBe(Incidencia.TrabajoFN);
    expect(asignar(Incidencia.JD, Incidencia.DC)).toBe(Incidencia.DC);
  });
});

describe("Incidencias.esTrabajo", () => {
  it("trabajo, descanso trabajado y formación; RE con número", () => {
    expect(esTrabajo(Incidencia.Trabajo, 1)).toBe(true);
    expect(esTrabajo(Incidencia.TrabajoJD, 0)).toBe(true);
    expect(esTrabajo(Incidencia.FOR, 0)).toBe(true);
    expect(esTrabajo(Incidencia.RE, 0)).toBe(false);
    expect(esTrabajo(Incidencia.RE, 5)).toBe(true);
    expect(esTrabajo(Incidencia.JD, 0)).toBe(false);
  });
});

describe("Incidencias.abreviatura y tipoDiaPorFecha", () => {
  it("abreviaturas", () => {
    expect(abreviatura(Incidencia.TrabajoJD)).toBe("Trab-JD");
    expect(abreviatura(Incidencia.OV)).toBe("OV");
  });

  it("tipo de día por fecha según día de la semana (2026-10-03 es sábado)", () => {
    expect(tipoDiaPorFecha("2026-10-04")).toBe(TipoDia.Festivo); // domingo
    expect(tipoDiaPorFecha("2026-10-03")).toBe(TipoDia.Sabado);
    expect(tipoDiaPorFecha("2026-10-02")).toBe(TipoDia.Viernes);
    expect(tipoDiaPorFecha("2026-10-01")).toBe(TipoDia.LunesJueves);
  });
});
