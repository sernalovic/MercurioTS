import { describe, expect, it } from "vitest";
import { CalculosHorario } from "../src/CalculosHorario";
import {
  CentroTrabajo, CodigoIncidencia, Incidencia, TipoDia, Turno,
} from "../src/enums";
import { nuevoConvenio, nuevoGrafico, nuevoOpcionesCentro, nuevoServicio } from "../src/Entidades";

// Espejo de CalculosHorarioTests.cs: expectativas derivadas a mano de
// docs/analisis-sistema-anterior/REGLAS-CALCULO.md (convenio con valores por defecto).
describe("CalculosHorario", () => {
  const calc = new CalculosHorario(nuevoConvenio());

  it("trabajadas resta la partición y suma el exceso sobre el máximo", () => {
    // Total 6:00-20:00 = 14h; partido 10:00-14:00 = 4h; exceso sobre 3h = 1h → 14 - 4 + 1 = 11h.
    expect(calc.trabajadas(6 * 60, 20 * 60, 10 * 60, 14 * 60)).toBe(11 * 60);
  });

  it("acumuladas y trabajadas convenio usan la jornada media (7:20)", () => {
    expect(calc.trabajadasConvenio(6 * 60)).toBe(7 * 60 + 20);
    expect(calc.acumuladas(8 * 60)).toBe(40);
    expect(calc.acumuladas(6 * 60)).toBe(0);
  });

  it("nocturnas antes de las seis", () => {
    expect(calc.nocturnas(5 * 60, 13 * 60, Turno.Manana)).toBe(60);
  });

  it("nocturnas en turno noche es cero, como el original", () => {
    expect(calc.nocturnas(22 * 60, 6 * 60, Turno.Noche)).toBe(0);
  });

  it("desayuno proporcional antes del límite", () => {
    expect(calc.desayuno(5 * 60, Turno.Manana)).toBe(1);
    expect(calc.desayuno(5 * 60, Turno.Tarde)).toBe(0);
  });

  it("comida: mañana que cruza toda la ventana suma dos", () => {
    // turno 1 y fin > 15:30 → 1; turno < 3, fin > 15:30 e inicio < 12:30 → +1.
    expect(calc.comida(6 * 60, 15 * 60 + 45, Turno.Manana, null, null)).toBe(2);
    expect(calc.comida(6 * 60, 14 * 60, Turno.Manana, null, null)).toBe(0);
  });

  it("comida parcial de tarde empezando en el inicio de ventana", () => {
    expect(calc.comidaParcial(12 * 60 + 30, 20 * 60, Turno.Tarde)).toBe(0.5);
  });

  it("cena proporcional y completa", () => {
    expect(calc.cena(14 * 60, 22 * 60 + 30, Turno.Tarde)).toBe(0.5);
    expect(calc.cena(15 * 60, 23 * 60 + 30, Turno.Tarde)).toBe(1);
  });

  it("plus de cena tras medianoche", () => {
    // Límite 0:00 → 24:00; fin 0:30 → 24:30; 0,5 h × 25 % = 0,125.
    expect(calc.plusCena(16 * 60, 30, Turno.Tarde)).toBe(0.125);
    expect(calc.plusCena(14 * 60, 22 * 60 + 30, Turno.Tarde)).toBe(0);
  });

  it("plus por menor descanso entre días", () => {
    const anterior = nuevoServicio({ final: 23 * 60, turno: Turno.Tarde });
    const hoy = nuevoServicio({ inicio: 6 * 60, final: 14 * 60, turno: Turno.Manana });
    const manana = nuevoServicio({ inicio: 5 * 60, turno: Turno.Manana });
    calc.recalcularPlusMenorDescanso(hoy, anterior, manana);
    // (12h − 7h) × 8,96 € → en céntimos: 5 × 896.
    expect(hoy.plusMenorDescanso).toBe((12 - 7) * 896);
    expect(manana.plusMenorDescanso).toBe(0); // 14:00 → 5:00 = 15 h de descanso
  });

  it("recalcular servicio sin horario pone ceros", () => {
    const s = nuevoServicio({ turno: Turno.Manana, trabajadas: 5 * 60, desayuno: 1 });
    calc.recalcularServicio(s);
    expect(s.trabajadas).toBe(0);
    expect(s.desayuno).toBe(0);
  });

  it("paquetería facturada es el diez por ciento", () => {
    // 50 € facturados → 5000 céntimos × 10 % = 500 céntimos (5 €).
    const s = nuevoServicio({ turno: Turno.Manana, inicio: 6 * 60, final: 14 * 60, facturadoPaqueteria: 5000 });
    calc.recalcularServicio(s);
    expect(s.plusPaqueteria).toBe(500);
  });

  it("cambiar el número sin gráfico pone la jornada media", () => {
    const s = nuevoServicio({ incidencia: Incidencia.JD, numero: 12, codigo: CodigoIncidencia.Comite });
    const r = calc.cambiarPropiedad(s, "numero", null);
    expect(r.incidencia).toBe(Incidencia.Trabajo);
    expect(r.numero).toBe(12);
    expect(r.trabajadas).toBe(7 * 60 + 20);
    expect(r.codigo).toBe(CodigoIncidencia.Comite);
  });

  it("tipo de día por rangos del centro", () => {
    const conv = nuevoConvenio();
    conv.opcionesCentro.push(nuevoOpcionesCentro({
      centro: CentroTrabajo.Bilbao, numerosL: "1-50", numerosS: "100..120, 130",
    }));
    const c = new CalculosHorario(conv);
    expect(c.tipoDiaGrafico(10, CentroTrabajo.Bilbao)).toBe(TipoDia.LunesJueves);
    expect(c.tipoDiaGrafico(130, CentroTrabajo.Bilbao)).toBe(TipoDia.Sabado);
    expect(c.tipoDiaGrafico(60, CentroTrabajo.Bilbao)).toBe(TipoDia.Ninguno);
  });

  // Casos extra del machine-siguiente (Regenerar / error de tiempo partido).
  it("recalcular gráfico marca el error de tiempo partido (y lo puedo deshacer)", () => {
    const g = nuevoGrafico({
      turno: Turno.Manana, inicio: 6 * 60, final: 20 * 60,
      inicioPartido: 10 * 60, finalPartido: 14 * 60, // partido 4h > 3h de máximo
    });
    calc.recalcularGrafico(g);
    expect(g.tieneErrorTiempoPartido).toBe(true);

    const ok = nuevoGrafico({ turno: Turno.Manana, inicio: 6 * 60, final: 14 * 60 });
    calc.recalcularGrafico(ok);
    expect(ok.tieneErrorTiempoPartido).toBe(false);
  });
});
