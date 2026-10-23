/**
 * Pantalla Convenios — aspecto de Orión 2 (`ConveniosView`): lista de años
 * a la izquierda (+/−) y a la derecha la banda «CONVENIO: año» con tres
 * columnas de parámetros (JORNADAS Y DÍAS / PARÁMETROS DIETAS Y PLUSES /
 * IMPORTES Y PLUSES), los botones «Tablas Salariales» e «Incrementar
 * importes» y «Opciones específicas de cada centro» con un botón por
 * centro. Los tres cuadros se abren como ventanas modales: **Tablas
 * salariales** (dos rejillas por categoría), **Incrementar importes**
 * (porcentaje pedido con `Dialogos.Pedir`) y **Opciones de {centro}**
 * (números de gráfico, limpiezas mensuales, plus de viaje y festivos con
 * +/−/Deshacer/Propagar). Todos los cálculos («Incrementar importes») van
 * en el cliente con `CalculosNomina.IncrementarImportes` y nada persiste
 * hasta «Guardar y Actualizar»: baja de festivos → baja de convenios →
 * altas → cambios → recarga.
 */
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { pedirTexto } from "../lib/dialogos";
import { SeparadorV } from "../componentes/Separador";
import { centimosDe, duracion, importe, minutosDeHora, parseHora } from "../lib/horas";
import { nombreEnum, nuevoConvenio, nuevaTablaSalarial, incrementarImportes,
  CentroTrabajo, CategoriaTrabajador,
  type Convenio, type OpcionesCentro, type Festivo, type TablaSalarial,
} from "@mercurio/domain";

/** Nombres de los centros (índice = valor del enum, como en la barra). */
const NOMBRES_CENTRO = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];

/** `Listas.CentrosReales` del original: todos menos `Todos`. */
const CENTROS_REALES: CentroTrabajo[] = [1, 2, 3, 4, 5] as CentroTrabajo[];

/** `Listas.Categorias` del original: el enum completo. */
const CATEGORIAS = Object.values(CategoriaTrabajador).filter(
  (v): v is CategoriaTrabajador => typeof v === "number",
);

type TipoCampo = "duracion" | "entero" | "importe" | "unidades" | "porcentaje";

/** Las tres columnas de parámetros del original (etiquetas del Orión 2). */
const GRUPOS: Array<{ titulo: string; campos: Array<[keyof Convenio, string, TipoCampo]> }> = [
  {
    titulo: "JORNADAS Y DÍAS",
    campos: [
      ["jornadaMedia", "Jornada media", "duracion"],
      ["jornadaAnual", "Jornada anual", "entero"],
      ["jornadaMaxima", "Jornada máxima", "duracion"],
      ["jornadaMaximaFindes", "Jornada máxima findes", "duracion"],
      ["jornadaMaximaPartida", "Jornada máxima partida", "duracion"],
      ["tiempoPartidoMaximo", "Tiempo partido máximo", "duracion"],
      ["diasTrabajoAnuales", "Días de trabajo anuales", "entero"],
      ["diasDescansoAnuales", "Días de descanso anuales", "entero"],
      ["diasVacacionesAnuales", "Días de vacaciones anuales", "entero"],
      ["descansosSueltosAnuales", "Descansos sueltos anuales", "entero"],
      ["findesCompletosAnuales", "Findes completos anuales", "entero"],
      ["diasTrabajadosSeguidos", "Días trabajados seguidos máximo", "entero"],
      ["descansosSueltosMes", "Descansos sueltos en un mes", "entero"],
      ["minimoDescansosMes", "Mínimo descansos en un mes", "entero"],
      ["maximoDescansosMes", "Máximo descansos en un mes", "entero"],
      ["maximoFindesSeguidos", "Máximo findes seguidos en un mes", "entero"],
    ],
  },
  {
    titulo: "PARÁMETROS DIETAS Y PLUSES",
    campos: [
      ["limiteDesayuno", "Hora desayuno", "duracion"],
      ["porcentajeDesayuno", "Porcentaje desayuno", "porcentaje"],
      ["inicioComidaContinuo", "Inicio comida jornada continua", "duracion"],
      ["finalComidaContinuo", "Final comida jornada continua", "duracion"],
      ["inicioComidaPartido", "Inicio comida jornada partida", "duracion"],
      ["finalComidaPartido", "Final comida jornada partida", "duracion"],
      ["inicioCena", "Inicio cena", "duracion"],
      ["finalCena", "Final cena", "duracion"],
      ["limitePlusCena", "Hora plus cena", "duracion"],
      ["porcentajePlusCena", "Porcentaje plus cena", "porcentaje"],
      ["inicioNocturnas", "Inicio nocturnas", "duracion"],
      ["finalNocturnas", "Final nocturnas", "duracion"],
      ["maximoLimpiezas", "Máximo limpiezas a cobrar", "entero"],
    ],
  },
  {
    titulo: "IMPORTES Y PLUSES",
    campos: [
      ["importeDietas", "Importe de las dietas", "importe"],
      ["importePlusSabados", "Importe plus de sábados", "importe"],
      ["importePlusFestivos", "Importe plus de festivos", "importe"],
      ["importePlusMenorDescanso", "Importe plus de menor descanso", "importe"],
      ["importePlusLimpieza", "Importe plus de limpieza", "importe"],
      ["importePlusPaqueteria", "Importe plus de paquetería", "importe"],
      ["importePlusNocturnidad", "Importe plus de nocturnidad", "importe"],
      ["importePlusNocturnidadDiario", "Importe plus de nocturnidad diario", "importe"],
      ["importePlusNavidad", "Importe plus de Navidad", "importe"],
      ["importeRefuerzos", "Importe refuerzos", "importe"],
    ],
  },
];

/** Columnas de las dos rejillas de tablas salariales (XAML). */
const TABLA_MENSUAL: Array<[keyof TablaSalarial, string, TipoCampo]> = [
  ["sueldoBaseMensual", "Salario base (mes)", "importe"],
  ["complementoSalarial", "C. salarial (mes)", "importe"],
  ["baseAntiguedad", "Antigüedad (mes)", "importe"],
  ["precioQuebrantoMoneda", "Quebranto m.", "importe"],
  ["precioHoraExtra", "Hora extra", "importe"],
];
const TABLA_OTROS: Array<[keyof TablaSalarial, string, TipoCampo]> = [
  ["pagaSeptiembre", "Paga septiembre", "importe"],
  ["importeDndCobrado", "Importe DND", "importe"],
  ["seguroAccidentes", "Seguro accidentes", "importe"],
  ["porcentajeSeguridadSocial", "% SS.SS.", "unidades"],
  ["porcentajeDesempleo", "% desempleo", "unidades"],
];

/** "AAAA-MM-DD" → "dddd dd/MM/yyyy" del original (StringFormat es-ES). */
function fechaLarga(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const d = new Date(`${fecha}T12:00:00`);
  return `${dias[d.getDay()]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
}

/** Texto de un campo según su tipo (la edición de vuelta la hace `valorDe`). */
function textoDe(campo: keyof Convenio | keyof TablaSalarial, valor: unknown, tipo: TipoCampo): string {
  switch (tipo) {
    case "duracion": return duracion(valor as number | null);
    case "importe": return importe((valor as number) ?? 0);
    case "unidades": return valor == null ? "" : String(valor);
    default: return valor == null ? "" : String(valor);
  }
}

/** Parse de un texto editado según el tipo del campo (null = dejarlo igual). */
function valorDe(texto: string, tipo: TipoCampo): unknown {
  switch (tipo) {
    case "duracion": return minutosDeHora(texto) ?? parseHora(texto);
    case "importe": return centimosDe(texto);
    case "unidades": { const v = Number(texto.trim().replace(",", ".")); return Number.isFinite(v) ? v : null; }
    case "porcentaje": { const v = Number.parseInt(texto, 10); return Number.isInteger(v) ? v : null; }
    default: { const v = Number.parseInt(texto, 10); return Number.isInteger(v) ? v : null; }
  }
}

// ---- VENTANA «TABLAS SALARIALES {año}» (modal) ----

/** Importe de tabla salarial con 4 decimales ("1950,0800"), sin € (captura). */
function importeTabla(cent: number | null): string {
  const v = Math.round((cent ?? 0)) / 100;
  return v.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function VentanaTablas({ conv, onCambiarTabla, onCerrar }: {
  conv: Convenio;
  onCambiarTabla: (t: TablaSalarial, cambios: Partial<TablaSalarial>) => void;
  onCerrar: () => void;
}): ReactNode {
  function rejilla(columnas: Array<[keyof TablaSalarial, string, TipoCampo]>): ReactNode {
    return (
      <div className="marcoRejilla marcoTablas">
        <table className="rejilla">
          <thead>
            <tr><th>Categoría trabajador</th>{columnas.map(([, et]) => <th key={et}>{et}</th>)}</tr>
          </thead>
          <tbody>
            {conv.tablasSalariales.map((t) => (
              <tr key={t.id ?? `n${t.categoria}`}>
                <td className="centradoNombre">{nombreEnum(CategoriaTrabajador, t.categoria)}</td>
                {columnas.map(([campo, , tipo]) => (
                  <td key={campo} className="num">
                    <input
                      className="celda num"
                      value={tipo === "importe" ? importeTabla(t[campo] as number) : textoDe(campo, t[campo], tipo)}
                      onChange={(e) => {
                        const v = valorDe(e.target.value, tipo);
                        if (v !== null) onCambiarTabla(t, { [campo]: v } as Partial<TablaSalarial>);
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="veloDetalle" onClick={onCerrar}>
      <div className="ventanaDetalle ventanaTablas" onClick={(e) => e.stopPropagation()}>
        <div className="cabeceraVentana">
          <span>Tablas salariales {conv.año}</span>
          <button className="cerrarVentana" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="tablasCuerpo">
          {rejilla(TABLA_MENSUAL)}
          {rejilla(TABLA_OTROS)}
        </div>
        <div className="pieVentana">
          <button className="boton" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ---- VENTANA «OPCIONES DE {CENTRO}» (modal) ----

function VentanaOpciones({ conv, ops, bajaFestivos, onCambiarOpciones, onCambiar, onAñadirFestivo, onBorrarFestivo, onDeshacerFestivo, onPropagar, onCerrar }: {
  conv: Convenio;
  ops: OpcionesCentro;
  bajaFestivos: Array<{ id: number; fecha: string }>;
  onCambiarOpciones: (cambios: Partial<OpcionesCentro>) => void;
  onCambiar: (cambios: Partial<Convenio>) => void;
  onAñadirFestivo: () => void;
  onBorrarFestivo: (f: Festivo) => void;
  onDeshacerFestivo: () => void;
  onPropagar: () => void;
  onCerrar: () => void;
}): ReactNode {
  const [festivoSel, setFestivoSel] = useState<Festivo | null>(null);
  const festivos = [...ops.festivos].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <div className="veloDetalle" onClick={onCerrar}>
      <div className="ventanaDetalle ventanaOpciones" onClick={(e) => e.stopPropagation()}>
        <div className="cabeceraVentana">
          <span>Opciones de {NOMBRES_CENTRO[ops.centro] ?? ""}</span>
          <button className="cerrarVentana" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="opcionesCuerpo">
          <div className="columnaOpciones">
            <h3 className="tituloColumna">Números de gráfico</h3>
            <p className="explicacion">
              Se pondrán los diferentes números o rangos separados por comas. Los rangos van separados
              por un guión.<br />Por ejemplo, 3001,3100-3150 equivaldría al gráfico 3001 y a todos los
              gráficos entre 3100 y 3150.
            </p>
            {([["numerosL", "Lunes a jueves"], ["numerosV", "Viernes"], ["numerosS", "Sábados"], ["numerosF", "Festivos"], ["numerosR", "Gráficos de reserva"]] as const).map(([campo, et]) => (
              <label key={campo} className="campoTrabajador">
                <span className="etiquetaCampo">{et}</span>
                <input
                  className="campoEntrada"
                  value={ops[campo] ?? ""}
                  onChange={(e) => onCambiarOpciones({ [campo]: e.target.value === "" ? null : e.target.value } as Partial<OpcionesCentro>)}
                />
              </label>
            ))}
          </div>
          <div className="columnaOpciones">
            <h3 className="tituloColumna">Limpiezas mensuales</h3>
            <p className="explicacion">
              Si el valor es cero, se pagan las limpiezas que vayan implícitas en el gráfico. Si el valor
              es mayor que cero, se pagará el número de limpiezas fijo al mes, sin tener en cuenta los
              gráficos realizados.
            </p>
            <label className="campoTrabajador">
              <span className="etiquetaCampo">Número de limpiezas al mes</span>
              <input
                className="campoEntrada"
                value={String(ops.limpiezasMes)}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  if (Number.isInteger(v)) onCambiarOpciones({ limpiezasMes: v });
                }}
              />
            </label>
            <h3 className="tituloColumna">Plus de viaje</h3>
            <p className="explicacion">
              Si está activo, se pagará el importe indicado por cada día trabajado, como plus de viaje.
            </p>
            <div className="formDuo">
              <button
                className={`botonFicha${ops.pagarPlusViaje ? " pulsado" : ""}`}
                onClick={() => onCambiarOpciones({ pagarPlusViaje: !ops.pagarPlusViaje })}
              >
                Pagar Plus Viaje
              </button>
              <label className="campoTrabajador">
                <span className="etiquetaCampo">Importe plus viaje</span>
                <input
                  className="campoEntrada"
                  value={importe(ops.importePlusViaje)}
                  onChange={(e) => onCambiarOpciones({ importePlusViaje: centimosDe(e.target.value) })}
                />
              </label>
            </div>
          </div>
          <div className="columnaOpciones columnaFestivos">
            <h3 className="tituloColumna">Festivos</h3>
            <div className="barraPanel barraFestivos">
              <button className="boton" onClick={onAñadirFestivo}>＋</button>
              <button className="boton" onClick={() => festivoSel !== null && onBorrarFestivo(festivoSel)} disabled={festivoSel === null}>－</button>
              <button className="boton" onClick={onDeshacerFestivo} disabled={bajaFestivos.length === 0}>↺ Deshacer borrar</button>
              <button className="boton" onClick={onPropagar} title="Copia los festivos de este centro al resto">⇉ Propagar</button>
            </div>
            <div className="marcoRejilla marcoFestivos">
              <table className="rejilla">
                <thead><tr><th>Fecha</th></tr></thead>
                <tbody>
                  {festivos.map((f) => (
                    <tr
                      key={f.id ?? f.fecha}
                      className={f === festivoSel ? "sel" : undefined}
                      onClick={() => setFestivoSel(f)}
                    >
                      <td>{fechaLarga(f.fecha)}</td>
                    </tr>
                  ))}
                  {festivos.length === 0 ? <tr><td className="vacio">Sin festivos.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="pieVentana">
              <button className="boton" onClick={onCerrar}>Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- PANTALLA CONVENIOS ----

export function PantallaConvenios({ servidor, token, onVolver }: {
  servidor: string;
  token: string;
  onVolver: () => void;
}): ReactNode {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [anchoConv, setAnchoConv] = useState(190);
  const [bajaConvenios, setBajaConvenios] = useState<number[]>([]);
  const [bajaFestivos, setBajaFestivos] = useState<Array<{ id: number; fecha: string }>>([]);
  const [seleccionado, setSeleccionado] = useState(-1);
  const [mostrarTablas, setMostrarTablas] = useState(false);
  const [centroOpciones, setCentroOpciones] = useState<number>(-1);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- carga ----

  function cargar(): void {
    setOcupado(true);
    setError(null);
    api<{ convenios: Convenio[] }>(servidor, token, "convenios")
      .then((r) => {
        setConvenios(r.convenios);
        setSeleccionado(r.convenios.length > 0 ? r.convenios.length - 1 : -1);
        setMostrarTablas(false);
        setCentroOpciones(-1);
        setBajaConvenios([]);
        setBajaFestivos([]);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(cargar, [servidor, token]);

  const conv = seleccionado >= 0 && seleccionado < convenios.length
    ? convenios[seleccionado] as Convenio
    : null;
  const opciones: OpcionesCentro[] = conv?.opcionesCentro ?? [];
  const ops = centroOpciones >= 0 && centroOpciones < opciones.length
    ? opciones[centroOpciones] as OpcionesCentro
    : null;

  /** Cambia un campo del convenio seleccionado (copia directa de estado). */
  function cambiar(cambios: Partial<Convenio>): void {
    if (seleccionado < 0) return;
    setConvenios(convenios.map((c, i) => (i === seleccionado ? { ...c, ...cambios } : c)));
  }

  function cambiarOpciones(cambios: Partial<OpcionesCentro>): void {
    if (conv === null || ops === null) return;
    cambiar({
      opcionesCentro: conv.opcionesCentro.map((o) => (o === ops ? { ...o, ...cambios } : o)),
    });
  }

  function cambiarTabla(t: TablaSalarial, cambios: Partial<TablaSalarial>): void {
    if (conv === null) return;
    cambiar({
      tablasSalariales: conv.tablasSalariales.map((x) => (x === t ? { ...x, ...cambios } : x)),
    });
  }

  // ---- comandos ----

  /** Crea el convenio de un año copiando el más reciente (`AñadirCommand`). */
  async function añadir(): Promise<void> {
    const texto = await pedirTexto("Nuevo convenio", "Año de validez:", String(new Date().getFullYear() + 1));
    if (texto === null) return;
    const año = Number.parseInt(texto, 10);
    if (!Number.isInteger(año)) return;
    if (convenios.some((c) => c.año === año)) {
      window.alert("Ya existe un convenio con ese año de validez. Selecciona otro año.");
      return;
    }
    const origen = convenios.length > 0
      ? convenios.reduce((a, b) => (b.año > a.año ? b : a)) as Convenio
      : null;
    let nuevo: Convenio;
    if (origen === null) {
      nuevo = nuevoConvenio();
      nuevo.tablasSalariales = CATEGORIAS.map((cat) => nuevaTablaSalarial({ categoria: cat }));
    } else {
      // `Copiar`: JSON round-trip con Ids a 0 y sin festivos.
      nuevo = JSON.parse(JSON.stringify(origen)) as Convenio;
      delete nuevo.id;
      nuevo.tablasSalariales = nuevo.tablasSalariales.map((t) => ({ ...t, id: undefined }));
      nuevo.opcionesCentro = nuevo.opcionesCentro.map((o) => ({
        ...o, id: undefined, festivos: [],
      }));
    }
    nuevo.año = año;
    for (const centro of CENTROS_REALES) {
      if (nuevo.opcionesCentro.some((o) => o.centro === centro)) continue;
      nuevo.opcionesCentro.push({
        centro,
        numerosL: null, numerosV: null, numerosS: null, numerosF: null, numerosR: null,
        limpiezasMes: 0, pagarPlusViaje: false, importePlusViaje: 0, festivos: [],
      });
    }
    setConvenios([...convenios, nuevo]);
    setSeleccionado(convenios.length);
  }

  function borrar(): void {
    if (conv === null || seleccionado < 0) return;
    if (!window.confirm(
      `Vas a borrar el convenio del año ${conv.año}.\n\nEsta acción elimina todos los datos del convenio y no puede deshacerse.\n\n¿Estás seguro?`,
    )) return;
    if ((conv.id ?? 0) > 0) setBajaConvenios([...bajaConvenios, conv.id as number]);
    setConvenios(convenios.filter((_, i) => i !== seleccionado));
    setSeleccionado(convenios.length > 1 ? convenios.length - 2 : -1);
  }

  /** `IncrementarImportes`: porcentaje pedido en el diálogo, cálculo en cliente. */
  async function incrementar(): Promise<void> {
    if (conv === null || seleccionado < 0) return;
    const texto = await pedirTexto(
      "Incrementar importes",
      "Introduce el porcentaje en el que se incrementarán los importes. También se incrementarán las tablas salariales y el plus viaje.",
    );
    if (texto === null) return;
    const porcentaje = Number(texto.trim().replace(",", "."));
    if (!Number.isFinite(porcentaje) || porcentaje === 0) return;
    const siguiente = JSON.parse(JSON.stringify(conv)) as Convenio;
    incrementarImportes(siguiente, porcentaje);
    setConvenios(convenios.map((c, i) => (i === seleccionado ? siguiente : c)));
  }

  async function añadirFestivo(): Promise<void> {
    if (ops === null || conv === null) return;
    const defecto = `01/01/${conv.año}`;
    const texto = await pedirTexto("Nuevo festivo", "Fecha (dd/mm/aaaa):", defecto);
    if (texto === null) return;
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
    if (m === null) return;
    const fecha = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (ops.festivos.some((f) => f.fecha === fecha)) {
      window.alert("Ya existe un festivo con esa fecha");
      return;
    }
    const f: Festivo = { fecha };
    cambiarOpciones({ festivos: [...ops.festivos, f] });
  }

  /** Borrado de un festivo: va en la lista de bajas (como `Festivos.Borrar`). */
  function borrarFestivo(f: Festivo): void {
    if (ops === null) return;
    if ((f.id ?? 0) > 0 && !bajaFestivos.some((x) => x.id === f.id)) {
      setBajaFestivos([...bajaFestivos, { id: f.id as number, fecha: f.fecha }]);
    }
    cambiarOpciones({ festivos: ops.festivos.filter((x) => x !== f) });
  }

  /** «Deshacer borrar»: devuelve el último festivo borrado del centro. */
  function deshacerFestivo(): void {
    if (ops === null || bajaFestivos.length === 0) return;
    const ultimo = bajaFestivos[bajaFestivos.length - 1] as { id: number; fecha: string };
    setBajaFestivos(bajaFestivos.slice(0, -1));
    cambiarOpciones({ festivos: [...ops.festivos, { id: ultimo.id, fecha: ultimo.fecha }] });
  }

  /** Copia los festivos del centro actual al resto, sustituyendo los suyos. */
  function propagarFestivos(): void {
    if (conv === null || ops === null) return;
    if (!window.confirm("Los festivos actuales de los otros centros serán eliminados.\n\n¿Quieres continuar?")) return;
    // Port de `Festivos.Borrados.AddRange(o.Festivos)` para los otros centros:
    const bajasNuevas = conv.opcionesCentro
      .filter((o) => o !== ops)
      .flatMap((o) => o.festivos)
      .filter((f) => (f.id ?? 0) > 0)
      .filter((f) => !bajaFestivos.some((x) => x.id === f.id))
      .map((f) => ({ id: f.id as number, fecha: f.fecha }));
    setBajaFestivos([...bajaFestivos, ...bajasNuevas]);
    cambiar({
      opcionesCentro: conv.opcionesCentro.map((o) =>
        o === ops ? o : { ...o, festivos: ops.festivos.map((f) => ({ fecha: f.fecha })) }),
    });
  }

  /** `Guardar`: baja de festivos → baja de convenios → altas → cambios → recarga. */
  async function guardar(): Promise<void> {
    setOcupado(true);
    setError(null);
    try {
      if (bajaFestivos.length > 0) {
        await api(servidor, token, "convenios/festivos/lista", {
          metodo: "DELETE",
          cuerpo: bajaFestivos.map((f) => ({ id: f.id })),
        });
      }
      for (const id of bajaConvenios) {
        await api(servidor, token, `convenios/${id}`, { metodo: "DELETE" });
      }
      for (const c of convenios) {
        if (c.id === undefined || c.id === 0) {
          const r = await api<{ id: number }>(servidor, token, "convenios", { metodo: "POST", cuerpo: c });
          c.id = r.id;
        } else {
          await api(servidor, token, `convenios/${c.id}`, { metodo: "PUT", cuerpo: c });
        }
      }
      setBajaConvenios([]);
      setBajaFestivos([]);
      cargar();
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  // ---- render ----

  return (
    <div className="pagina paginaConveniosO2">
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver} disabled={ocupado}>← Volver</button>
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
        <span className="hueco" />
        <button className="boton" onClick={() => void guardar()} disabled={ocupado || convenios.length === 0}>💾 Guardar y Actualizar</button>
        <button className="boton" onClick={cargar} disabled={ocupado}>↺ Descartar Cambios</button>
      </div>
      <div className="conveniosCuerpo conveniosCuerpoO2">
        <div className="panelPrincipalGraficos panelConvenios" style={{ flex: `0 0 ${anchoConv}px` }}>
          <div className="bandaTitulo">Convenios</div>
          <div className="barraPanel">
            <button className="boton" onClick={() => void añadir()} disabled={ocupado}>＋</button>
            <button className="boton" onClick={borrar} disabled={ocupado || conv === null}>－</button>
          </div>
          <div className="marcoRejilla">
            <table className="rejilla rejillaConvenios">
              <tbody>
                {[...convenios].sort((a, b) => b.año - a.año).map((c) => (
                  <tr
                    key={c.id ?? `nuevo${c.año}`}
                    className={c === conv ? "sel" : undefined}
                    onClick={() => { setSeleccionado(convenios.indexOf(c)); setCentroOpciones(-1); }}
                  >
                    <td className="num">{c.año}</td>
                  </tr>
                ))}
                {convenios.length === 0 ? <tr><td className="vacio">Sin convenios.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
        <SeparadorV ancho={anchoConv} onAncho={setAnchoConv} min={120} max={600} />
        <div className="panelPrincipalGraficos panelDetalleConvenio">
          <div className="bandaTitulo">CONVENIO: {conv?.año ?? "-"}</div>
          {conv === null ? (
            <p className="vacio conMargen">Selecciona un convenio.</p>
          ) : (
            <>
              <div className="parametrosCuerpo">
                {GRUPOS.map((grupo) => (
                  <div key={grupo.titulo} className="panelParametros">
                    <div className="bandaTituloGris">{grupo.titulo}</div>
                    <div className="filasParametros">
                      {grupo.campos.map(([campo, etiqueta, tipo]) => (
                        <div key={campo} className="filaParametro">
                          <span className="nombreParametro">{etiqueta}</span>
                          <input
                            className="valorParametro"
                            value={textoDe(campo, conv[campo], tipo)}
                            onChange={(e) => {
                              const v = valorDe(e.target.value, tipo);
                              if (v !== null) cambiar({ [campo]: v } as Partial<Convenio>);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="botonesConvenio">
                <button className="botonAccion" onClick={() => setMostrarTablas(true)}>Tablas Salariales</button>
                <button className="botonAccion" onClick={() => void incrementar()} disabled={ocupado}>Incrementar importes</button>
              </div>
              <p className="tituloCentros">Opciones específicas de cada centro:</p>
              <div className="botonesCentros">
                {opciones.map((o, i) => (
                  <button
                    key={o.id ?? o.centro}
                    className="botonAccion"
                    onClick={() => setCentroOpciones(i)}
                  >
                    {NOMBRES_CENTRO[o.centro] ?? ""}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {mostrarTablas && conv !== null ? (
        <VentanaTablas conv={conv} onCambiarTabla={cambiarTabla} onCerrar={() => setMostrarTablas(false)} />
      ) : null}
      {centroOpciones >= 0 && ops !== null && conv !== null ? (
        <VentanaOpciones
          conv={conv}
          ops={ops}
          bajaFestivos={bajaFestivos}
          onCambiarOpciones={cambiarOpciones}
          onCambiar={cambiar}
          onAñadirFestivo={() => void añadirFestivo()}
          onBorrarFestivo={borrarFestivo}
          onDeshacerFestivo={deshacerFestivo}
          onPropagar={propagarFestivos}
          onCerrar={() => setCentroOpciones(-1)}
        />
      ) : null}
    </div>
  );
}
