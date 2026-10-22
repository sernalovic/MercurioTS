/**
 * Pantalla Conductores: rejilla ordenada por matrícula, con las listas
 * del centro seleccionado — port de `ConductoresView`. Esta fase muestra
 * el listado; el alta/baja por filas con guardado en lote entra en la
 * siguiente fase.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface FilaConductor {
  id: number;
  centro: number;
  categoria: number;
  situacion: number;
  matricula: number;
  isUsuario: boolean;
  fechaAntiguedad: string;
  porcentajeIrpf: string;
  numeroAfiliado: number;
  isReduccionJornada: boolean;
  porcentajeJornada: number;
  nombre: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
  acumuladasIniciales: string;
  dcsIniciales: string;
  dndsIniciales: string;
  plusDistancia: string;
  notas: string | null;
}

/** Mismos valores y orden que `CentroTrabajo` del dominio. */
export const ETIQUETAS_CENTRO: Record<number, string> = {
  0: "Todos", 1: "Donosti", 2: "Bilbao", 3: "Arrasate", 4: "Vitoria", 5: "Pruebas",
};
export const ETIQUETAS_CATEGORIA: Record<number, string> = {
  0: "Conductor", 1: "Conductor de formación", 2: "Taquilla",
};
export const ETIQUETAS_SITUACION: Record<number, string> = {
  0: "Fijo", 1: "Eventual", 2: "Inactivo", 3: "Fijo (inaplicación)",
};

function horas(valor: string): string {
  // "05:00:00" → "05:00" ( DuracionConverter del original)
  return valor.slice(0, 5);
}

function fecha(valor: string): string {
  const [anio, mes, dia] = valor.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

export function PantallaConductores({ servidor, token, centro, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  onVolver: () => void;
}): ReactNode {
  const [filas, setFilas] = useState<FilaConductor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setOcupado(true);
    setError(null);
    const filtro = new URLSearchParams();
    if (centro !== "Todos") filtro.set("centro", String(CENTROS.indexOf(centro)));
    void (async () => {
      try {
        const ruta = `conductores${filtro.size > 0 ? `?${filtro}` : ""}`;
        const respuesta = await fetch(`${servidor.trim().replace(/\/+$/, "")}/api/v1/${ruta}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const texto = await respuesta.text();
        const datos = JSON.parse(texto) as { conductores?: FilaConductor[]; error?: string };
        if (!respuesta.ok || !datos.conductores) {
          throw new Error(datos.error ?? `Error ${respuesta.status}`);
        }
        setFilas(datos.conductores);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setOcupado(false);
      }
    })();
  }, [servidor, token, centro]);

  return (
    <div className="pagina">
      <div className="opcionesPagina">
        <h2 className="tituloPagina">Conductores</h2>
        {ocupado ? <span className="cargando">Cargando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <button className="boton" onClick={onVolver}>Volver</button>
      </div>
      <div className="marcoRejilla">
        <table className="rejilla">
          <thead>
            <tr>
              <th>Matrícula</th><th>Nombre</th><th>Apellidos</th><th>Centro</th>
              <th>Categoría</th><th>Situación</th><th>Usuario</th>
              <th>Fecha ant.</th><th>% IRPF</th><th>Nº afil.</th><th>% Jornada</th>
              <th>Acumuladas</th><th>DCs iniciales</th><th>DNDs iniciales</th>
              <th>Teléfono</th><th>Email</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td>{f.matricula}</td>
                <td>{f.nombre}</td>
                <td>{f.apellidos}</td>
                <td>{ETIQUETAS_CENTRO[f.centro]}</td>
                <td>{ETIQUETAS_CATEGORIA[f.categoria]}</td>
                <td>{ETIQUETAS_SITUACION[f.situacion]}</td>
                <td className="centradoMic">{f.isUsuario ? "✔" : ""}</td>
                <td className="num">{fecha(f.fechaAntiguedad)}</td>
                <td className="num">{f.porcentajeIrpf}</td>
                <td className="num">{f.numeroAfiliado}</td>
                <td className="num">{f.porcentajeJornada}</td>
                <td className="num">{horas(f.acumuladasIniciales)}</td>
                <td className="num">{f.dcsIniciales}</td>
                <td className="num">{f.dndsIniciales}</td>
                <td>{f.telefono}</td>
                <td>{f.email}</td>
              </tr>
            ))}
            {filas.length === 0 && !ocupado ? (
              <tr><td colSpan={16} className="vacio">No hay conductores en este centro.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="pendiente">El alta/baja por filas con guardado en lote entra en la siguiente fase.</p>
    </div>
  );
}

const CENTROS = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];
