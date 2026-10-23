/**
 * Port de `Servicios/Pdf.Reclamacion` (QuestPDF) del original, con pdf-lib:
 * A4, margen 30, título 16 negrita, tabla de conceptos (Fecha / Concepto /
 * Real / Cobrado / Total €) y notas con los totales. Según Opciones → Rutas
 * se dibuja el logotipo arriba a la derecha (reclamaciones e informes) y la
 * marca de agua centrada y diagonal traslúcida (solo reclamaciones). El
 * fichero se guarda con el diálogo del proceso principal
 * (`window.mercurio.guardarPdf`) y se abre con la aplicación asociada,
 * igual que hacía `Pdf.Abrir`.
 */
import {
  PDFDocument, StandardFonts, rgb, degrees,
  type PDFImage, type PDFFont, type PDFPage,
} from "pdf-lib";
import { TipoReclamacion, nombreEnum, TiposDieta, CentroTrabajo,
  type ConceptoReclamado, type Conductor, type Reclamacion } from "@mercurio/domain";
import { leerConfig } from "./configuracion";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** es-ES "N2": "1.234,56". */
function n2(v: number): string {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** es-ES "0.####": hasta 4 decimales, sin ceros finales, coma decimal. */
function unidades(v: number): string {
  const s = v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return s.replace(".", ",");
}

/** `Utilidades.Duracion`: "" si es cero; "h:mm" con horas sin rellenar y signo. */
function duracion(minutos: number): string {
  if (minutos === 0) return "";
  const signo = minutos < 0 ? "-" : "";
  const t = Math.abs(minutos);
  return `${signo}${Math.trunc(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** "AAAA-MM-DD" → "dd-MM-yyyy". */
function fechaCorta(fecha: string): string {
  return fecha === "" ? "" : `${fecha.slice(8, 10)}-${fecha.slice(5, 7)}-${fecha.slice(0, 4)}`;
}

/**
 * Valor de una columna según el tipo de concepto: unidades para los DCs/DNDs
 * pendientes y las dietas, duración para las horas, vacío en los conceptos de
 * situación/gráfico y euros en el resto (pluses).
 */
function valor(c: ConceptoReclamado, real: boolean): string {
  if ((TiposDieta as readonly number[]).includes(c.tipo)) {
    // Las dietas guardan UNIDADES en importeReal/importeCobrado (N2 del original).
    return n2(real ? c.importeReal : c.importeCobrado);
  }
  switch (c.tipo) {
    case TipoReclamacion.TotalDc:
    case TipoReclamacion.TotalDnd:
      return unidades(real ? c.importeReal : c.importeCobrado);
    case TipoReclamacion.HorasTrabajadas:
    case TipoReclamacion.HorasAcumuladas:
    case TipoReclamacion.OtraHoras:
      return duracion(real ? c.horasReales : c.horasCobradas);
    case TipoReclamacion.Grafico:
    case TipoReclamacion.Descanso:
    case TipoReclamacion.Enfermo:
    case TipoReclamacion.DC:
    case TipoReclamacion.DND:
    case TipoReclamacion.F6:
      return "";
    default:
      return n2((real ? c.importeReal : c.importeCobrado) / 100);
  }
}

interface Linea {
  texto: string;
  tamaño: number;
  negrita: boolean;
  x: number;
}

/** Dibuja una línea de texto y devuelve la "y" siguiente (hacia abajo). */
function escribir(
  pagina: PDFPage, font: PDFFont, fontNegrita: PDFFont, l: Linea, y: number,
): number {
  pagina.drawText(l.texto, { x: l.x, y, size: l.tamaño, font: l.negrita ? fontNegrita : font });
  return y - l.tamaño - 3;
}

/**
 * Incrusta en el documento la imagen de `ruta` (logotipo o marca de agua,
 * según Opciones → Rutas). Devuelve null si no hay ruta, la extensión no es
 * PNG/JPG, no hay puente (navegador) o el fichero no se puede leer: en ese
 * caso el PDF se genera igual, simplemente sin la imagen.
 */
async function incrustarImagen(doc: PDFDocument, ruta: string | undefined): Promise<PDFImage | null> {
  const limpia = (ruta ?? "").trim();
  const extension = limpia.toLowerCase().split(".").pop();
  const esPng = extension === "png";
  const esJpg = extension === "jpg" || extension === "jpeg";
  if (limpia === "" || (!esPng && !esJpg) || !window.mercurio) return null;
  try {
    const bytes = await window.mercurio.leerImagen(limpia);
    if (!bytes) return null;
    return esPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

/** Dibuja el logotipo arriba a la derecha; su cima queda en `yTope`. */
function dibujarLogo(
  pagina: PDFPage, logo: PDFImage, xDcha: number, yTope: number, altoMax = 44,
): void {
  const escala = Math.min(altoMax / logo.height, 150 / logo.width);
  const w = logo.width * escala;
  const h = logo.height * escala;
  pagina.drawImage(logo, { x: xDcha - w, y: yTope - h, width: w, height: h });
}

/**
 * Marca de agua centrada en la página y girada 45°, muy traslúcida, dibujada
 * antes que el texto para que quede por detrás del contenido.
 */
function dibujarMarca(
  pagina: PDFPage, marca: PDFImage, anchoPagina: number, altoPagina: number,
): void {
  const escala = Math.min(
    (anchoPagina * 0.5) / marca.width,
    (altoPagina * 0.45) / marca.height,
  );
  const w = marca.width * escala;
  const h = marca.height * escala;
  // pdf-lib gira antihorario alrededor del punto (x, y): se coloca el ancla
  // desplazada para que el centro rotado de la imagen caiga en el centro.
  const g = Math.PI / 4;
  const cos = Math.cos(g);
  const sin = Math.sin(g);
  pagina.drawImage(marca, {
    x: anchoPagina / 2 - ((w / 2) * cos - (h / 2) * sin),
    y: altoPagina / 2 - ((w / 2) * sin + (h / 2) * cos),
    width: w,
    height: h,
    rotate: degrees(45),
    opacity: 0.12,
  });
}

/** Genera el PDF de la reclamación (A4) y lo devuelve en bytes. */
export async function pdfReclamacion(
  r: Reclamacion,
  k: Pick<Conductor, "centro" | "matricula" | "nombre" | "apellidos">,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Reclamación ${r.codigo ?? ""}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontNegrita = await doc.embedFont(StandardFonts.HelveticaBold);

  // Logotipo (Opciones → Rutas) y marca de agua (solo reclamaciones).
  const config = await leerConfig();
  const [logo, marca] = await Promise.all([
    incrustarImagen(doc, config.LogoRuta),
    incrustarImagen(doc, config.MarcaAguaRuta),
  ]);

  const ancho = 595.28;
  const alto = 841.89;
  const margen = 30;
  const contenido = ancho - 2 * margen; // 535.28
  const abi = (contenido - 60) / 7; // ancho de las 4 columnas relativas (60 fija + 4:1:1:1)
  const base = { tamaño: 10, negrita: false, x: 0 };

  /** Página nueva con la marca de agua por detrás del contenido. */
  function nuevaPagina(): PDFPage {
    const p = doc.addPage([ancho, alto]);
    if (marca) dibujarMarca(p, marca, ancho, alto);
    return p;
  }

  // Columnas de la tabla (línea base izquierda).
  const colFecha = margen;
  const colConcepto = margen + 60;
  const colReal = margen + 60 + 4 * abi;
  const colCobrado = colReal + abi;
  const colTotal = colCobrado + abi;

  let pagina = nuevaPagina();
  let y = alto - margen;

  const esMes = r.fecha !== "" ? Number(r.fecha.slice(5, 7)) : 1;
  const añoMes = r.fecha !== "" ? r.fecha.slice(0, 4) : "";

  // Cabecera (la repite el original en cada página: la replicamos al saltar).
  function cabecera(): void {
    y = alto - margen;
    if (logo) dibujarLogo(pagina, logo, ancho - margen, y + 14);
    y = escribir(pagina, font, fontNegrita, { ...base, texto: "RECLAMACIÓN DE CONCEPTOS", tamaño: 16, negrita: true, x: margen }, y);
    y = escribir(pagina, font, fontNegrita, {
      ...base,
      texto: `Nº Reclamación: ${r.codigo ?? ""}    ·    ${MESES[esMes - 1] ?? ""} ${añoMes}`,
      x: margen,
    }, y);
    y = escribir(pagina, font, fontNegrita, {
      ...base,
      texto: `Centro: ${nombreEnum(CentroTrabajo, k.centro)}    ·    ` +
        `Trabajador/a: ${k.matricula} - ${k.nombre} ${k.apellidos}`,
      x: margen,
    }, y);
    y = escribir(pagina, font, fontNegrita, {
      ...base,
      texto: `Fecha de efecto: ${fechaCorta(r.fechaEfecto)}`,
      x: margen,
    }, y - 8);
    y -= 4;
    y = escribir(pagina, font, fontNegrita, { ...base, texto: "CONCEPTOS A RECLAMAR", negrita: true, x: margen }, y);
    y -= 3;
    const cabeceras: Array<[number, string]> = [
      [colFecha, "Fecha"], [colConcepto, "Concepto"], [colReal, "Real"], [colCobrado, "Cobrado"], [colTotal, "Total €"],
    ];
    for (const [col, texto] of cabeceras) {
      pagina.drawRectangle({ x: margen, y: y - 3, width: contenido, height: 0.7, color: rgb(0.75, 0.75, 0.75) });
      pagina.drawText(texto, { x: col, y, size: 10, font: fontNegrita });
    }
    y -= 16;
  }

  cabecera();

  const conceptos = [...r.conceptosReclamados].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const c of conceptos) {
    if (y < margen + 90) {
      pagina = nuevaPagina();
      cabecera();
    }
    pagina.drawText(fechaCorta(c.fecha), { x: colFecha, y, size: 10, font });
    pagina.drawText(
      `${c.descripcion ?? ""}${c.graficoTrabajado > 0 ? ` (Gráf. ${c.graficoTrabajado})` : ""}`,
      { x: colConcepto, y, size: 10, font, maxWidth: 4 * abi },
    );
    pagina.drawText(valor(c, true), { x: colReal + abi, y, size: 10, font, maxWidth: abi });
    pagina.drawText(valor(c, false), { x: colCobrado + abi, y, size: 10, font, maxWidth: abi });
    if (Math.round(c.importeTotal) !== 0) {
      pagina.drawText(n2(Math.round(c.importeTotal) / 100), { x: colTotal + abi, y, size: 10, font, maxWidth: abi });
    }
    y -= 13;
  }

  // Notas y firma.
  y -= 4;
  for (const linea of (r.notas ?? "").split("\n")) {
    if (y < margen + 60) {
      pagina = nuevaPagina();
      cabecera();
    }
    pagina.drawText(linea, { x: margen, y, size: 10, font });
    y -= 13;
  }
  y -= 40;
  if (y < margen) y = margen;
  pagina.drawText("El/la trabajador/a", { x: ancho - margen - font.widthOfTextAtSize("El/la trabajador/a", 10), y, size: 10, font });

  // Pie: "Mercurio - Página N" centrado en cada página.
  const paginas = doc.getPages();
  for (let i = 0; i < paginas.length; i++) {
    const texto = `Mercurio - Página ${i + 1}`;
    const w = font.widthOfTextAtSize(texto, 10);
    paginas[i].drawText(texto, { x: (ancho - w) / 2, y: 18, size: 10, font });
  }

  return doc.save();
}

/**
 * Port de `Servicios/Pdf.Informe` (QuestPDF): informe genérico con título,
 * descripción y tabla (cabecera repetida en cada página, como el Header de
 * QuestPDF). El pie del original es "Página N" centrado.
 */
export async function pdfInforme(
  titulo: string,
  descripcion: string,
  cabeceras: readonly string[],
  filas: readonly string[][],
  apaisado = false,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontNegrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblicua = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Logotipo de Opciones → Rutas (los informes no llevan marca de agua).
  const config = await leerConfig();
  const logo = await incrustarImagen(doc, config.LogoRuta);

  const ancho = apaisado ? 841.89 : 595.28;
  const alto = apaisado ? 595.28 : 841.89;
  const margen = 25;
  const contenido = ancho - 2 * margen;
  const abi = contenido / Math.max(cabeceras.length, 1);
  let pagina = doc.addPage([ancho, alto]);
  let y = alto - margen;

  // Cabecera de QuestPDF: se repite en cada página.
  function cabecera(): void {
    y = alto - margen;
    if (logo) dibujarLogo(pagina, logo, ancho - margen, y + 12, 34);
    pagina.drawText(titulo, { x: margen, y, size: 14, font: fontNegrita });
    y -= 18;
    if (descripcion !== "") {
      pagina.drawText(descripcion, { x: margen, y, size: 9, font: fontOblicua, maxWidth: contenido });
      y -= 14;
    }
    y -= 4;
    // Fila de cabeceras de la tabla (fondo gris del original).
    pagina.drawRectangle({ x: margen, y: y - 2, width: contenido, height: 13, color: rgb(0.87, 0.87, 0.87) });
    for (let i = 0; i < cabeceras.length; i++) {
      pagina.drawText(cabeceras[i] ?? "", { x: margen + 2 + i * abi, y, size: 9, font: fontNegrita, maxWidth: abi - 4 });
    }
    y -= 17;
  }

  cabecera();

  for (const fila of filas) {
    if (y < margen + 20) {
      pagina = doc.addPage([ancho, alto]);
      cabecera();
    }
    for (let i = 0; i < Math.max(fila.length, cabeceras.length); i++) {
      pagina.drawText(fila[i] ?? "", { x: margen + 2 + i * abi, y, size: 9, font, maxWidth: abi - 4 });
    }
    // Borde inferior de la celda (BorderBottom 0.5 del original).
    pagina.drawLine({
      start: { x: margen, y: y - 3 },
      end: { x: ancho - margen, y: y - 3 },
      thickness: 0.5,
      color: rgb(0.93, 0.93, 0.93),
    });
    y -= 13;
  }

  // Pie: "Página N" centrado en cada página.
  const paginas = doc.getPages();
  for (let i = 0; i < paginas.length; i++) {
    const texto = `Página ${i + 1}`;
    const w = font.widthOfTextAtSize(texto, 9);
    paginas[i].drawText(texto, { x: (ancho - w) / 2, y: 16, size: 9, font });
  }

  return doc.save();
}
