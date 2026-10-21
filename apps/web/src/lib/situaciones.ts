/**
 * Etiquetas de situaciones, turnos y códigos, port de las pantallas de
 * Orión 2. Los códigos salen de los enums del dominio (idénticos al original).
 * Las etiquetas raras (LAC, RE, OVA…) se muestran con su código tal cual
 * hasta confirmar su texto exacto.
 */
import { CodigoIncidencia, Incidencia, Turno } from "@mercurio/domain";

export const ETIQUETA_INCIDENCIA: Record<Incidencia, string> = {
  [Incidencia.Inactivo]: "—",
  [Incidencia.Trabajo]: "Trabajo",
  [Incidencia.TrabajoJD]: "Trabajo JD",
  [Incidencia.TrabajoFN]: "Trabajo FN",
  [Incidencia.JD]: "JD: Descanso",
  [Incidencia.FN]: "FN: Descanso en fin de semana",
  [Incidencia.DS]: "DS: Descanso suelto",
  [Incidencia.DND]: "DND: Descanso no disfrutado",
  [Incidencia.DC]: "DC: Descanso compensatorio",
  [Incidencia.F6]: "F6: Día de libre disposición",
  [Incidencia.F6DC]: "F6 + DC: Día de libre disposición con DC",
  [Incidencia.PER]: "PER: Permiso retribuido",
  [Incidencia.OV]: "OV: Vacaciones",
  [Incidencia.OVJD]: "OV: Vacaciones (JD)",
  [Incidencia.OVFN]: "OV: Vacaciones (FN)",
  [Incidencia.E]: "E: Enfermedad",
  [Incidencia.EJD]: "E: Enfermedad (JD)",
  [Incidencia.EFN]: "E: Enfermedad (FN)",
  [Incidencia.FOR]: "FOR: Formación",
  [Incidencia.FORJD]: "FOR: Formación (JD)",
  [Incidencia.FORFN]: "FOR: Formación (FN)",
  [Incidencia.OVA]: "OVA: Vacaciones atrasadas",
  [Incidencia.OVAJD]: "OVA: Vacaciones atrasadas (JD)",
  [Incidencia.OVAFN]: "OVA: Vacaciones atrasadas (FN)",
  [Incidencia.LAC]: "LAC: Lactancia",
  [Incidencia.LACJD]: "LAC: Lactancia (JD)",
  [Incidencia.LACFN]: "LAC: Lactancia (FN)",
  [Incidencia.RE]: "RE: Reducción de jornada",
  [Incidencia.DF]: "DF: Descanso festivo",
  [Incidencia.F6D]: "F6D",
};

export const ETIQUETAS_SITUACIONES = Object.entries(ETIQUETA_INCIDENCIA)
  .filter(([valor]) => Number(valor) !== Incidencia.Inactivo)
  .map(([valor, etiqueta]) => ({ valor: Number(valor), etiqueta }));

export const ETIQUETA_TURNO: Record<Turno, string> = {
  [Turno.SinTurno]: "Sin turno",
  [Turno.Manana]: "Mañana",
  [Turno.Tarde]: "Tarde",
  [Turno.Noche]: "Noche",
  [Turno.Partido]: "Partido",
};

export const ETIQUETAS_TURNOS = Object.entries(ETIQUETA_TURNO).map(([valor, etiqueta]) => ({
  valor: Number(valor),
  etiqueta,
}));

export const ETIQUETA_CODIGO: Record<CodigoIncidencia, string> = {
  [CodigoIncidencia.Ninguno]: "Sin comité",
  [CodigoIncidencia.Comite]: "Comité",
  [CodigoIncidencia.ComiteEmpresa]: "Comité empresa",
  [CodigoIncidencia.HorasSindicales]: "Horas sindicales",
};

export const ETIQUETAS_CODIGOS = Object.entries(ETIQUETA_CODIGO).map(([valor, etiqueta]) => ({
  valor: Number(valor),
  etiqueta,
}));

export const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_SEMANA = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

/** Abreviatura del día de la semana (DOM, LUN, …) de una fecha YYYY-MM-DD. */
export function inicialSemana(fecha: string): string {
  const partes = fecha.slice(0, 10).split("-");
  return DIAS_SEMANA[new Date(Date.UTC(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))).getUTCDay()];
}

/** Minutos desde medianoche → "HH:MM" (o null → cadena vacía). */
export function textoHora(minutos: number | null): string {
  if (minutos === null) return "";
  const abs = Math.abs(Math.round(minutos));
  return `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Céntimos → "0,00" con coma decimal (formato del original). */
export function textoEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Número → coma decimal con los decimales dados (pijama: dietas, pendientes). */
export function textoDecimal(valor: number, decimales = 2): string {
  return valor.toFixed(decimales).replace(".", ",");
}
