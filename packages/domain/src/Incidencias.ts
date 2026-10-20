/**
 * Port (parcial) de `Mercurio.Domain/Calculos/Incidencias.cs`.
 * Solo `EsTrabajo` por ahora; el resto (descansos, variantes JD/FN, parseado de
 * celdas…) se llevará al portar su módulo al completo.
 */
import { Incidencia } from "./enums";

export function EsTrabajo(inc: Incidencia, numero: number): boolean {
  switch (inc) {
    case Incidencia.Trabajo:
    case Incidencia.TrabajoJD:
    case Incidencia.TrabajoFN:
    case Incidencia.FOR:
      return true;
    case Incidencia.RE:
      return numero > 0;
    default:
      return false;
  }
}
