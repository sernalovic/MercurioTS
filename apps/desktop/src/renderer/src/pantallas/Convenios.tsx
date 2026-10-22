/**
 * Pantalla Convenios — port de `ConveniosViewModel` + `ConveniosView`:
 * lista de años a la izquierda y pestañas «General» (campos del convenio),
 * «Tablas salariales» y «Opciones por centro» (números de gráfico, plus
 * viaje y festivos). Todos los cálculos («Incrementar importes») van en el
 * cliente con `CalculosNomina.IncrementarImportes` y nada persiste hasta
 * «Guardar»: baja de festivos → baja de convenios → altas → cambios → recarga.
 */
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { pedirTexto } from "../lib/dialogos";
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

/** Definición de los campos de la pestaña General (orden del XAML). */
type TipoCampo = "duracion" | "entero" | "importe" | "unidades" | "porcentaje";
const CAMPOS: Array<[keyof Convenio, string, TipoCampo]> = [
  ["jornadaMedia", "Jornada media", "duracion"],
  ["jornadaAnual", "Jornada anual (h)", "entero"],
  ["diasTrabajoAnuales", "Días trabajo anuales", "entero"],
  ["diasDescansoAnuales", "Días descanso anuales", "entero"],
  ["descansosSueltosAnuales", "Descansos sueltos anuales", "entero"],
  ["diasVacacionesAnuales", "Días vacaciones anuales", "entero"],
  ["findesCompletosAnuales", "Findes completos anuales", "entero"],
  ["diasTrabajadosSeguidos", "Máx. días trabajados seguidos", "entero"],
  ["descansosSueltosMes", "Descansos sueltos al mes", "entero"],
  ["minimoDescansosMes", "Mínimo descansos al mes", "entero"],
  ["maximoDescansosMes", "Máximo descansos al mes", "entero"],
  ["maximoFindesSeguidos", "Máx. findes trabajados seguidos", "entero"],
  ["jornadaMaxima", "Jornada máxima", "duracion"],
  ["jornadaMaximaFindes", "Jornada máxima findes", "duracion"],
  ["jornadaMaximaPartida", "Jornada máxima partida", "duracion"],
  ["tiempoPartidoMaximo", "Tiempo partido máximo", "duracion"],
  ["inicioNocturnas", "Inicio nocturnas", "duracion"],
  ["finalNocturnas", "Final nocturnas", "duracion"],
  ["limiteDesayuno", "Límite desayuno", "duracion"],
  ["inicioComidaContinuo", "Comida continua (inicio)", "duracion"],
  ["finalComidaContinuo", "Comida continua (final)", "duracion"],
  ["inicioComidaPartido", "Comida partida (inicio)", "duracion"],
  ["finalComidaPartido", "Comida partida (final)", "duracion"],
  ["inicioCena", "Cena (inicio)", "duracion"],
  ["finalCena", "Cena (final)", "duracion"],
  ["limitePlusCena", "Límite plus cena", "duracion"],
  ["porcentajeDesayuno", "% desayuno", "porcentaje"],
  ["porcentajePlusCena", "% plus cena", "porcentaje"],
  ["maximoLimpiezas", "Máximo limpiezas", "entero"],
  ["importeDietas", "Importe dietas", "importe"],
  ["importePlusFestivos", "Plus festivos", "importe"],
  ["importePlusSabados", "Plus sábados", "importe"],
  ["importePlusMenorDescanso", "Plus menor descanso (€/h)", "importe"],
  ["importePlusLimpieza", "Plus limpieza", "importe"],
  ["importePlusPaqueteria", "Plus paquetería", "importe"],
  ["importePlusNocturnidad", "Plus nocturnidad", "importe"],
  ["importePlusNocturnidadDiario", "Plus nocturnidad (por hora)", "importe"],
  ["importePlusNavidad", "Plus Navidad", "importe"],
  ["importeRefuerzos", "Importe refuerzos", "importe"],
];

/** Columnas de la rejilla de tablas salariales (XAML). */
const COLUMNAS_TABLA: Array<[keyof TablaSalarial, string, TipoCampo]> = [
  ["sueldoBaseDiario", "Sueldo diario", "importe"],
  ["sueldoBaseMensual", "Sueldo mensual", "importe"],
  ["sueldoBaseAnual", "Sueldo anual", "importe"],
  ["complementoSalarial", "Complemento", "importe"],
  ["baseAntiguedad", "Base antigüedad", "importe"],
  ["precioHoraExtra", "Hora extra", "importe"],
  ["precioQuebrantoMoneda", "Quebranto", "importe"],
  ["pagaSeptiembre", "Paga sept.", "importe"],
  ["importeDndCobrado", "DND cobrado", "importe"],
  ["seguroAccidentes", "Seguro acc.", "importe"],
  ["porcentajeSeguridadSocial", "% S.S.", "unidades"],
  ["porcentajeDesempleo", "% desempleo", "unidades"],
];

/** "AAAA-MM-DD" → "dddd dd/MM/yyyy" del original (StringFormat es-ES). */
function fechaLarga(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const d = new Date(`${fecha}T12:00:00`);
  return `${dias[d.getDay()]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
}

/**texto de un campo según su tipo (la edición de vuelta la hace `valorDe`). */
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

export function PantallaConvenios({ servidor, token, onVolver }: {
  servidor: string;
  token: string;
  onVolver: () => void;
}): ReactNode {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [bajaConvenios, setBajaConvenios] = useState<number[]>([]);
  const [bajaFestivos, setBajaFestivos] = useState<Array<{ id: number }>>([]);
  const [seleccionado, setSeleccionado] = useState(-1);
  const [indiceOpciones, setIndiceOpciones] = useState(0);
  const [pestana, setPestana] = useState<"general" | "tablas" | "opciones">("general");
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
        setIndiceOpciones(0);
        setPestana("general");
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
  const ops = indiceOpciones >= 0 && indiceOpciones < opciones.length
    ? opciones[indiceOpciones] as OpcionesCentro
    : null;

  /** Cambia un campo del convenio seleccionado (copia directa de estado). */
  function cambiar(cambios: Partial<Convenio>): void {
    if (seleccionado < 0) return;
    setConvenios(convenios.map((c, i) => (i === seleccionado ? { ...c, ...cambios } : c)));
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
    setIndiceOpciones(0);
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
      setBajaFestivos([...bajaFestivos, { id: f.id as number }]);
    }
    cambiarOpciones({ festivos: ops.festivos.filter((x) => x !== f) });
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
      .map((f) => ({ id: f.id as number }));
    setBajaFestivos([...bajaFestivos, ...bajasNuevas]);
    cambiar({
      opcionesCentro: conv.opcionesCentro.map((o) =>
        o === ops ? o : { ...o, festivos: ops.festivos.map((f) => ({ fecha: f.fecha })) }),
    });
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

  /** `Guardar`: baja de festivos → baja de convenios → altas → cambios → recarga. */
  async function guardar(): Promise<void> {
    setOcupado(true);
    setError(null);
    try {
      if (bajaFestivos.length > 0) {
        await api(servidor, token, "convenios/festivos/lista", { metodo: "DELETE", cuerpo: bajaFestivos });
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
    <div className="pagina">
      <div className="cabeceraPagina">
        <h2 className="tituloPagina">Convenios</h2>
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
      </div>
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver} disabled={ocupado}>Volver</button>
        <button className="boton" onClick={cargar} disabled={ocupado}>Recargar</button>
        <button className="boton" onClick={añadir} disabled={ocupado}>Nuevo convenio</button>
        <button className="boton" onClick={borrar} disabled={ocupado || conv === null}>Borrar</button>
        <button className="boton" onClick={incrementar} disabled={ocupado || conv === null}>Incrementar importes</button>
        <button className="boton principal" onClick={guardar} disabled={ocupado || convenios.length === 0}>Guardar</button>
      </div>
      <div className="conveniosCuerpo">
        <div className="conveniosLista">
          {convenios.map((c, i) => (
            <button
              key={c.id ?? `nuevo${c.año}`}
              className={`filaLista${i === seleccionado ? " sel" : ""}`}
              onClick={() => { setSeleccionado(i); setIndiceOpciones(0); }}
            >
              {c.año}
            </button>
          ))}
        </div>
        {conv === null ? (
          <p className="pendiente">Selecciona un convenio.</p>
        ) : (
          <div className="conveniosDetalle">
            <div className="pestañas">
              <button className={pestana === "general" ? "sel" : ""} onClick={() => setPestana("general")}>General</button>
              <button className={pestana === "tablas" ? "sel" : ""} onClick={() => setPestana("tablas")}>Tablas salariales</button>
              <button className={pestana === "opciones" ? "sel" : ""} onClick={() => setPestana("opciones")}>Opciones por centro</button>
            </div>
            {pestana === "general" ? (
              <div className="conveniosGeneral">
                {CAMPOS.map(([campo, etiqueta, tipo]) => (
                  <div key={campo} className="campoEtiqueta">
                    <span>{etiqueta}</span>
                    <input
                      className="celda"
                      value={textoDe(campo, conv[campo], tipo)}
                      onChange={(e) => {
                        const v = valorDe(e.target.value, tipo);
                        if (v !== null) cambiar({ [campo]: v } as Partial<Convenio>);
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : pestana === "tablas" ? (
              <table className="rejilla tablasSalariales">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    {COLUMNAS_TABLA.map(([, et]) => <th key={et}>{et}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {conv.tablasSalariales.map((t) => (
                    <tr key={t.id ?? `n${t.categoria}`}>
                      <td>
                        <select
                          className="celda"
                          value={String(t.categoria)}
                          onChange={(e) => cambiarTabla(t, { categoria: Number(e.target.value) as CategoriaTrabajador })}
                        >
                          {CATEGORIAS.map((v) => <option key={v} value={String(v)}>{nombreEnum(CategoriaTrabajador, v)}</option>)}
                        </select>
                      </td>
                      {COLUMNAS_TABLA.map(([campo, , tipo]) => (
                        <td key={campo}>
                          <input
                            className="celda"
                            value={textoDe(campo, t[campo], tipo)}
                            onChange={(e) => {
                              const v = valorDe(e.target.value, tipo);
                              if (v !== null) cambiarTabla(t, { [campo]: v } as Partial<TablaSalarial>);
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="conveniosOpciones">
                <div className="campoEtiqueta">
                  <span>Centro:</span>
                  <select
                    className="celda"
                    value={String(indiceOpciones)}
                    onChange={(e) => setIndiceOpciones(Number(e.target.value))}
                  >
                    {opciones.map((o, i) => (
                      <option key={o.id ?? i} value={String(i)}>{nombreEnum(CentroTrabajo, o.centro)}</option>
                    ))}
                  </select>
                </div>
                {ops === null ? (
                  <p className="pendiente">El convenio no tiene opciones para este centro.</p>
                ) : (
                  <>
                    <div className="conveniosOpcionesDatos">
                      <h3 className="tituloSeccion">Números de gráfico por tipo de día (p. ej. 1-50, 60)</h3>
                      {([["numerosL", "Lunes a jueves"], ["numerosV", "Viernes"], ["numerosS", "Sábados"], ["numerosF", "Festivos"], ["numerosR", "Reserva"]] as const).map(([campo, et]) => (
                        <div key={campo} className="campoEtiqueta corto">
                          <span>{et}</span>
                          <input
                            className="celda ancho"
                            value={ops[campo] ?? ""}
                            onChange={(e) => cambiarOpciones({ [campo]: e.target.value === "" ? null : e.target.value } as Partial<OpcionesCentro>)}
                          />
                        </div>
                      ))}
                      <div className="campoEtiqueta corto"><span>Limpiezas al mes</span>
                        <input
                          className="celda"
                          value={String(ops.limpiezasMes)}
                          onChange={(e) => {
                            const v = Number.parseInt(e.target.value, 10);
                            if (Number.isInteger(v)) cambiarOpciones({ limpiezasMes: v });
                          }}
                        />
                      </div>
                      <label className="casilla">
                        <input
                          type="checkbox"
                          checked={ops.pagarPlusViaje}
                          onChange={(e) => cambiarOpciones({ pagarPlusViaje: e.target.checked })}
                        />
                        Pagar plus viaje
                      </label>
                      <div className="campoEtiqueta corto"><span>Importe plus viaje</span>
                        <input
                          className="celda"
                          value={importe(ops.importePlusViaje)}
                          onChange={(e) => cambiarOpciones({ importePlusViaje: centimosDe(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="conveniosFestivos">
                      <div className="cabeceraFestivos">
                        <h3 className="tituloSeccion">Festivos</h3>
                        <button className="boton" onClick={añadirFestivo}>Añadir festivo</button>
                        <button className="boton" onClick={propagarFestivos}>Copiar a otros centros</button>
                      </div>
                      <table className="rejilla rejillaFestivos">
                        <thead><tr><th>Fecha</th><th /></tr></thead>
                        <tbody>
                          {[...ops.festivos].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((f) => (
                            <tr key={f.id ?? f.fecha}>
                              <td>{fechaLarga(f.fecha)}</td>
                              <td><button className="boton" onClick={() => borrarFestivo(f)}>Borrar</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
