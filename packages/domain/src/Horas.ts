/**
 * Port de `Mercurio.Domain/Calculos/Utilidades.cs` (clase estática Horas).
 * Convenio de representación: los `TimeSpan` de C# son **minutos desde medianoche**
 * (0–1439, pueden pasar de 1440 al cruzar medianoches); `TimeSpan?` → `number | null`.
 */

export const UN_DIA = 24 * 60;

/** Duración entre dos horas del día en minutos; `null` → 0. Si el final es anterior al inicio, cruza la medianoche. */
export function Duracion(inicio: number | null, final: number | null): number {
  if (inicio === null || final === null) return 0;
  const d = final - inicio;
  return d < 0 ? d + UN_DIA : d;
}

/** Duración en horas decimales redondeada a 6 decimales, como `Horas.EnHoras` del original. */
export function EnHoras(minutos: number): number {
  return Math.round((minutos / 60) * 1e6) / 1e6;
}

export function Max(a: number, b: number): number {
  return a > b ? a : b;
}

/** Interpreta decimales con coma u "€", como `Horas.ParseDecimal`. */
export function ParseDecimal(texto: string | null | undefined): number {
  if (texto === null || texto === undefined || texto.trim() === "") return 0;
  const limpio = texto.replaceAll(",", ".").replaceAll("€", "");
  const v = Number.parseFloat(limpio);
  return Number.isNaN(v) ? 0 : v;
}
