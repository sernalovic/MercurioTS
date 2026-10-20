import { describe, expect, it } from "vitest";
import { CentroTrabajo, TipoDia, Turno } from "../src/enums";
import { nuevoItinerario } from "../src/Entidades";
import { extraer, extraerItinerario } from "../src/ExtraccionGraficos";

// Espejo de ExtraccionGraficosTests.cs (REGLAS-CALCULO.md 16).
// H(h, m) = hora en minutos desde medianoche.
const H = (h: number, m = 0): number => h * 60 + m;
const FECHA = "2026-11-01";
const CATALOGO = [
  nuevoItinerario({ nombre: "12", tiempoPago: 45 }),
  nuevoItinerario({ nombre: "30", tiempoPago: 30 }),
];
const TIEMPOS = new Map([[12, 45]]);

describe("ExtraccionGraficos.extraer", () => {
  it("palabras clave fijan centro, tipo de día y turno por paridad", () => {
    const texto = `
      BILBAO
      Viernes
      Grafikoa 101
      06:00 a 08:00 Línea 1
      Balorazioa 7:15
      GRAFIKOA 102
      14:00-15:30
      balorazioa
      `;
    const r = extraer(texto, FECHA, CATALOGO);
    expect(r.avisos).toHaveLength(0);
    expect(r.graficos).toHaveLength(2);
    const [g1, g2] = [r.graficos[0]!, r.graficos[1]!];
    expect(g1.numero).toBe(101);
    expect(g1.centro).toBe(CentroTrabajo.Bilbao);
    expect(g1.tipoDia).toBe(TipoDia.Viernes);
    expect(g1.turno).toBe(Turno.Manana);
    expect(g1.inicio).toBe(H(6));
    expect(g1.final).toBe(H(8));
    expect(g1.valoracion).toBe(H(7, 15));
    expect(g1.itinerarios).toHaveLength(1);
    expect(g1.itinerarios[0]!.descripcion).toBe("Línea 1");
    expect(g2.numero).toBe(102);
    expect(g2.turno).toBe(Turno.Tarde);
    expect(g2.inicio).toBe(H(14));
    expect(g2.final).toBe(H(15, 30));
    expect(g2.valoracion).toBe(0);
    expect(g2.itinerarios[0]!.tiempoTotal).toBe(H(1, 30));
  });

  it("palabras clave de día dentro de un gráfico son texto", () => {
    const texto = "Grafikoa 1\n07:00 08:00\nlunes por la mañana\nbalorazioa 1:00";
    const g = extraer(texto, FECHA, CATALOGO).graficos[0]!;
    expect(g.tipoDia).toBe(TipoDia.Ninguno);
    expect(g.itinerarios[0]!.descripcion).toBe("lunes por la mañana");
  });

  it("texto pendiente se antepone y texto posterior se añade al último", () => {
    const texto = "Grafikoa 3\nCochera\nSalida\n06:00 06:30 Ida\nVuelta por Hernani\nbalorazioa 0:30";
    const g = extraer(texto, FECHA, CATALOGO).graficos[0]!;
    expect(g.itinerarios[0]!.descripcion).toBe("Cochera\nSalida\nIda\nVuelta por Hernani");
  });

  it("vacío hereda el final del último itinerario", () => {
    const texto = "Grafikoa 4\n06:00 12 Ida\nVacio a cochera\n07:00 07:20\nbalorazioa 1:20";
    const g = extraer(texto, FECHA, CATALOGO).graficos[0]!;
    expect(g.itinerarios).toHaveLength(3);
    const vacio = g.itinerarios[1]!;
    expect(vacio.descripcion).toBe("Vacío a cochera");
    expect(vacio.inicio).toBe(H(6, 45));
    expect(vacio.final).toBeNull();
    expect(g.inicio).toBe(H(6));
    expect(g.final).toBe(H(7, 20));
  });

  it("gráfico abierto o sin número genera avisos", () => {
    const r = extraer("Grafikoa\nGrafikoa 7\n08:00 09:00", FECHA, CATALOGO);
    expect(r.graficos).toHaveLength(0);
    expect(r.avisos).toHaveLength(2);
  });

  it("líneas fuera de gráfico se ignoran y se normalizan espacios", () => {
    const texto = "Cabecera del PDF\r\n   donosti  \r\n\r\nFestivos\r\nGrafikoa   20\r\n  10:00   a   11:00  \r\nBalorazioa 1:00\r\n";
    const g = extraer(texto, FECHA, CATALOGO).graficos[0]!;
    expect(g.centro).toBe(CentroTrabajo.Donosti);
    expect(g.tipoDia).toBe(TipoDia.Festivo);
    expect(g.inicio).toBe(H(10));
    expect(g.final).toBe(H(11));
  });
});

describe("ExtraccionGraficos.extraerItinerario", () => {
  it("número de itinerario del catálogo calcula el final (cruce de medianoche)", () => {
    const i = extraerItinerario("23:30 12 Ida   Irun", TIEMPOS)!;
    expect(i.itinerario).toBe("12");
    expect(i.inicio).toBe(H(23, 30));
    expect(i.final).toBe(H(0, 15));
    expect(i.tiempoTotal).toBe(H(0, 45));
    expect(i.descripcion).toBe("Ida Irun");
  });

  it("número de itinerario desconocido deja el final vacío", () => {
    const i = extraerItinerario("10:00 99 Algo", TIEMPOS)!;
    expect(i.itinerario).toBe("99");
    expect(i.inicio).toBe(H(10));
    expect(i.final).toBeNull();
    expect(i.descripcion).toBe("Algo");
  });

  it("reserva se normaliza", () => {
    for (const linea of ["Reserva de 05:00 06:00", "reserva de 5:00 6:00"]) {
      const i = extraerItinerario(linea, TIEMPOS)!;
      expect(i.inicio).toBe(H(5));
      expect(i.final).toBe(H(6));
      expect(i.descripcion).toBe("Reserva");
    }
  });

  it("línea sin hora es descripción y hora suelta es solo inicio", () => {
    const texto = extraerItinerario("Cambio de bus", TIEMPOS)!;
    expect(texto.descripcion).toBe("Cambio de bus");
    expect(texto.inicio).toBeNull();
    const solo = extraerItinerario("9:15", TIEMPOS)!;
    expect(solo.inicio).toBe(H(9, 15));
    expect(solo.final).toBeNull();
    expect(solo.descripcion).toBeNull();
    expect(extraerItinerario("9:15 Taller", TIEMPOS)!.descripcion).toBe("Taller");
  });
});
