/**
 * Pantalla Calendarios — aspecto de Orión 2: barra superior (Volver,
 * Descartar Cambios y las vistas Anual/Virtual a la derecha), banda
 * «CALENDARIOS - centro», fila del mes (← OCTUBRE 2026 → con «Por
 * trabajador/a»), barra de operaciones del mes y la rejilla compacta
 * (solo los días del mes) con las situaciones coloreadas. «+ Añadir
 * calendarios» abre la ventana modal «Añadir calendarios anuales» del
 * original (pegado desde Excel con Ignorar repetidos / Ignorar días
 * vacíos / Ajustar JDs); no permite añadir en "Todos los centros" ni
 * usa otro mes que el de la pantalla.
 */
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { pedirTexto } from "../lib/dialogos";
import { RejillaCalendarios, type CabCalendario } from "../componentes/RejillaCalendarios";
import type { ConductorContexto } from "./CalendariosConductor";

interface ResultadoPegado {
  ok: boolean;
  requiereConfirmacion?: boolean;
  insertados?: number;
  fallidas?: string[];
}

/** Mismos valores y orden que `CentroTrabajo` del dominio. */
const CENTROS = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

/** Días del mes YYYY-MM. */
function diasDelMes(fecha: string): number {
  return new Date(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)), 0).getDate();
}

/** Suma o resta un mes a "YYYY-MM". */
function desplazarMes(fecha: string, n: number): string {
  const [a, m] = fecha.split("-").map(Number) as [number, number];
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---- VENTANA «AÑADIR CALENDARIOS ANUALES» (modal) ----

/** Convierte el texto pegado según las opciones marcadas. */
function filtrarTexto(texto: string, ignorarRepetidos: boolean, ignorarVacios: boolean): string {
  const vistas = new Set<string>();
  const lineas = texto.replace(/\r/g, "").split("\n");
  const salida: string[] = [];
  for (const linea of lineas) {
    if (ignorarVacios && linea.trim() === "") continue;
    const matricula = linea.split("\t")[0]?.trim() ?? "";
    if (ignorarRepetidos && matricula !== "") {
      if (vistas.has(matricula)) continue;
      vistas.add(matricula);
    }
    salida.push(linea);
  }
  return salida.join("\n");
}

function VentanaAñadirCalendarios({ centro, mes, ocupado, onCerrar, onCreate }: {
  centro: number;
  mes: string;
  ocupado: boolean;
  onCerrar: () => void;
  /** Envia el texto (ya filtrado) al servidor. Devuelve el error o null. */
  onCreate: (texto: string, ajustarJds: boolean) => Promise<string | null>;
}): ReactNode {
  const [texto, setTexto] = useState("");
  const [ignorarRepetidos, setIgnorarRepetidos] = useState(false);
  const [ignorarVacios, setIgnorarVacios] = useState(false);
  const [ajustarJds, setAjustarJds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dias = diasDelMes(mes);

  async function aceptar(): Promise<void> {
    setError(null);
    if (!texto.trim()) {
      setError("Pega el texto de los calendarios desde Excel.");
      return;
    }
    const fallo = await onCreate(filtrarTexto(texto, ignorarRepetidos, ignorarVacios), ajustarJds);
    if (fallo !== null) {
      setError(fallo);
      return;
    }
    onCerrar();
  }

  return (
    <div className="veloDetalle" onClick={onCerrar}>
      <div className="ventanaDetalle ventanaAñadir" onClick={(e) => e.stopPropagation()}>
        <div className="cabeceraVentana">
          <span>Añadir calendarios anuales</span>
          <button className="cerrarVentana" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="barraPanel">
          <button className="boton" onClick={() => setTexto("")} disabled={texto === ""}>－ Borrar</button>
          <button className="boton" onClick={() => setTexto("")} disabled={texto === ""}>🗑 Borrar todos</button>
          <button className={`botonLote${ignorarRepetidos ? " pulsado" : ""}`} onClick={() => setIgnorarRepetidos(!ignorarRepetidos)}>Ignorar repetidos</button>
          <button className={`botonLote${ignorarVacios ? " pulsado" : ""}`} onClick={() => setIgnorarVacios(!ignorarVacios)}>Ignorar días vacíos</button>
          <button className={`botonLote${ajustarJds ? " pulsado" : ""}`} onClick={() => setAjustarJds(!ajustarJds)}>Ajustar JDs</button>
        </div>
        <div className="marcoPegado">
          <table className="rejilla rejillaDias">
            <thead>
              <tr>
                <th className="matriculas">Matrícula</th>
                {Array.from({ length: dias }, (_, i) => <th key={i} className="dia">{i + 1}</th>)}
              </tr>
            </thead>
            <tbody><tr className="filaPegada"><td colSpan={dias + 1} /></tr></tbody>
          </table>
          <textarea
            className="areaPegadoModal"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"Pega aquí desde Excel: una fila por matrícula y una columna por día.\n\n(Aquí cabe el calendario anual completo del mes)"}
            spellCheck={false}
          />
        </div>
        {error ? <p className="error errorVentana" role="alert">{error}</p> : null}
        <div className="pieVentana">
          <button className="boton" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
          <button className="botonPrincipal" onClick={() => void aceptar()} disabled={ocupado || centro === 0}>Aceptar</button>
        </div>
      </div>
    </div>
  );
}

// ---- PANTALLA CALENDARIOS ----

export function PantallaCalendarios({ servidor, token, centro, mes, onCambiarMes, onVolver, onPorTrabajador, onDetalle }: {
  servidor: string;
  token: string;
  centro: string;
  mes: string;
  /** Sincroniza el mes con la barra superior (estado global de la app). */
  onCambiarMes: (mes: string) => void;
  onVolver: () => void;
  /** «Por trabajador/a»: abre los calendarios del año de esa matrícula. */
  onPorTrabajador?: (conductor: ConductorContexto) => void;
  /** Doble clic en una fila: abre el detalle del calendario. */
  onDetalle?: (idCalendario: number) => void;
}): ReactNode {
  const [vista, setVista] = useState(0);
  const [filas, setFilas] = useState<CabCalendario[]>([]);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mostrarPegado, setMostrarPegado] = useState(false);

  function cargar(fecha: string): void {
    setOcupado(true);
    setError(null);
    const filtro = new URLSearchParams({ fecha });
    if (centro !== "Todos") filtro.set("centro", String(CENTROS.indexOf(centro)));
    filtro.set("tipo", ["trabajados", "anuales", "virtuales"][vista] as string);
    api<{ calendarios: CabCalendario[] }>(servidor, token, `calendarios/basicos?${filtro}`)
      .then((r) => {
        setFilas(r.calendarios);
        setSeleccion(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(() => { cargar(mes); }, [servidor, token, centro, mes, vista]);

  function cambiarMes(nuevo: string): void {
    setSeleccion(null);
    onCambiarMes(nuevo);
  }

  /** Operación del mes: confirmación opcional, POST al servidor y recarga. */
  async function operacion(nombre: string, confirmacion: string | null): Promise<void> {
    if (confirmacion !== null && !window.confirm(confirmacion)) return;
    setOcupado(true);
    setError(null);
    try {
      await api(servidor, token, "calendarios/operaciones", {
        metodo: "POST",
        cuerpo: {
          operacion: nombre,
          fecha: mes,
          centro: centro === "Todos" ? 0 : CENTROS.indexOf(centro),
        },
      });
      cargar(mes);
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  /**
   * Crear desde lo pegado en la ventana modal (port de `CrearDesdePegado`):
   * devuelve el texto del error o null si salió bien y recargó. Con
   * `ajustar` encendido ejecuta «Ajustar JDs» justo tras pegar.
   */
  async function crearDesdePegado(texto: string, ajustar: boolean): Promise<string | null> {
    if (centro === "Todos") {
      return "No se pueden añadir calendarios en todos los centros.";
    }
    setOcupado(true);
    setError(null);
    const numero = CENTROS.indexOf(centro);
    const cuerpo = { fecha: mes, centro: numero, texto, confirmado: false };
    try {
      let r = await api<ResultadoPegado>(servidor, token, "calendarios/pegar", { metodo: "POST", cuerpo });
      if (r.requiereConfirmacion === true) {
        const seguir = window.confirm(
          "Parece que no están puestos todos los festivos para este centro.\n\n¿Quieres continuar?",
        );
        if (!seguir) return "Confirmación de festivos cancelada.";
        r = await api<ResultadoPegado>(servidor, token, "calendarios/pegar", {
          metodo: "POST",
          cuerpo: { ...cuerpo, confirmado: true },
        });
      }
      if (r.fallidas !== undefined && r.fallidas.length > 0) {
        window.alert(
          "Los siguientes calendarios no se han añadido, por no contener un trabajador válido:\n\n" +
            r.fallidas.join("\n"),
        );
      }
      if (ajustar) {
        await api(servidor, token, "calendarios/operaciones", {
          metodo: "POST",
          cuerpo: { operacion: "ajustarJds", fecha: mes, centro: numero },
        });
      }
      cargar(mes);
      return null;
    } catch (e) {
      setOcupado(false);
      return (e as Error).message;
    }
  }

  async function borrarCalendario(): Promise<void> {
    const fila = filas.find((f) => f.id === seleccion);
    if (fila === undefined) return;
    if (!window.confirm(`Vas a eliminar el calendario de la matrícula ${fila.matricula}.\n\n¿Quieres continuar?`)) return;
    setOcupado(true);
    setError(null);
    try {
      await api(servidor, token, `calendarios/${fila.id}`, { metodo: "DELETE" });
      cargar(mes);
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  /** «Borrar todos»: baja de todos los calendarios visibles del mes y centro. */
  async function borrarTodos(): Promise<void> {
    if (filas.length === 0) return;
    if (!window.confirm(
      `Vas a eliminar los ${filas.length} calendarios de ${MESES[Number(mes.slice(5, 7)) - 1]} ` +
      `${mes.slice(0, 4)} en ${centro}.\n\n¿Quieres continuar?`,
    )) return;
    setOcupado(true);
    setError(null);
    try {
      for (const f of filas) {
        await api(servidor, token, `calendarios/${f.id}`, { metodo: "DELETE" });
      }
      cargar(mes);
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  /** «Por trabajador/a»: pide la matrícula y abre sus calendarios del año. */
  async function porTrabajador(): Promise<void> {
    const texto = await pedirTexto(
      "Calendarios por trabajador/a",
      "Matrícula del trabajador/a:",
    );
    if (texto === null) return;
    const matricula = Number(texto.trim());
    if (!Number.isInteger(matricula) || matricula <= 0) {
      window.alert("Indica una matrícula válida (número).");
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      const r = await api<{ conductores: (ConductorContexto & Record<string, unknown>)[] }>(
        servidor, token, "conductores?centro=0",
      );
      const c = r.conductores.find((x) => x.matricula === matricula);
      if (c === undefined) {
        window.alert(`No hay ningún trabajador con la matrícula ${matricula}.`);
        return;
      }
      onPorTrabajador?.({ id: c.id, matricula: c.matricula, nombre: c.nombre, apellidos: c.apellidos });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const año = Number(mes.slice(0, 4));
  const mesNum = Number(mes.slice(5, 7));

  return (
    <div className="pagina paginaCalendariosO2">
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver}>← Volver</button>
        {ocupado ? <span className="cargando">Cargando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
        <button className={`botonVista${vista === 1 ? " pulsado" : ""}`} onClick={() => setVista(1)}>Anual</button>
        <button className={`botonVista${vista === 2 ? " pulsado" : ""}`} onClick={() => setVista(2)}>Virtual</button>
      </div>
      <div className="marcoCalendarios">
        <div className="bandaTitulo">CALENDARIOS - {centro}</div>
        <div className="barraMes">
          <button className="botonFlecha" onClick={() => cambiarMes(desplazarMes(mes, -1))} disabled={ocupado} aria-label="Mes anterior">←</button>
          <h2 className="tituloMes">{MESES[mesNum - 1]} {año}</h2>
          <button className="botonFlecha" onClick={() => cambiarMes(desplazarMes(mes, 1))} disabled={ocupado} aria-label="Mes siguiente">→</button>
          <button className="boton" onClick={() => void porTrabajador()} disabled={ocupado}>👤 Por trabajador/a</button>
        </div>
        <div className="barraPanel barraOpsCalendarios">
          <button className="boton" disabled title="Aún no disponible">📅 Añadir quincenales</button>
          <button className="boton" onClick={borrarCalendario} disabled={seleccion === null || ocupado}>－ Borrar</button>
          <button className="boton" onClick={borrarTodos} disabled={ocupado || filas.length === 0 || centro === "Todos"} title={centro === "Todos" ? "No se pueden borrar calendarios en todos los centros." : undefined}>
            🗑 Borrar todos
          </button>
          <button className="boton" onClick={() => operacion("marcarFestivos", "Vas a marcar los festivos de todos los calendarios.\n\n¿Quieres continuar?")} disabled={ocupado}>📅 Marcar festivos</button>
          <button className="boton" onClick={() => operacion("recalcularResumenes", "Vas a recalcular los resúmenes de todos los calendarios.\n\n¿Quieres continuar?")} disabled={ocupado}>Σ Recalcular resúmenes</button>
          <button className="boton" onClick={() => operacion("regenerarTodos", "Vas a modificar los servicios de todos los calendarios.\n\nEsta acción puede provocar pérdida de datos en los servicios virtuales.\n\n¿Quieres continuar?")} disabled={ocupado}>↻ Regenerar todos</button>
          <span className="hueco" />
          <button className="botonPrincipal" onClick={() => setMostrarPegado(true)} disabled={ocupado}>＋ Añadir calendarios</button>
        </div>
        <RejillaCalendarios
          filas={filas}
          seleccion={seleccion}
          onSeleccion={setSeleccion}
          onDetalle={onDetalle}
          fechaMes={mes}
        />
      </div>
      <p className="barraEstado">
        Calendarios: {filas.length}
        {seleccion !== null ? ` · Matrícula ${filas.find((f) => f.id === seleccion)?.matricula} seleccionada` : ""}
        {" · Doble clic en un calendario para su detalle."}
      </p>
      {mostrarPegado ? (
        <VentanaAñadirCalendarios
          centro={CENTROS.indexOf(centro)}
          mes={mes}
          ocupado={ocupado}
          onCerrar={() => setMostrarPegado(false)}
          onCreate={crearDesdePegado}
        />
      ) : null}
    </div>
  );
}
