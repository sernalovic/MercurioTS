import { describe, expect, it } from "vitest";
import { CategoriaTrabajador, CentroTrabajo } from "../src/enums";
import {
  Calendario, nuevaTablaSalarial, nuevoCalendario, nuevoConductor, nuevoConvenio,
  nuevoOpcionesCentro, nuevoResumenCalendario,
} from "../src/Entidades";
import {
  generarNomina, incrementarImportes, porcentajeAntiguedad, recalcularNomina,
} from "../src/CalculosNomina";

// Espejo de NominaTests.cs.
describe("CalculosNomina.porcentajeAntiguedad", () => {
  const casos: Array<[number, number]> = [
    [700, 0],
    [731, 0.05],
    [1461, 0.1],
    [10586, 0.6],
  ];

  for (const [dias, esperado] of casos) {
    it(`${dias} días → ${esperado}`, () => {
      // 2000-01-01 más los días correspondientes (fechas en UTC, sin zona).
      const b = new Date(Date.UTC(2000, 0, 1) + dias * 86_400_000);
      const fecha = `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, "0")}-${String(b.getUTCDate()).padStart(2, "0")}`;
      expect(porcentajeAntiguedad("2000-01-01", fecha)).toBe(esperado);
    });
  }
});

describe("CalculosNomina.generar", () => {
  it("nómina básica (importe en céntimos)", () => {
    const conv = nuevoConvenio();
    conv.tablasSalariales.push(nuevaTablaSalarial({
      categoria: CategoriaTrabajador.Conductor,
      sueldoBaseMensual: 150_000, // 1500 €
      precioQuebrantoMoneda: 100, // 1 €
      porcentajeSeguridadSocial: 4.7,
      porcentajeDesempleo: 1.55,
      pagaSeptiembre: 0,
    }));
    conv.opcionesCentro.push(nuevoOpcionesCentro({ centro: CentroTrabajo.Bilbao }));
    const conductor = nuevoConductor({
      id: 7, centro: CentroTrabajo.Bilbao, fechaAntiguedad: "2026-01-01", porcentajeIrpf: 10,
    });
    const cal = nuevoCalendario({
      fecha: "2026-10-01", conductor,
      resumen: nuevoResumenCalendario({ diasTrabajo: 20 }),
    });
    const n = generarNomina(cal, conv);
    expect(n.conductorId).toBe(7);
    expect(n.fechaFinal).toBe("2026-10-31");
    expect(n.totalDevengado).toBe(152_000); // salario base 1500 € + quebranto 20 €
    expect(n.descuentoIrpf).toBe(15_200);   // 10 % de 1520 €
    expect(n.prorrateoPagas).toBe(37_500);  // 1500 € × 3 / 12
  });

  it("sin conductor o sin tabla no genera nada", () => {
    const conv = nuevoConvenio();
    conv.opcionesCentro.push(nuevoOpcionesCentro({ centro: CentroTrabajo.Bilbao }));
    const cal = nuevoCalendario({ fecha: "2026-10-01", conductor: null, resumen: nuevoResumenCalendario() });
    expect(generarNomina(cal, conv).conceptos).toHaveLength(0);

    const convSinTabla = nuevoConvenio();
    const cal2 = nuevoCalendario({
      fecha: "2026-10-01",
      conductor: nuevoConductor({ centro: CentroTrabajo.Bilbao }),
      resumen: nuevoResumenCalendario(),
    });
    expect(generarNomina(cal2, convSinTabla).conceptos).toHaveLength(0);
  });

  it("recalcular actualiza la antigüedad de la nómina", () => {
    const conv = nuevoConvenio();
    const tabla = nuevaTablaSalarial({
      categoria: CategoriaTrabajador.Conductor,
      sueldoBaseMensual: 150_000,
      baseAntiguedad: 300, // 3 €
      porcentajeSeguridadSocial: 4.7, porcentajeDesempleo: 1.55, pagaSeptiembre: 0,
    });
    const cal = nuevoCalendario({
      fecha: "2027-03-01", // 2005-01-01 → 8094 días > 6935 → tramo 40 %
      conductor: nuevoConductor({ centro: CentroTrabajo.Bilbao, fechaAntiguedad: "2005-01-01", porcentajeIrpf: 0 }),
      resumen: nuevoResumenCalendario(),
    });
    const n = generarNomina(cal, conv);
    // La nómina vacía no lleva fechas; se rellenan a mano antes de recalcular (como haría la app al editar).
    n.fecha = cal.fecha;
    n.fechaAntiguedad = "2005-01-01";
    // La antigüedad no está en el convenio sin tabla al generar; la forzamos vía recalcular.
    n.conceptos.push({
      id: undefined, nominaId: undefined,
      tipoConceptoNomina: 1, codigo: 0, computaParaIrpf: true,
      textoConcepto: "Antigüedad", unidades: 30, importeBase: 0, devengado: 0, deduccion: 0,
    });
    recalcularNomina(n, tabla);
    const antiguedad = n.conceptos.find((c) => c.textoConcepto === "Antigüedad")!;
    expect(antiguedad.importeBase).toBeCloseTo((300 / 30) * 0.4, 10); // 10 céntimos/día base × 40 % = 4 céntimos
    expect(n.descuentoIrpf).toBe(0);
  });
});

describe("CalculosNomina.incrementarImportes", () => {
  it("redondea a dos decimales (al céntimo)", () => {
    const conv = { ...nuevoConvenio(), importeDietas: 1000 }; // 10 €
    incrementarImportes(conv, 3.33);
    expect(conv.importeDietas).toBe(1033); // 10.33 €
  });
});
