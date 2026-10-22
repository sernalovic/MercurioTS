/**
 * Pantalla Conductores: rejilla editable — port de `ConductoresView`.
 * Filas con combos de centro/categoría/situación, alta y baja por filas,
 * guardado en lote (bajas → altas → cambios, como `GuardarListaAsync`)
 * y deshacer de borrados. La rejilla de Regulaciones entra en la fase
 * siguiente.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";

interface FilaApi {
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
  regulaciones?: RegApi[];
}

/** La fila tal como la edita la rejilla (fechas ISO, horas hh:mm). */
interface Fila {
  id: number;
  centro: string;
  categoria: string;
  situacion: string;
  matricula: string;
  isUsuario: boolean;
  fechaAntiguedad: string;
  porcentajeIrpf: string;
  numeroAfiliado: string;
  isReduccionJornada: boolean;
  porcentajeJornada: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
  acumuladasIniciales: string;
  dcsIniciales: string;
  dndsIniciales: string;
  plusDistancia: string;
  notas: string;
}

interface RegApi {
  id: number;
  tipo: number;
  fecha: string;
  horas: string;
  dcs: string;
  dnds: string;
  motivo: string | null;
}

/** La regulación tal como la edita la rejilla (fecha ISO, horas hh:mm). */
interface RegFila {
  id: number;
  conductorId: number;
  tipo: string;
  fecha: string;
  horas: string;
  dcs: string;
  dnds: string;
  motivo: string;
}

function aRegFila(g: RegApi, conductorId: number): RegFila {
  return {
    id: g.id,
    conductorId,
    tipo: String(g.tipo),
    fecha: g.fecha.slice(0, 10),
    horas: g.horas.slice(0, 5),
    dcs: g.dcs,
    dnds: g.dnds,
    motivo: g.motivo ?? "",
  };
}

/** Cuerpo que envía la UI al API (números validados allí). */
function aCuerpoReg(g: RegFila): unknown {
  return {
    id: g.id > 0 ? g.id : 0,
    tipo: Number(g.tipo),
    fecha: g.fecha,
    horas: g.horas,
    dcs: g.dcs,
    dnds: g.dnds,
    motivo: g.motivo.trim() || null,
  };
}

/** ¿Es una regulación nueva o cambió respecto a su original? */
function esCambioReg(g: RegFila, original: RegFila | undefined): boolean {
  if (original === undefined) return true;
  return JSON.stringify(aCuerpoReg(g)) !== JSON.stringify(aCuerpoReg(original));
}

/** Contador de Ids temporales de filas nuevas (negativos, nunca en la BD). */
let contadorNuevas = 0;

/** Mismos valores y orden que `CentroTrabajo` del dominio. */
const CENTROS = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];
const ETIQUETAS_CENTRO: Record<number, string> = {
  0: "Todos", 1: "Donosti", 2: "Bilbao", 3: "Arrasate", 4: "Vitoria", 5: "Pruebas",
};
const ETIQUETAS_CATEGORIA: Record<number, string> = {
  0: "Conductor", 1: "Conductor de formación", 2: "Taquilla",
};
const ETIQUETAS_SITUACION: Record<number, string> = {
  0: "Fijo", 1: "Eventual", 2: "Inactivo", 3: "Fijo (inaplicación)",
};

function aFila(c: FilaApi): Fila {
  return {
    id: c.id,
    centro: String(c.centro),
    categoria: String(c.categoria),
    situacion: String(c.situacion),
    matricula: String(c.matricula),
    isUsuario: c.isUsuario,
    fechaAntiguedad: c.fechaAntiguedad.slice(0, 10),
    porcentajeIrpf: c.porcentajeIrpf,
    numeroAfiliado: String(c.numeroAfiliado),
    isReduccionJornada: c.isReduccionJornada,
    porcentajeJornada: String(c.porcentajeJornada),
    nombre: c.nombre,
    apellidos: c.apellidos,
    telefono: c.telefono ?? "",
    email: c.email ?? "",
    acumuladasIniciales: c.acumuladasIniciales.slice(0, 5),
    dcsIniciales: c.dcsIniciales,
    dndsIniciales: c.dndsIniciales,
    plusDistancia: c.plusDistancia,
    notas: c.notas ?? "",
  };
}

/** Cuerpo que envía la UI al API (números validados allí). */
interface CuerpoConductor {
  id: number;
  centro: number;
  categoria: number;
  situacion: number;
  matricula: number;
  isUsuario: boolean;
  fechaAntiguedad: string;
  porcentajeIrpf: string;
  numeroAfiliado: string;
  isReduccionJornada: boolean;
  porcentajeJornada: string;
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

function aConductor(f: Fila): CuerpoConductor {
  return {
    id: f.id > 0 ? f.id : 0,
    centro: Number(f.centro),
    categoria: Number(f.categoria),
    situacion: Number(f.situacion),
    matricula: f.matricula.trim() === "" ? 0 : Number(f.matricula),
    isUsuario: f.isUsuario,
    fechaAntiguedad: f.fechaAntiguedad,
    porcentajeIrpf: f.porcentajeIrpf,
    numeroAfiliado: f.numeroAfiliado,
    isReduccionJornada: f.isReduccionJornada,
    porcentajeJornada: f.porcentajeJornada,
    nombre: f.nombre,
    apellidos: f.apellidos,
    telefono: f.telefono.trim() || null,
    email: f.email.trim() || null,
    acumuladasIniciales: f.acumuladasIniciales,
    dcsIniciales: f.dcsIniciales,
    dndsIniciales: f.dndsIniciales,
    plusDistancia: f.plusDistancia,
    notas: f.notas.trim() || null,
  };
}

/** ¿Difiere la fila de su original (se enviará como cambio)? */
function esCambio(f: Fila, original: Fila | undefined): boolean {
  return original !== undefined && JSON.stringify(aConductor(f)) !== JSON.stringify(aConductor(original));
}

/** Valida en cliente antes de llamar al API. */
function validar(f: Fila): string | null {
  if (f.matricula.trim() === "" || !Number.isFinite(Number(f.matricula))) return "Indica la matrícula de cada conductor.";
  if (f.nombre.trim() === "" || f.apellidos.trim() === "") return "Indica el nombre y los apellidos de cada conductor.";
  if (f.fechaAntiguedad === "") return "Indica la fecha de antigüedad de cada conductor.";
  return null;
}

export function PantallaConductores({ servidor, token, centro, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  onVolver: () => void;
}): ReactNode {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [originales, setOriginales] = useState<Map<number, Fila>>(new Map());
  const [borrados, setBorrados] = useState<number[]>([]);
  const [regs, setRegs] = useState<RegFila[]>([]);
  const [regsOriginales, setRegsOriginales] = useState<Map<number, RegFila>>(new Map());
  const [borradosReg, setBorradosReg] = useState<number[]>([]);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function cargar(mantener?: number): void {
    setOcupado(true);
    setError(null);
    const filtro = new URLSearchParams();
    if (centro !== "Todos") filtro.set("centro", String(CENTROS.indexOf(centro)));
    api<{ conductores: FilaApi[] }>(servidor, token, `conductores${filtro.size > 0 ? `?${filtro}` : ""}`)
      .then((r) => {
        const lista = r.conductores.map(aFila);
        setFilas(lista);
        setOriginales(new Map(lista.map((f) => [f.id, f])));
        setBorrados([]);
        setSeleccion(mantener !== undefined && lista.some((f) => f.id === mantener) ? mantener : null);
        const listaRegs = r.conductores.flatMap((c) => (c.regulaciones ?? []).map((g) => aRegFila(g, c.id)));
        setRegs(listaRegs);
        setRegsOriginales(new Map(listaRegs.map((g) => [g.id, g])));
        setBorradosReg([]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(cargar, [servidor, token, centro]);

  function cambiar(id: number, campo: keyof Fila, valor: string | boolean): void {
    setFilas((anterior) => anterior.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  }

  function añadir(): void {
    setError(null);
    contadorNuevas -= 1;
    const nuevo: Fila = {
      id: contadorNuevas,
      centro: centro !== "Todos" ? String(CENTROS.indexOf(centro)) : "2",
      categoria: "0",
      situacion: "0",
      matricula: "",
      isUsuario: false,
      fechaAntiguedad: new Date().toISOString().slice(0, 10),
      porcentajeIrpf: "0",
      numeroAfiliado: "0",
      isReduccionJornada: false,
      porcentajeJornada: "100",
      nombre: "",
      apellidos: "",
      telefono: "",
      email: "",
      acumuladasIniciales: "00:00",
      dcsIniciales: "0",
      dndsIniciales: "0",
      plusDistancia: "0",
      notas: "",
    };
    setFilas((anterior) => [...anterior, nuevo]);
    setSeleccion(nuevo.id);
  }

  function borrar(): void {
    if (seleccion === null) return;
    const fila = filas.find((f) => f.id === seleccion);
    if (!fila) return;
    if (
      !window.confirm(
        "Borrar un conductor hará que se borren todos los datos asociados a este conductor (calendarios, reclamaciones, etc).\n\n¿Estás seguro de borrar al conductor?",
      )
    ) {
      return;
    }
    setError(null);
    setFilas((anterior) => anterior.filter((f) => f.id !== seleccion));
    if (seleccion > 0) setBorrados((anterior) => [...anterior, seleccion]);
    setSeleccion(null);
  }

  function deshacer(): void {
    if (borrados.length === 0) return;
    setError(null);
    const devolver = borrados.map((id) => originales.get(id)).filter((f): f is Fila => f !== undefined);
    setFilas((anterior) => [...anterior, ...devolver].sort((a, b) => Number(a.matricula) - Number(b.matricula)));
    setBorrados([]);
  }

  function añadirReg(): void {
    if (seleccion === null) return;
    setError(null);
    contadorNuevas -= 1;
    const reg: RegFila = {
      id: contadorNuevas,
      conductorId: seleccion,
      tipo: "0",
      fecha: new Date().toISOString().slice(0, 10),
      horas: "00:00",
      dcs: "0",
      dnds: "0",
      motivo: "",
    };
    setRegs((anterior) => [...anterior, reg]);
  }

  function borrarReg(idReg: number): void {
    setError(null);
    setRegs((anterior) => anterior.filter((g) => g.id !== idReg));
    if (idReg > 0) setBorradosReg((anterior) => [...anterior, idReg]);
  }

  function cambiarReg(idReg: number, campo: keyof RegFila, valor: string): void {
    setRegs((anterior) => anterior.map((g) => (g.id === idReg ? { ...g, [campo]: valor } : g)));
  }

  async function guardar(): Promise<void> {
    setError(null);
    for (const g of regs) {
      if (g.fecha === "") {
        setError("Indica la fecha de cada regulación.");
        return;
      }
    }
    const nuevos = filas.filter((f) => f.id <= 0);
    const cambios = filas.filter((f) => f.id > 0 && esCambio(f, originales.get(f.id)));
    // Las regulaciones nuevas o cambiadas viajan anidadas a su conductor;
    // si el conductor no tenía cambios, se envía igualmente como cambio.
    const anidadas = new Map<number, unknown[]>();
    for (const g of regs) {
      if (!esCambioReg(g, regsOriginales.get(g.id))) continue;
      const grupo = anidadas.get(g.conductorId) ?? [];
      grupo.push(aCuerpoReg(g));
      anidadas.set(g.conductorId, grupo);
    }
    const listaCambios = filas.filter((f) => f.id > 0 && (cambios.includes(f) || anidadas.has(f.id)));
    const listaNuevos = filas.filter((f) => f.id <= 0);
    const fallo = [...listaNuevos, ...listaCambios].map(validar).find((m) => m !== null);
    if (fallo) {
      setError(fallo);
      return;
    }
    setOcupado(true);
    try {
      if (borradosReg.length > 0) {
        await api(servidor, token, "regulaciones", { metodo: "DELETE", cuerpo: borradosReg });
      }
      if (borrados.length > 0) {
        await api(servidor, token, "conductores", { metodo: "DELETE", cuerpo: borrados });
      }
      if (listaNuevos.length > 0) {
        await api(servidor, token, "conductores", {
          metodo: "POST",
          cuerpo: listaNuevos.map((f) => ({ ...aConductor(f), id: 0, regulaciones: anidadas.get(f.id) ?? [] })),
        });
      }
      if (listaCambios.length > 0) {
        await api(servidor, token, "conductores", {
          metodo: "PUT",
          cuerpo: listaCambios.map((f) => ({ ...aConductor(f), regulaciones: anidadas.get(f.id) ?? [] })),
        });
      }
      cargar(seleccion !== null && seleccion > 0 ? seleccion : undefined);
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  const hayCambios =
    borrados.length > 0 ||
    borradosReg.length > 0 ||
    filas.some((f) => f.id <= 0 || esCambio(f, originales.get(f.id))) ||
    regs.some((g) => esCambioReg(g, regsOriginales.get(g.id)));
  const regsSeleccionado = regs.filter((g) => g.conductorId === seleccion);

  return (
    <div className="pagina">
      <div className="opcionesPagina">
        <h2 className="tituloPagina">Conductores</h2>
        {ocupado ? <span className="cargando">{hayCambios ? "Guardando…" : "Cargando…"}</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
        <button className="boton" onClick={onVolver}>Volver</button>
        <button className="boton" onClick={() => cargar()} disabled={ocupado}>Recargar</button>
        <button className="boton" onClick={añadir}>Añadir</button>
        <button className="boton" onClick={borrar} disabled={seleccion === null}>Borrar</button>
        <button className="boton" onClick={deshacer} disabled={borrados.length === 0}>Deshacer borrado</button>
        <button className="boton" disabled title="Disponible con la fase de Calendarios">Ver calendarios</button>
        <button className="botonPrincipal" onClick={guardar} disabled={ocupado || !hayCambios}>Guardar</button>
      </div>
      <div className="marcoRejilla">
        <table className="rejilla">
          <thead>
            <tr>
              <th>Matrícula</th><th>Centro</th><th>Categoría</th><th>Situación</th>
              <th>Nombre</th><th>Apellidos</th><th>Usuario</th><th>Fecha ant.</th>
              <th>% IRPF</th><th>Nº afil.</th><th>Reducción</th><th>% Jornada</th>
              <th>Acumuladas</th><th>DCs inic.</th><th>DNDs inic.</th><th>Plus dist.</th>
              <th>Teléfono</th><th>Email</th><th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.id > 0 ? f.id : `nueva${f.id}`}
                className={seleccion === f.id ? "sel" : undefined}
                onClick={() => setSeleccion(f.id)}
              >
                <td><input className="celda num" value={f.matricula} onChange={(e) => cambiar(f.id, "matricula", e.target.value)} /></td>
                <td>
                  <select className="celda" value={f.centro} onChange={(e) => cambiar(f.id, "centro", e.target.value)}>
                    {[1, 2, 3, 4, 5].map((v) => <option key={v} value={String(v)}>{ETIQUETAS_CENTRO[v]}</option>)}
                  </select>
                </td>
                <td>
                  <select className="celda" value={f.categoria} onChange={(e) => cambiar(f.id, "categoria", e.target.value)}>
                    {[0, 1, 2].map((v) => <option key={v} value={String(v)}>{ETIQUETAS_CATEGORIA[v]}</option>)}
                  </select>
                </td>
                <td>
                  <select className="celda" value={f.situacion} onChange={(e) => cambiar(f.id, "situacion", e.target.value)}>
                    {[0, 1, 2, 3].map((v) => <option key={v} value={String(v)}>{ETIQUETAS_SITUACION[v]}</option>)}
                  </select>
                </td>
                <td><input className="celda" value={f.nombre} onChange={(e) => cambiar(f.id, "nombre", e.target.value)} /></td>
                <td><input className="celda" value={f.apellidos} onChange={(e) => cambiar(f.id, "apellidos", e.target.value)} /></td>
                <td className="centradoMic"><input type="checkbox" checked={f.isUsuario} onChange={(e) => cambiar(f.id, "isUsuario", e.target.checked)} /></td>
                <td><input type="date" className="celda num" value={f.fechaAntiguedad} onChange={(e) => cambiar(f.id, "fechaAntiguedad", e.target.value)} /></td>
                <td><input className="celda num" value={f.porcentajeIrpf} onChange={(e) => cambiar(f.id, "porcentajeIrpf", e.target.value)} /></td>
                <td><input className="celda num" value={f.numeroAfiliado} onChange={(e) => cambiar(f.id, "numeroAfiliado", e.target.value)} /></td>
                <td className="centradoMic"><input type="checkbox" checked={f.isReduccionJornada} onChange={(e) => cambiar(f.id, "isReduccionJornada", e.target.checked)} /></td>
                <td><input className="celda num" value={f.porcentajeJornada} onChange={(e) => cambiar(f.id, "porcentajeJornada", e.target.value)} /></td>
                <td><input className="celda num" value={f.acumuladasIniciales} onChange={(e) => cambiar(f.id, "acumuladasIniciales", e.target.value)} /></td>
                <td><input className="celda num" value={f.dcsIniciales} onChange={(e) => cambiar(f.id, "dcsIniciales", e.target.value)} /></td>
                <td><input className="celda num" value={f.dndsIniciales} onChange={(e) => cambiar(f.id, "dndsIniciales", e.target.value)} /></td>
                <td><input className="celda num" value={f.plusDistancia} onChange={(e) => cambiar(f.id, "plusDistancia", e.target.value)} /></td>
                <td><input className="celda" value={f.telefono} onChange={(e) => cambiar(f.id, "telefono", e.target.value)} /></td>
                <td><input className="celda" value={f.email} onChange={(e) => cambiar(f.id, "email", e.target.value)} /></td>
                <td><input className="celda" value={f.notas} onChange={(e) => cambiar(f.id, "notas", e.target.value)} /></td>
              </tr>
            ))}
            {filas.length === 0 && !ocupado ? (
              <tr><td colSpan={19} className="vacio">No hay conductores en este centro.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="seccionRejilla">
        <h3 className="tituloSeccion">Regulaciones del conductor seleccionado</h3>
        {ocupado ? <span className="cargando">Guardando…</span> : null}
        <span className="hueco" />
        <button className="boton" onClick={añadirReg} disabled={seleccion === null}>Añadir regulación</button>
      </div>
      <div className="marcoRejilla">
        <table className="rejilla">
          <thead>
            <tr>
              <th>Tipo</th><th>Fecha</th><th>Horas</th><th>DCs</th><th>DNDs</th><th>Motivo</th><th />
            </tr>
          </thead>
          <tbody>
            {regsSeleccionado.map((g) => (
              <tr key={g.id > 0 ? g.id : `regNueva${g.id}`}>
                <td>
                  <select className="celda" value={g.tipo} onChange={(e) => cambiarReg(g.id, "tipo", e.target.value)}>
                    <option value="0">Manual</option>
                    <option value="1">HorasCobradas</option>
                    <option value="2">RegulacionAnual</option>
                  </select>
                </td>
                <td><input type="date" className="celda" value={g.fecha} onChange={(e) => cambiarReg(g.id, "fecha", e.target.value)} /></td>
                <td><input className="celda num" value={g.horas} onChange={(e) => cambiarReg(g.id, "horas", e.target.value)} /></td>
                <td><input className="celda num" value={g.dcs} onChange={(e) => cambiarReg(g.id, "dcs", e.target.value)} /></td>
                <td><input className="celda num" value={g.dnds} onChange={(e) => cambiarReg(g.id, "dnds", e.target.value)} /></td>
                <td><input className="celda" value={g.motivo} onChange={(e) => cambiarReg(g.id, "motivo", e.target.value)} /></td>
                <td className="centradoMic"><button className="boton" onClick={() => borrarReg(g.id)}>Borrar</button></td>
              </tr>
            ))}
            {regsSeleccionado.length === 0 ? (
              <tr><td colSpan={7} className="vacio">{seleccion === null ? "Selecciona un conductor para ver sus regulaciones." : "Sin regulaciones."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="pendiente">El botón «Ver calendarios» del conductor se activa con la fase de Calendarios.</p>
    </div>
  );
}
