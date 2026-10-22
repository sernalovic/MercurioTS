/**
 * Rejilla básica de calendarios compartida por las pantallas de
 * Calendarios y de Calendarios por conductor: una fila por calendario
 * con una celda de situación por día del mes (31 columnas), festivos y
 * sábados coloreados como en el original.
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

export function RejillaCalendarios({ filas, seleccion, onSeleccion }: {
  filas: CabCalendario[];
  seleccion: number | null;
  onSeleccion: (id: number) => void;
}): ReactNode {
  return (
    <div className="marcoRejilla">
      <table className="rejilla rejillaDias">
        <thead>
          <tr>
            <th className="matriculas">Matrícula</th>
            {Array.from({ length: 31 }, (_, i) => (
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
              <tr key={f.id} className={seleccion === f.id ? "sel" : undefined} onClick={() => onSeleccion(f.id)}>
                <td className="matriculas num">{f.matricula}</td>
                {Array.from({ length: 31 }, (_, i) => {
                  const dia = i + 1;
                  const d = porDia.get(dia);
                  const dow = new Date(año, mes - 1, dia).getDay();
                  const clase = d === undefined ? "" : dow === 6 ? "diaSem centro" : d.esFestivo ? "diaFest centro" : "centro";
                  return (
                    <td key={i} className={clase} title={d?.remoto === true ? "Actualizado remotamente" : undefined}>
                      {d?.situacion ?? ""}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {filas.length === 0 ? (
            <tr><td colSpan={32} className="vacio">No hay calendarios para este periodo.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
