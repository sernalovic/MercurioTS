/**
 * Port de `Mercurio.Domain/Calculos/Incidencias.cs`:
 * clasificación y conversión de incidencias (situaciones de un día).
 */
import { CodigoIncidencia, Incidencia, TipoDia } from "./enums";
import { diaDeLaSemana } from "./Fechas";

const Descansos = new Set<Incidencia>([
  Incidencia.TrabajoJD, Incidencia.TrabajoFN, Incidencia.JD, Incidencia.FN, Incidencia.DS,
  Incidencia.OVJD, Incidencia.OVFN, Incidencia.EJD, Incidencia.EFN, Incidencia.FORJD, Incidencia.FORFN,
  Incidencia.OVAJD, Incidencia.OVAFN, Incidencia.LACJD, Incidencia.LACFN,
]);

const DescansosJD = new Set<Incidencia>([
  Incidencia.JD, Incidencia.DS, Incidencia.OVJD, Incidencia.EJD, Incidencia.FORJD, Incidencia.OVAJD, Incidencia.LACJD,
]);

const DescansosFN = new Set<Incidencia>([
  Incidencia.FN, Incidencia.OVFN, Incidencia.EFN, Incidencia.FORFN, Incidencia.OVAFN, Incidencia.LACFN,
]);

/** Pares (variante JD, variante FN) de las incidencias que cambian según caigan entre semana o en fin de semana. */
export const variantesDescanso: ReadonlyArray<readonly [Incidencia, Incidencia]> = [
  [Incidencia.JD, Incidencia.FN], [Incidencia.TrabajoJD, Incidencia.TrabajoFN], [Incidencia.EJD, Incidencia.EFN],
  [Incidencia.FORJD, Incidencia.FORFN], [Incidencia.LACJD, Incidencia.LACFN], [Incidencia.OVAJD, Incidencia.OVAFN],
  [Incidencia.OVJD, Incidencia.OVFN],
];

export function esTrabajo(inc: Incidencia, numero: number): boolean {
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

export function esDescanso(inc: Incidencia): boolean {
  return Descansos.has(inc);
}

export function esDescansoJD(inc: Incidencia): boolean {
  return DescansosJD.has(inc);
}

export function esDescansoFN(inc: Incidencia): boolean {
  return DescansosFN.has(inc);
}

export function esFormacion(inc: Incidencia): boolean {
  return inc === Incidencia.FOR || inc === Incidencia.FORJD || inc === Incidencia.FORFN;
}

/** Al asignar una situación sobre un día de descanso, usa su variante JD/FN. */
export function asignar(actual: Incidencia, nueva: Incidencia): Incidencia {
  const [jd, fn] = (() => {
    switch (nueva) {
      case Incidencia.Trabajo: return [Incidencia.TrabajoJD, Incidencia.TrabajoFN] as const;
      case Incidencia.E: return [Incidencia.EJD, Incidencia.EFN] as const;
      case Incidencia.OV: return [Incidencia.OVJD, Incidencia.OVFN] as const;
      case Incidencia.OVA: return [Incidencia.OVAJD, Incidencia.OVAFN] as const;
      case Incidencia.LAC: return [Incidencia.LACJD, Incidencia.LACFN] as const;
      case Incidencia.FOR: return [Incidencia.FORJD, Incidencia.FORFN] as const;
      default: return [nueva, nueva] as const;
    }
  })();
  if (esDescansoJD(actual)) return jd;
  if (esDescansoFN(actual)) return fn;
  return nueva;
}

const Abreviaturas: Readonly<Record<string, Incidencia>> = {
  i: Incidencia.Inactivo, in: Incidencia.Inactivo, inac: Incidencia.Inactivo, inactivo: Incidencia.Inactivo,
  t: Incidencia.Trabajo, l: Incidencia.Trabajo, tra: Incidencia.Trabajo, trab: Incidencia.Trabajo, trabajo: Incidencia.Trabajo,
  tjd: Incidencia.TrabajoJD, trajd: Incidencia.TrabajoJD, trabjd: Incidencia.TrabajoJD, trabajojd: Incidencia.TrabajoJD,
  tfn: Incidencia.TrabajoFN, trafn: Incidencia.TrabajoFN, trabfn: Incidencia.TrabajoFN, trabajofn: Incidencia.TrabajoFN,
  jd: Incidencia.JD, fn: Incidencia.FN, ds: Incidencia.DS, dc: Incidencia.DC, oh: Incidencia.DC,
  dnd: Incidencia.DND, f6: Incidencia.F6, f6d: Incidencia.F6D, f6dc: Incidencia.F6DC,
  df: Incidencia.DF, per: Incidencia.PER, e: Incidencia.E, ge: Incidencia.E,
  ejd: Incidencia.EJD, efn: Incidencia.EFN, ov: Incidencia.OV, ovjd: Incidencia.OVJD,
  ovfn: Incidencia.OVFN, ova: Incidencia.OVA, ovajd: Incidencia.OVAJD, ovafn: Incidencia.OVAFN,
  for: Incidencia.FOR, forjd: Incidencia.FORJD, forfn: Incidencia.FORFN,
  lac: Incidencia.LAC, lacjd: Incidencia.LACJD, lacfn: Incidencia.LACFN,
  re: Incidencia.RE, rj: Incidencia.RE, rjor: Incidencia.RE, rej: Incidencia.RE,
};

/** Nombre del valor de un enum numérico de TS (equivale a ToString() de C#). */
function nombreEnum(enumObj: Record<string, number | string>, valor: number): string {
  return (Object.keys(enumObj) as string[]).find((k) => typeof enumObj[k] === "number" && enumObj[k] === valor) ?? valor.toString();
}

/** Interpreta el texto de una celda de calendario: un número es un gráfico trabajado. */
export function parse(texto: string | null): { incidencia: Incidencia; numero: number } {
  if (texto === null || texto.trim() === "") return { incidencia: Incidencia.Inactivo, numero: 0 };
  const limpio = texto.replaceAll("*", "").replaceAll(">", "").replaceAll(" ", "");
  const numero = Number.parseInt(limpio, 10);
  if (!Number.isNaN(numero) && /^-?\d+$/.test(limpio)) return { incidencia: Incidencia.Trabajo, numero };
  const clave = limpio.toLowerCase().replaceAll("-", "");
  const inc = Abreviaturas[clave];
  return inc !== undefined ? { incidencia: inc, numero: 0 } : { incidencia: Incidencia.Inactivo, numero: 0 };
}

/** Texto que se muestra en una celda de calendario para un servicio. */
export function texto(inc: Incidencia, numero: number, codigo: CodigoIncidencia): string {
  let t: string | null = null;
  if (inc === Incidencia.Trabajo || inc === Incidencia.TrabajoJD || inc === Incidencia.TrabajoFN) t = numero.toString();
  if (inc === Incidencia.RE && numero > 0) t = numero.toString();
  if (t === null && inc !== Incidencia.Inactivo) t = nombreEnum(Incidencia as unknown as Record<string, number>, inc);
  if (t !== null && (codigo !== CodigoIncidencia.Ninguno || inc === Incidencia.TrabajoFN || inc === Incidencia.TrabajoJD)) t += "*";
  if (inc === Incidencia.RE && numero > 0) if (t !== null) t += "*";
  return t ?? "";
}

export function abreviatura(inc: Incidencia): string {
  switch (inc) {
    case Incidencia.Trabajo: return "Trab";
    case Incidencia.TrabajoJD: return "Trab-JD";
    case Incidencia.TrabajoFN: return "Trab-FN";
    default: return nombreEnum(Incidencia as unknown as Record<string, number>, inc);
  }
}

/** Tipo de día de una fecha del calendario: domingo → festivo, sábado → sábado… */
export function tipoDiaPorFecha(fecha: string): TipoDia {
  const dow = diaDeLaSemana(fecha);
  switch (dow) {
    case 0: return TipoDia.Festivo;
    case 6: return TipoDia.Sabado;
    case 5: return TipoDia.Viernes;
    default: return TipoDia.LunesJueves;
  }
}
