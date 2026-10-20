/**
 * Port de `Mercurio.Domain/Calculos/ExtraccionGraficos.cs`.
 * Genera los gráficos de un grupo a partir del texto extraído de los PDF
 * de gráficos de la empresa (REGLAS-CALCULO.md 16).
 *
 * Las horas son minutos desde medianoche; `TimeSpan?` → `number | null`.
 */
import * as Horas from "./Horas";
import { CentroTrabajo, TipoDia, Turno } from "./enums";
import {
  Itinerario as ItinerarioEntidad,
  ItinerarioGrafico,
  Grafico,
  nuevoGrafico, nuevoItinerarioGrafico,
} from "./Entidades";

/** Gráficos generados a partir del texto y avisos sobre las líneas que no se han podido usar. */
export interface ResultadoExtraccion {
  graficos: Grafico[];
  avisos: string[];
}

const HORA = "([01]?[0-9]|2[0-3]):[0-5][0-9]";

const horasConA = new RegExp(`${HORA} a ${HORA}`);
const horasConGuion = new RegExp(`${HORA}-${HORA}`);
const reserva = new RegExp(`^Reserva de (${HORA} ${HORA})$`, "i");
const horaSuelta = /^\d{1,2}:\d{2}$/;
const entero = /\d+/;
const horaEnTexto = /\d{1,2}:\d{2}/;
const espacios = /[ \t]+/g;

const DIAS: readonly (readonly [string, TipoDia])[] = [
  ["lunes", TipoDia.LunesJueves], ["viernes", TipoDia.Viernes],
  ["sábado", TipoDia.Sabado], ["sabado", TipoDia.Sabado], ["festivos", TipoDia.Festivo],
];

const CENTROS: readonly (readonly [string, CentroTrabajo])[] = [
  ["donosti", CentroTrabajo.Donosti], ["bilbao", CentroTrabajo.Bilbao], ["arrasate", CentroTrabajo.Arrasate],
  ["vitoria", CentroTrabajo.Vitoria], ["gasteiz", CentroTrabajo.Vitoria], ["pruebas", CentroTrabajo.Pruebas],
];

/**
 * Genera los gráficos de un grupo.
 * @param texto Texto de todas las páginas.
 * @param fecha Fecha de validez del grupo (YYYY-MM-DD, sin parte de hora).
 * @param catalogo Itinerarios de las líneas, para calcular el final a partir del número de itinerario.
 * @param centroInicial Centro de los gráficos hasta que el texto nombre otro.
 */
export function extraer(
  texto: string, fecha: string, catalogo: readonly ItinerarioEntidad[],
  centroInicial: CentroTrabajo = CentroTrabajo.Todos,
): ResultadoExtraccion {
  const tiemposPago = new Map<number, number>();
  for (const i of catalogo) {
    const n = Number(i.nombre.trim());
    if (Number.isInteger(n) && i.nombre.trim() !== "") {
      if (!tiemposPago.has(n)) tiemposPago.set(n, i.tiempoPago);
    }
  }

  const graficos: Grafico[] = [];
  const avisos: string[] = [];
  let centro = centroInicial;
  let tipoDia = TipoDia.Ninguno;
  let grafico: Grafico | null = null;
  let inicio: number | null = null;
  let final: number | null = null;
  let pendiente = "";

  const lineas = texto
    .split("\n")
    .map((l) => l.replace(espacios, " ").trim())
    .filter((l) => l.length > 0);

  for (const linea of lineas) {
    if (grafico === null) {
      const diaKey = buscar(linea, DIAS);
      const centroKey = buscar(linea, CENTROS);
      if (diaKey !== undefined) tipoDia = diaKey;
      else if (centroKey !== undefined) centro = centroKey;
      else if (empieza(linea, "grafikoa")) {
        const numero = entero.exec(linea);
        if (numero === null) {
          avisos.push(`Línea de gráfico sin número: "${linea}".`);
          continue;
        }
        const num = Number(numero[0]);
        if (!Number.isInteger(num)) {
          avisos.push(`Línea de gráfico sin número: "${linea}".`);
          continue;
        }
        grafico = nuevoGrafico({
          centro, tipoDia, fecha, numero: num,
          turno: num % 2 === 0 ? Turno.Tarde : Turno.Manana,
        });
      }
      continue;
    }

    if (empieza(linea, "balorazioa")) {
      const valor = horaEnTexto.exec(linea);
      grafico.inicio = inicio;
      grafico.final = final;
      const v = valor !== null ? parseHora(valor[0]) : null;
      grafico.valoracion = v ?? 0;
      graficos.push(grafico);
      grafico = null;
      inicio = final = null;
      continue;
    }

    const itin = extraerItinerario(linea, tiemposPago);
    if (itin === null) continue;
    const ultimo = grafico.itinerarios.length > 0
      ? grafico.itinerarios[grafico.itinerarios.length - 1]!
      : null;

    if (itin.inicio === null && itin.descripcion !== null) {
      itin.descripcion = itin.descripcion.replaceAll("vacio", "vacío").replaceAll("Vacio", "Vacío");
      if (ultimo !== null && itin.descripcion.toLowerCase().startsWith("vacío")) {
        itin.inicio = ultimo.final;
      }
    }

    if (itin.inicio === null) {
      if (ultimo === null) pendiente = unir(pendiente, itin.descripcion);
      else {
        ultimo.descripcion = unir(ultimo.descripcion, itin.descripcion);
        pendiente = "";
      }
      continue;
    }

    if (inicio === null) inicio = itin.inicio;
    if (itin.final !== null) final = itin.final;
    if (pendiente.length > 0) {
      itin.descripcion = unir(pendiente, itin.descripcion);
      pendiente = "";
    }
    grafico.itinerarios.push(itin);
  }

  if (grafico !== null) {
    avisos.push(`El gráfico ${grafico.numero} no termina con una línea "balorazioa" y se ha descartado.`);
  }
  return { graficos, avisos };
}

/** Interpreta una línea de itinerario (16.3). Devuelve null si la línea no tiene contenido. */
export function extraerItinerario(
  lineaOriginal: string, tiemposPago: ReadonlyMap<number, number>,
): ItinerarioGrafico | null {
  let linea = lineaOriginal;
  // C# restringe los cambios al texto coincidente de la primera coincidencia de cada patrón.
  const conA = horasConA.exec(linea);
  if (conA !== null) {
    linea = linea.slice(0, conA.index) + conA[0].replaceAll(" a ", " ") + linea.slice(conA.index + conA[0].length);
  }
  const conGuion = horasConGuion.exec(linea);
  if (conGuion !== null) {
    linea = linea.slice(0, conGuion.index) + conGuion[0].replaceAll("-", " ") + linea.slice(conGuion.index + conGuion[0].length);
  }
  const res = reserva.exec(linea);
  if (res !== null) linea = `${res[1]} Reserva`;

  const partes = linea.split(" ").filter((p) => p !== "");
  if (partes.length === 0) return null;

  const itin = nuevoItinerarioGrafico();
  const ini = parseHora(partes[0]!);
  if (ini === null) {
    itin.descripcion = linea;
    return itin;
  }
  itin.inicio = ini;
  if (partes.length === 1) return itin;

  let resto = 2;
  const numero = Number(partes[1]!);
  if (esEntero(partes[1]!)) {
    itin.itinerario = partes[1]!;
    const minutos = tiemposPago.get(numero);
    if (minutos !== undefined) itin.final = horaDelDia(ini + minutos);
  } else {
    const fin = parseHora(partes[1]!);
    if (fin !== null) itin.final = fin;
    else resto = 1;
  }

  if (itin.final !== null) itin.tiempoTotal = Horas.Duracion(itin.inicio, itin.final);
  const descripcion = partes.slice(resto).join(" ");
  itin.descripcion = descripcion.length > 0 ? descripcion : null;
  return itin;
}

/** int.TryParse del C# sobre una parte exacta (sin espacios, opcionalmente con signo). */
function esEntero(texto: string): boolean {
  return /^[+-]?\d+$/.test(texto) && Number.isInteger(Number(texto));
}

function parseHora(texto: string): number | null {
  if (!horaSuelta.test(texto)) return null;
  const p = texto.split(":");
  const h = Number.parseInt(p[0]!, 10);
  const m = Number.parseInt(p[1]!, 10);
  return h < 24 && m < 60 ? h * 60 + m : null;
}

/** Reduce una hora al día en curso, como el módulo de `Horas.UnDia` del original. */
function horaDelDia(t: number): number {
  return ((t % Horas.UN_DIA) + Horas.UN_DIA) % Horas.UN_DIA;
}

function empieza(linea: string, clave: string): boolean {
  return linea.toLowerCase().startsWith(clave.toLowerCase());
}

function buscar<T extends string | number>(linea: string, claves: readonly (readonly [string, T])[]): T | undefined {
  for (const [clave, valor] of claves) {
    if (empieza(linea, clave)) return valor;
  }
  return undefined;
}

function unir(a: string | null, b: string | null): string {
  if (a === null || a === "") return b ?? "";
  if (b === null || b === "") return a;
  return `${a}\n${b}`;
}
