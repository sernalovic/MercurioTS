/**
 * Conversores entre las convenciones del dominio (minutos desde medianoche,
 * céntimos) y las del esquema PostgreSQL del original (`interval`, `numeric`).
 */

/** `interval` de Postgres ("07:20:00", "1 day 06:00:00", negativos incluidos) → minutos. */
export function aMinutos(intervalo: string): number {
  const m = /(-)?(?:(\d+) day[sa]? )?(\d+):(\d{2}):?(\d{2})?/.exec(intervalo.trim());
  if (m === null) throw new Error(`Intervalo no reconocido: "${intervalo}"`);
  const signo = m[1] === undefined ? 1 : -1;
  const dias = m[2] === undefined ? 0 : Number(m[2]);
  const horas = m[3] === undefined ? 0 : Number(m[3]);
  const minutos = m[4] === undefined ? 0 : Number(m[4]);
  return signo * (dias * 24 * 60 + horas * 60 + minutos);
}

/** Minutos → `interval` de Postgres en formato "HHH:MM:SS" (horas pueden pasar de 24 o ser negativas). */
export function aIntervalo(minutos: number): string {
  const signo = minutos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutos));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${signo}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** `numeric` de Postgres (dinero en euros como texto) → céntimos enteros. */
export function aCentimos(numerico: string): number {
  return Math.round(Number(numerico) * 100);
}

/** Céntimos → `numeric` de Postgres con exacto dos decimales. */
export function aNumerico(cents: number): string {
  const c = Math.round(cents);
  const signo = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** `numeric` de Postgres que representa una cantidad (unidades, porcentaje) → número. */
export function aNumero(numerico: string): number {
  return Number(numerico);
}

/** Número de unidades → `numeric` de Postgres. */
export function aTextoNumerico(valor: number): string {
  return String(valor);
}
