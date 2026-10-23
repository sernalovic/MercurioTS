/**
 * Rejilla de calendarios compartida por las pantallas de Calendarios y
 * de Calendarios por conductor: una fila por calendario con una celda
 * de situación por día del mes (solo los días existentes del mes, como
 * en Orión 2), sábados y festivos coloreados y las situaciones con el
 * color del original (FN rojo, JD/DS azul, OV verde, DC azul, RE rojo).
 * Doble clic en una fila abre su detalle si la pantalla lo permite.
 */
import type { ReactNode } from "react";

export interface DiaCal {
  id: number;
  fecha: string;
  esFestivo: boolean;
  situacion: string;
  remoto: boolean;
}

export interface CabCalendario {
  id: number;
  conductorId: number;
  centro: number;
  fecha: string;
  categoria: number;
  situacion: number;
  matricula: number;
  tieneDiferenciasEnContra: boolean;
  dias: DiaCal[];
}

/** Clase de color de la situación, como en Orión 2 (celdas de la rejilla). */
function claseSituacion(s: string): string {
  const t = s.trim().toUpperCase();
  if (t.startsWith("OV")) return "sitVerde";
  if (t === "FN" || t === "RE") return "sitRojo";
  if (t === "JD" || t === "DS" || t === "DC") return "sitAzul";
  if (t.startsWith("DND")) return "sitNegro";
  return "";
}

export function RejillaCalendarios({ filas, seleccion, onSeleccion, onDetalle, fechaMes }: {
  filas: CabCalendario[];
  seleccion: number | null;
  onSeleccion: (id: number) => void;
  /** Doble clic en una fila: abre el detalle del calendario (opcional). */
  onDetalle?: (idCalendario: number) => void;
  /** Mes mostrado ("AAAA-MM"): la rejilla solo pinta sus días. */
  fechaMes?: string;
}): ReactNode {
  const numDias = fechaMes !== undefined
    ? new Date(Number(fechaMes.slice(0, 4)), Number(fechaMes.slice(5, 7)), 0).getDate()
    : 31;

  return (
    <div className="marcoRejilla">
      <table className="rejilla rejillaDias">
        <thead>
          <tr>
            <th className="matriculas">Matrícula</th>
            {Array.from({ length: numDias }, (_, i) => (
              <th key={i} className="dia">{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const año = Number(f.fecha.slice(0, 4));
            const mes = Number(f.fecha.slice(5, 7));
            const porDia = new Map(f.dias.map((d) => [Number(d.fecha.slice(8, 10)), d]));
            return (
              <tr
                key={f.id}
                className={seleccion === f.id ? "sel" : undefined}
                onClick={() => onSeleccion(f.id)}
                onDoubleClick={() => onDetalle?.(f.id)}
              >
                <td className="matriculas num">{f.matricula}</td>
                {Array.from({ length: numDias }, (_, i) => {
                  const dia = i + 1;
                  const d = porDia.get(dia);
                  const dow = new Date(año, mes - 1, dia).getDay();
                  const fondo = dow === 6 ? "diaSem" : d?.esFestivo === true ? "diaFest" : "";
                  const texto = d === undefined ? "" : claseSituacion(d.situacion);
                  return (
                    <td
                      key={i}
                      className={`${fondo} centro ${texto}`.trim()}
                      title={d?.remoto === true ? "Actualizado remotamente" : undefined}
                    >
                      {d?.situacion ?? ""}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {filas.length === 0 ? (
            <tr><td colSpan={34} className="vacio">No hay calendarios para este periodo.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
