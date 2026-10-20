import { describe, expect, it } from "vitest";
import { Incidencia, TipoReclamacion } from "../src/enums";
import {
  nuevaReclamacion, nuevoCalendario, nuevoConductor, nuevoResumenCalendario,
} from "../src/Entidades";
import { crearDias } from "../src/CalculosCalendario";
import { conceptoPorIncidencia, generarReclamacion } from "../src/CalculosReclamacion";

// Espejo de ReclamacionTests.cs.
describe("CalculosReclamacion.conceptoPorIncidencia", () => {
  it("clasifica el descuento por incidencia distinta", () => {
    expect(conceptoPorIncidencia(Incidencia.Trabajo, Incidencia.JD)!.tipo).toBe(TipoReclamacion.Descanso);
    expect(conceptoPorIncidencia(Incidencia.JD, Incidencia.DC)!.tipo).toBe(TipoReclamacion.DC);
    expect(conceptoPorIncidencia(Incidencia.F6DC, Incidencia.F6)).toBeNull();
  });
});

describe("CalculosReclamacion.generar", () => {
  it("genera reclamación con dietas y gráfico diferente", () => {
    const cal = nuevoCalendario({
      conductorId: 3, fecha: "2026-10-01",
      conductor: nuevoConductor({ matricula: 555 }),
    });
    crearDias(cal, 2026, 10);
    cal.resumen = nuevoResumenCalendario(); // el original la sustituye por un resumen vacío
    const dia = cal.dias[4]!; // día 5
    dia.servicioTrabajado.numero = 10; dia.servicioTrabajado.comida = 1;
    dia.servicioVirtual.numero = 11; dia.servicioVirtual.comida = 0;
    const rec = nuevaReclamacion();
    expect(generarReclamacion(rec, cal, 1500, 0, 0, "2026-11-02")).toBe(true); // importe dietas 15 €
    expect(rec.codigo).toBe("202610555");
    expect(rec.conceptosReclamados.some((c) => c.tipo === TipoReclamacion.DietaComida && c.importeTotal === 1500)).toBe(true);
    expect(rec.conceptosReclamados.some((c) => c.tipo === TipoReclamacion.Grafico && c.descripcion === "Gráfico diferente el día 5 (11)")).toBe(true);
    expect(rec.notas).toContain("IMPORTE TOTAL = 15,00 €");
  });
});
