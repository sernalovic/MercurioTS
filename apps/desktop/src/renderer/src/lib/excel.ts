/**
 * Port de `Servicios/Excel.Tabla` (ClosedXML): genera un .xlsx en memoria
 * con una hoja, fila de cabeceras en negrita y las filas de datos. Los
 * importes/porcentajes se escriben como números (los textos, como texto),
 * igual que hacía `XLCellValue.FromObject`.
 */
import ExcelJS from "exceljs";

export type CeldaExcel = string | number | boolean | null | undefined;

export async function excelTabla(
  hoja: string,
  cabeceras: readonly string[],
  filas: readonly CeldaExcel[][],
): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook();
  const ws = libro.addWorksheet(hoja);
  const filaCab = ws.addRow(cabeceras as ExcelJS.CellValue[]);
  filaCab.font = { bold: true };
  for (const fila of filas) {
    ws.addRow(fila.map((v) => (v === undefined ? null : v)) as ExcelJS.CellValue[]);
  }
  // `AdjustToContents` del original: anchura por contenido (máx. razonable).
  ws.columns.forEach((c) => { c.width = 16; });
  const datos = await libro.xlsx.writeBuffer();
  return new Uint8Array(datos as ArrayBuffer);
}
