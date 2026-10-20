/**
 * Fechas "YYYY-MM-DD" sin zona horaria. Todos los cálculos de día de la semana
 * usan UTC para no depender de la zona local ni de los horarios de verano.
 */

/** Día de la semana: 0 = domingo … 6 = sábado (como getUTCDay / DayOfWeek de .NET). */
export function diaDeLaSemana(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

export function esFinDeSemana(fecha: string): boolean {
  const d = diaDeLaSemana(fecha);
  return d === 0 || d === 6;
}

/** Días que tiene el mes (mes 1–12). */
export function diasEnMes(año: number, mes: number): number {
  return new Date(Date.UTC(año, mes, 0)).getUTCDate();
}

export function año(fecha: string): number {
  return Number(fecha.slice(0, 4));
}

export function mes(fecha: string): number {
  return Number(fecha.slice(5, 7));
}

export function dia(fecha: string): number {
  return Number(fecha.slice(8, 10));
}

export function añoMes(fecha: string): string {
  return fecha.slice(0, 7);
}

/** "2026-10-05" desde partes enteras. */
export function fecha(año: number, mes: number, dia: number): string {
  return `${String(año).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
