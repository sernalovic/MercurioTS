/**
 * Formato de horas y duraciones para las rejillas de gráficos: los datos
 * viajan en minutos desde medianoche (dominio); aquí se convierten a
 * "HH:mm" para editar y de vuelta.
 */

/** Minutos → "HH:mm" (null → ""). */
export function hora(min: number | null): string {
  if (min === null) return "";
  const t = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Duración → "HH:mm" sobre el total (72:30), null → "". */
export function duracion(min: number | null): string {
  if (min === null) return "";
  const horas = Math.floor(min / 60);
  return `${String(horas).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Parse de una celda de hora "HH:mm" (o "H:mm:ss") → minutos, null si vacía. */
export function minutosDeHora(texto: string): number | null {
  const t = texto.trim();
  if (t === "") return null;
  const m = /^(\d{1,3}):(\d{1,2})(:(\d{1,2}))?$/.exec(t);
  if (m === null) return null;
  const v = Number(m[1]) * 60 + Number(m[2]) + Number(m[3] ?? "0");
  return Number.isFinite(v) ? v : null;
}

/** Dinero en céntimos → texto decimal "0.###". */
export function euros(c: number): string {
  return (c / 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

/** Texto decimal "0.###" → céntimos ("" → 0). */
export function centimosDe(texto: string): number {
  const t = texto.trim().replace(",", ".");
  if (t === "") return 0;
  const v = Number(t);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
}

/** Unidades de dietas → "0.##". */
export function unidades(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/**
 * Parse de `Utilidades.ParseHora` del original: acepta "hh:mm", "hh.mm",
 * "hh,mm", "hhmm" o "h"; vacío o no válido → null. Devuelve minutos.
 */
export function parseHora(texto: string): number | null {
  if (texto.trim() === "") return null;
  let t = texto.trim().replace(".", ":").replace(",", ":");
  if (!t.includes(":") && t.length > 2) t = `${t.slice(0, -2)}:${t.slice(-2)}`;
  const partes = t.split(":");
  const h = Number(partes[0]);
  if (!Number.isInteger(h)) return null;
  const m = partes.length > 1 && partes[1] !== "" && Number.isInteger(Number(partes[1])) ? Number(partes[1]) : 0;
  return h * 60 + m;
}

/** `Utilidades.Duracion` del original: horas totales con signo; "" si es cero. */
export function duracionC(min: number | null): string {
  if (min === null || min === 0) return "";
  const s = min < 0 ? "-" : "";
  const a = Math.abs(min);
  return `${s}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}

/** Importe en céntimos → "0.##" como mostraba el original (`StringFormat=0.##`). */
export function importe(c: number): string {
  return (Math.round(c) / 100).toFixed(2).replace(/0$/, "").replace(/\.$/, "");
}
