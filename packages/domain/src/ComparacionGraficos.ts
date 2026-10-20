/**
 * Port de `Mercurio.Domain/Calculos/ComparacionGraficos.cs`.
 * Comparación gráfico a gráfico entre dos grupos (informe "Comparar grupos de gráficos").
 * Horas en minutos; `TimeSpan?` → `number | null`.
 */
import { Grafico } from "./Entidades";

/** Diferencias de un gráfico entre dos grupos (suma de textos; "" si son idénticos y existen en ambos). */
export interface DiferenciaGrafico {
  numero: number;
  diferencias: string;
}

/** "dd-MM-yyyy" desde una fecha "YYYY-MM-DD" (formato de los mensajes del original). */
function ddMMyyyy(fecha: string): string {
  return `${fecha.slice(8, 10)}-${fecha.slice(5, 7)}-${fecha.slice(0, 4)}`;
}

export function diferencias(
  grupo1: readonly Grafico[], grupo2: readonly Grafico[], fecha1: string, fecha2: string,
): DiferenciaGrafico[] {
  const resultado: DiferenciaGrafico[] = [];
  if (grupo1.length === 0 || grupo2.length === 0) return resultado;
  const numeros = [...new Set([...grupo1, ...grupo2].map((g) => g.numero))].sort((a, b) => a - b);
  for (const numero of numeros) {
    const a = grupo1.find((g) => g.numero === numero);
    const b = grupo2.find((g) => g.numero === numero);
    const difs: string[] = [];
    if (a === undefined) difs.push(`No está en grupo <${ddMMyyyy(fecha1)}>.`);
    if (b === undefined) difs.push(`No está en grupo <${ddMMyyyy(fecha2)}>.`);
    if (a !== undefined && b !== undefined) {
      if (a.turno !== b.turno) difs.push("Turno diferente.");
      if (a.inicio !== b.inicio) difs.push("Inicio diferente.");
      if (a.final !== b.final) difs.push("Final diferente.");
      if (a.inicioPartido !== b.inicioPartido) difs.push("Inicio partido diferente.");
      if (a.finalPartido !== b.finalPartido) difs.push("Final partido diferente.");
      if (a.valoracion !== b.valoracion) difs.push("Valoración diferente.");
    }
    if (difs.length > 0) resultado.push({ numero, diferencias: difs.join(" ") });
  }
  return resultado;
}
