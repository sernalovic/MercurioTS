/**
 * Pantalla Extraer gráficos — port de `ExtraerGraficosViewModel` + `ExtraerGraficosView`:
 * genera los gráficos de un grupo desde el texto de los PDF de la empresa
 * (port de `ExtraccionGraficos.Extraer`, ya en el dominio), los muestra en
 * dos rejillas de solo lectura y los guarda como grupos nuevos por centro
 * (REGLAS-CALCULO.md 16). El texto se abre con un `<input type=file>` y se
 * guarda con el diálogo del proceso principal.
 */
import { useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { duracionC, hora } from "../lib/horas";
import {
  CalculosHorario, CentroTrabajo, TipoDia, Turno, extraer, nombreEnum, nuevoGrafico,
  type Convenio, type Grafico, type Itinerario, type ItinerarioGrafico,
} from "@mercurio/domain";

const NOMBRES_CENTRO = ["Todos", "Donosti", "Bilbao", "Arrasate", "Vitoria", "Pruebas"];

/** "dd/MM/yyyy" → "AAAA-MM-DD", o null si no es válida. */
function fechaIso(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (m === null) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function PantallaExtraerGraficos({ servidor, token, centro, onVolver }: {
  servidor: string;
  token: string;
  centro: string;
  onVolver: () => void;
}): ReactNode {
  const [texto, setTexto] = useState("");
  const [fechaGrupo, setFechaGrupo] = useState(
    new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }),
  );
  const [graficos, setGraficos] = useState<Grafico[]>([]);
  const [indiceSeleccion, setIndiceSeleccion] = useState(-1);
  const [resumen, setResumen] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fecha con la que se generaron los gráficos de la lista (null = nada generado). */
  const [fechaGenerada, setFechaGenerada] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  const seleccionado = indiceSeleccion >= 0 && indiceSeleccion < graficos.length
    ? graficos[indiceSeleccion] as Grafico
    : null;
  const itinerarios: ItinerarioGrafico[] = seleccionado?.itinerarios ?? [];

  function calcularResumen(lista: Grafico[]): void {
    setResumen(lista.length === 0 ? "" : lista.map((g) => g.centro).filter((c, i, a) => a.indexOf(c) === i).map((c) => {
      const delCentro = lista.filter((g) => g.centro === c);
      const cuenta = (t: TipoDia): number => delCentro.filter((g) => g.tipoDia === t).length;
      return `${nombreEnum(CentroTrabajo, c)}: ${delCentro.length} gráficos ` +
        `(L-J ${cuenta(TipoDia.LunesJueves)}, V ${cuenta(TipoDia.Viernes)}, ` +
        `S ${cuenta(TipoDia.Sabado)}, F ${cuenta(TipoDia.Festivo)})`;
    }).join("   "));
  }

  // ---- comandos ----

  function abrirTexto(ficheros: FileList | null): void {
    if (ficheros === null || ficheros.length === 0) return;
    ficheros[0].text().then(setTexto).catch((e) => setError((e as Error).message));
  }

  async function guardarTexto(): Promise<void> {
    if (window.mercurio !== undefined) {
      await window.mercurio.guardarJson(texto, "Graficos.txt", { name: "Archivos de texto", extensions: ["txt"] });
    } else {
      const url = URL.createObjectURL(new Blob([texto], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "Graficos.txt";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  /** `Procesar`: catálogo de itinerarios + extracción del dominio. */
  async function procesar(): Promise<void> {
    setOcupado(true);
    setError(null);
    try {
      if (texto.trim() === "") { window.alert("Pega o abre primero el texto extraído de los PDF de gráficos."); return; }
      const fecha = fechaIso(fechaGrupo);
      if (fecha === null) { window.alert("Indica la fecha de validez del grupo (dd/mm/aaaa)."); return; }
      const r = await api<{ itinerarios: Itinerario[] }>(servidor, token, "itinerarios");
      const extraida = extraer(texto, fecha, r.itinerarios, NOMBRES_CENTRO.indexOf(centro) as CentroTrabajo);
      const ordenada = [...extraida.graficos].sort((a, b) => a.centro - b.centro || a.numero - b.numero);
      setGraficos(ordenada);
      setIndiceSeleccion(ordenada.length > 0 ? 0 : -1);
      setFechaGenerada(fecha);
      calcularResumen(ordenada);
      setAvisos(extraida.avisos);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  function borrar(): void {
    if (seleccionado === null || indiceSeleccion < 0) return;
    const restantes = graficos.filter((_, i) => i !== indiceSeleccion);
    setGraficos(restantes);
    setIndiceSeleccion(restantes.length > 0 ? Math.min(indiceSeleccion, restantes.length - 1) : -1);
    calcularResumen(restantes);
  }

  function borrarTodos(): void {
    if (graficos.length === 0) return;
    if (!window.confirm("Vas a borrar todos los gráficos generados.\n\n¿Quieres continuar?")) return;
    setGraficos([]);
    setIndiceSeleccion(-1);
    setAvisos([]);
    setFechaGenerada(null);
    calcularResumen([]);
  }

  /** `Guardar`: un grupo por cada centro de los gráficos generados (16.4). */
  async function guardar(): Promise<void> {
    if (graficos.length === 0 || fechaGenerada === null) return;
    setOcupado(true);
    setError(null);
    try {
      if (graficos.some((g) => g.centro === CentroTrabajo.Todos)) {
        window.alert("No se pueden guardar gráficos para todos los centros.\n\nSelecciona un centro arriba o indícalo en el texto y procesa de nuevo.");
        return;
      }
      const fechaNueva = fechaIso(fechaGrupo);
      if (fechaNueva !== null && fechaNueva !== fechaGenerada) {
        window.alert("La fecha del grupo ha cambiado desde que se generaron los gráficos.\n\nProcesa los gráficos de nuevo.");
        return;
      }
      const claveDe = (g: Grafico): string => `${g.centro}-${g.numero}`;
      const repetidos = [...new Set(graficos.map(claveDe).filter((c, i, a) => a.indexOf(c) !== i))]
        .map((c) => {
          const [centro, numero] = c.split("-");
          return `${numero} (${nombreEnum(CentroTrabajo, Number(centro))})`;
        });
      if (repetidos.length > 0) {
        window.alert(`Hay números de gráfico repetidos: ${repetidos.join(", ")}.\n\nBorra los que sobren antes de guardar.`);
        return;
      }
      const centros = [...new Set(graficos.map((g) => g.centro))].sort((a, b) => a - b);
      for (const c of centros) {
        const r = await api<{ existe: boolean }>(
          servidor, token, `graficos/existeGrupo?centro=${c}&fecha=${fechaGenerada}`);
        if (r.existe) {
          window.alert(`Ya existe un grupo con fecha ${fechaGenerada.split("-").reverse().join("-")} para el centro de ${nombreEnum(CentroTrabajo, c)}.`);
          return;
        }
      }

      // Como el original, cada grupo lleva también un gráfico número 0 sin horario.
      const nuevos = [...graficos.map((g) => JSON.parse(JSON.stringify(g)) as Grafico)];
      for (const c of centros) {
        if (!nuevos.some((g) => g.centro === c && g.numero === 0)) {
          nuevos.push(nuevoGrafico({ centro: c, fecha: fechaGenerada, numero: 0 }));
        }
      }

      const rc = await api<{ convenios: Convenio[] }>(servidor, token, "convenios");
      const convenio = rc.convenios.find((c) => c.año === Number(fechaGenerada.slice(0, 4))) ?? null;
      if (convenio !== null) {
        const calc = new CalculosHorario(convenio);
        for (const g of nuevos) calc.recalcularGrafico(g);
      }

      await api(servidor, token, "graficos", { metodo: "POST", cuerpo: nuevos });
      setGraficos([]);
      setIndiceSeleccion(-1);
      setAvisos([]);
      setFechaGenerada(null);
      setResumen("");
      window.alert(
        "Se han creado los siguientes grupos de gráficos\n\n" +
        centros.map((c) => `${fechaGenerada.split("-").reverse().join("-")} ${nombreEnum(CentroTrabajo, c)} ` +
          `(${nuevos.filter((g) => g.centro === c).length} gráficos)`).join("\n") +
        (convenio === null
          ? `\n\nNo existe el convenio de ${fechaGenerada.slice(0, 4)}: recalcula los gráficos en la pantalla Gráficos cuando lo crees.`
          : ""),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="pagina paginaExtraer">
      <div className="cabeceraPagina">
        <h2 className="tituloPagina">Extraer gráficos</h2>
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
      </div>
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver} disabled={ocupado}>Volver</button>
        <label className="boton botonFichero">
          Abrir texto
          <input type="file" accept=".txt,text/plain" hidden onChange={(e) => abrirTexto(e.target.files)} />
        </label>
        <button className="boton" onClick={guardarTexto} disabled={ocupado}>Guardar texto</button>
        <span className="etiqueta">Fecha de validez del grupo:</span>
        <input className="celda" value={fechaGrupo} onChange={(e) => setFechaGrupo(e.target.value)} />
        <button className="boton" onClick={procesar} disabled={ocupado}>Procesar</button>
        <button className="boton" onClick={borrar} disabled={ocupado || seleccionado === null}>Borrar gráfico</button>
        <button className="boton" onClick={borrarTodos} disabled={ocupado || graficos.length === 0}>Borrar todos</button>
        <button className="botonPrincipal" onClick={guardar} disabled={ocupado || graficos.length === 0}>Guardar grupos</button>
      </div>
      <p className="ayudaExtraer">
        Pega el texto copiado de los PDF de gráficos (o abre un .txt). Las líneas de día (lunes, viernes, sábado,
        festivos) y de centro (donosti, bilbao, arrasate, vitoria/gasteiz) fijan el tipo de día y el centro;
        &apos;grafikoa N&apos; abre un gráfico y &apos;balorazioa h:mm&apos; lo cierra. Si el texto no nombra el
        centro se usa el seleccionado arriba.
      </p>
      <div className="extraerCuerpo">
        <textarea
          className="textoExtraer"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          spellCheck={false}
        />
        <div className="extraerDerecha">
          <table className="rejilla">
            <thead>
              <tr><th>Centro</th><th>Nº</th><th>Tipo día</th><th>Turno</th><th>Inicio</th><th>Final</th><th>Valoración</th><th>Itinerarios</th></tr>
            </thead>
            <tbody>
              {graficos.map((g, i) => (
                <tr
                  key={`${g.centro}-${g.numero}`}
                  className={i === indiceSeleccion ? "sel" : undefined}
                  onClick={() => setIndiceSeleccion(i)}
                >
                  <td>{nombreEnum(CentroTrabajo, g.centro)}</td>
                  <td className="num">{g.numero}</td>
                  <td>{nombreEnum(TipoDia, g.tipoDia)}</td>
                  <td>{nombreEnum(Turno, g.turno)}</td>
                  <td className="num">{hora(g.inicio)}</td>
                  <td className="num">{hora(g.final)}</td>
                  <td className="num">{duracionC(g.valoracion)}</td>
                  <td className="num">{g.itinerarios.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="rejilla itinerariosExtraer">
            <thead>
              <tr><th>Inicio</th><th>Final</th><th>Itinerario</th><th>Descripción</th><th>Duración</th></tr>
            </thead>
            <tbody>
              {itinerarios.map((it, n) => (
                <tr key={n}>
                  <td className="num">{hora(it.inicio)}</td>
                  <td className="num">{hora(it.final)}</td>
                  <td>{it.itinerario ?? ""}</td>
                  <td>{it.descripcion ?? ""}</td>
                  <td className="num">{duracionC(it.tiempoTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="avisosExtraer">
            {avisos.map((a, n) => <p key={n}>{a}</p>)}
          </div>
        </div>
      </div>
      <p className="resumenExtraer">{resumen}</p>
    </div>
  );
}
