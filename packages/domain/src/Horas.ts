/**
 * Horas del día como `TimeSpan` en C# → minutos desde medianoche aquí.
 * Port inicial de Mercurio.Domain/Calculos (ver contracts en el README).
 */

/** Duración en minutos entre dos instantes del día; cruza medianoches si `fin <= inicio`. */
export function Duracion(inicio: number, fin: number): number {
  const finAjustado = fin <= inicio ? fin + 24 * 60 : fin;
  return finAjustado - inicio;
}
