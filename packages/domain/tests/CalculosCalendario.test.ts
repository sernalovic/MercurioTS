import { describe, expect, it } from "vitest";
import {
  Incidencia, SituacionTrabajador,
} from "../src/enums";
import {
  Calendario, Conductor, nuevoCalendario, nuevoConductor, nuevoConvenio, nuevoResumenCalendario,
} from "../src/Entidades";
import {
  ajustarJDs, crearDias, diferenciaAcumuladas, tieneDiferenciasEnContra, recalcularResumen,
} from "../src/CalculosCalendario";
import { diaDeLaSemana } from "../src/Fechas";
import { dia as diaDe } from "../src/Fechas";

// Espejo de CalendarioTests.cs.
function mes(
  año: number, mes: number, inc: (fecha: string) => Incidencia, conductor: Conductor | null = null,
): Calendario {
  const c = nuevoCalendario({
    fecha: `${año}-${String(mes).padStart(2, "0")}-01`,
    conductor,
  });
  crearDias(c, año, mes);
  for (const d of c.dias) {
    d.servicioTrabajado.incidencia = inc(d.fecha);
    d.servicioVirtual.incidencia = inc(d.fecha);
  }
  return c;
}

describe("CalculosCalendario.ajustarJDs", () => {
  it("convierte en fin de semana y marca sueltos", () => {
    // Octubre 2026: el 1 es jueves; el 3 es sábado y el 7 es miércoles.
    const c = mes(2026, 10, (f) => {
      const n = Number(f.slice(8, 10));
      if (n === 3 || n === 4 || n === 14) return Incidencia.JD;
      if (n === 7) return Incidencia.FN;
      return Incidencia.Trabajo;
    });
    ajustarJDs(c.dias, null, null);
    expect(c.dias[2]!.servicioTrabajado.incidencia).toBe(Incidencia.FN); // sábado
    expect(c.dias[3]!.servicioTrabajado.incidencia).toBe(Incidencia.FN); // domingo
    expect(c.dias[6]!.servicioTrabajado.incidencia).toBe(Incidencia.DS); // miércoles aislado
    expect(c.dias[13]!.servicioTrabajado.incidencia).toBe(Incidencia.DS); // miércoles aislado
  });
});

describe("CalculosCalendario.recalcularResumen", () => {
  it("cuenta días y fines de semana completos", () => {
    const conv = nuevoConvenio();
    const c = mes(2026, 10, (f) => (diaDeLaSemana(f) === 0 || diaDeLaSemana(f) === 6 ? Incidencia.FN : Incidencia.Trabajo),
      nuevoConductor({ situacion: SituacionTrabajador.Fijo }));
    recalcularResumen(c, conv, null, null);
    const r = c.resumen!;
    expect(r.diasActivo).toBe(31);
    expect(r.diasTrabajo).toBe(22);
    expect(r.diasFN).toBe(9);
    expect(r.findesCompletos).toBe(4); // sábados 3, 10, 17 y 24 con domingo; el 31 es el último día
    expect(r.sabadosTrabajados).toBe(0);
  });

  it("calcula dietas y plus de sábados", () => {
    const conv = nuevoConvenio();
    const c = mes(2026, 10, () => Incidencia.Trabajo, nuevoConductor({ situacion: SituacionTrabajador.Fijo }));
    for (const d of c.dias) {
      d.servicioTrabajado.desayuno = 0.5;
      d.servicioTrabajado.comida = 1;
    }
    recalcularResumen(c, conv, null, null);
    const r = c.resumen!;
    expect(r.totalDietas).toBeCloseTo(31 * 0.5 * 0.8 + 31, 10);
    expect(r.importePlusSabados).toBe(5 * conv.importePlusSabados); // 5 sábados en octubre de 2026
    // Un mes entero trabajado: ningún descanso y más de 6 días seguidos (el aviso sale en el primer descanso, que no llega).
    expect(r.errores).toContain("Menos de 2 descansos en un mes.");
    expect(r.errores).not.toContain("días trabajados");
  });
});

describe("CalculosCalendario.tieneDiferenciasEnContra", () => {
  it("detecta diferencias de acumuladas", () => {
    const c = mes(2026, 10, () => Incidencia.Trabajo);
    c.resumen = nuevoResumenCalendario();
    c.dias[0]!.servicioTrabajado.acumuladas = 60; // 1 hora
    expect(tieneDiferenciasEnContra(c)).toBe(true);
    expect(diferenciaAcumuladas(c.dias)).toBe(60);
  });
});
