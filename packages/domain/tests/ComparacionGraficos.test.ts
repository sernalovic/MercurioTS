import { describe, expect, it } from "vitest";
import { CentroTrabajo, TipoDia, Turno } from "../src/enums";
import { Grafico, nuevoGrafico } from "../src/Entidades";
import { diferencias } from "../src/ComparacionGraficos";

// Sin test xUnit en el original; casos básicos del comportamiento del informe.
function G(numero: number, pars: Partial<Grafico> = {}): Grafico {
  return nuevoGrafico({
    numero, centro: CentroTrabajo.Bilbao, fecha: "2026-11-01",
    tipoDia: TipoDia.LunesJueves, turno: Turno.Manana,
    inicio: 6 * 60, final: 8 * 60, valoracion: 7 * 60 + 15,
    ...pars,
  });
}

describe("ComparacionGraficos.diferencias", () => {
  it("grupos vacíos no comparan", () => {
    expect(diferencias([], [], "2026-11-01", "2026-12-01")).toEqual([]);
  });

  it("campos diferentes y ausencias se listan", () => {
    const grupo1 = [G(101), G(103)];
    const grupo2 = [G(101, { final: 9 * 60 }), G(102, { turno: Turno.Tarde })];
    const r = diferencias(grupo1, grupo2, "2026-11-01", "2026-12-01");
    expect(r).toHaveLength(3);
    expect(r.find((d) => d.numero === 101)!.diferencias).toBe("Final diferente.");
    expect(r.find((d) => d.numero === 102)!.diferencias).toBe("No está en grupo <01-11-2026>.");
    expect(r.find((d) => d.numero === 103)!.diferencias).toBe("No está en grupo <01-12-2026>.");
  });

  it("gráficos idénticos no aparecen", () => {
    const r = diferencias([G(1)], [G(1)], "2026-11-01", "2026-12-01");
    expect(r).toEqual([]);
  });
});
