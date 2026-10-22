/**
 * Shell del escritorio: monta la barra superior y decide qué pantalla
 * se ve (acceso → menú → pantallas). El par (centro, mes) es el estado
 * global que recargaba cada vista en el original.
 */
import { useEffect, useState, type ReactNode } from "react";
import { leerConfig, guardarConfig, type Configuracion } from "./lib/configuracion";
import { entrar, verificar, type SesionInfo } from "./lib/api";
import { PantallaAcceso } from "./pantallas/Acceso";
import { PantallaMenu } from "./pantallas/Menu";
import { PantallaConductores } from "./pantallas/Conductores";
import { PantallaCalendarios } from "./pantallas/Calendarios";
import { PantallaCalendariosConductor, type ConductorContexto } from "./pantallas/CalendariosConductor";
import { Barra } from "./componentes/Barra";
import { PantallaPendiente } from "./pantallas/Pendiente";

/** Pantallas navegables: mismos tiles que el menú del original. */
export type NombrePantalla =
  | "menu"
  | "conductores"
  | "graficos"
  | "calendarios"
  | "calendariosConductor"
  | "reclamaciones"
  | "nominas"
  | "convenios"
  | "lineas"
  | "informes"
  | "herramientas"
  | "usuarios";

export function App(): ReactNode {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [sesion, setSesion] = useState<SesionInfo | null>(null);
  const [centro, setCentro] = useState("");
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [pantalla, setPantalla] = useState<NombrePantalla>("menu");
  const [conductorContexto, setConductorContexto] = useState<ConductorContexto | null>(null);

  // Al abrir: si hay token guardado aún válido se recupera la sesión.
  useEffect(() => {
    void (async () => {
      const guardada = await leerConfig();
      setConfig(guardada);
      setCentro(guardada.UltimoCentro);
      setPantalla("menu");
      if (guardada.Token && guardada.Expira > Date.now()) {
        try {
          const resultado = await verificar(guardada.Servidor, guardada.Token);
          setSesion(resultado.sesion);
        } catch {
          setSesion(null);
        }
      }
    })();
  }, []);

  if (config === null) return null; // se está leyendo la configuración

  const guardar = (cambios: Partial<Configuracion>): void => {
    const nueva = { ...config, ...cambios };
    setConfig(nueva);
    void guardarConfig(nueva);
  };

  const iniciarSesion = (usuario: string, clave: string): Promise<void> =>
    (async () => {
      const resultado = await entrar(config.Servidor, usuario, clave);
      setSesion(resultado.usuario);
      guardar({
        Token: resultado.token,
        Expira: resultado.expira,
        UsuarioUltimo: usuario,
      });
    })();

  const cerrarSesion = (): void => {
    setSesion(null);
    guardar({ Token: "", Expira: 0 });
  };

  const cambiarCentro = (nuevo: string): void => {
    setCentro(nuevo);
    guardar({ UltimoCentro: nuevo });
  };

  if (!sesion) {
    return (
      <PantallaAcceso
        configuracion={config}
        onIniciar={iniciarSesion}
        onServidor={(servidor) => guardar({ Servidor: servidor })}
      />
    );
  }

  return (
    <div className="escritorio">
      <Barra
        sesion={sesion}
        expira={config.Expira}
        centro={centro}
        mes={mes}
        onCentro={cambiarCentro}
        onMes={setMes}
        onCerrar={cerrarSesion}
      />
      <main className="cuerpo">
        {pantalla === "menu" ? (
          <PantallaMenu sesion={sesion} irA={setPantalla} />
        ) : pantalla === "conductores" ? (
          <PantallaConductores
            servidor={config.Servidor}
            token={config.Token}
            centro={centro}
            onVolver={() => setPantalla("menu")}
            onVerCalendarios={(c) => {
              setConductorContexto(c);
              setPantalla("calendariosConductor");
            }}
          />
        ) : pantalla === "calendarios" ? (
          <PantallaCalendarios
            servidor={config.Servidor}
            token={config.Token}
            centro={centro}
            mes={mes}
            onVolver={() => setPantalla("menu")}
          />
        ) : pantalla === "calendariosConductor" && conductorContexto !== null ? (
          <PantallaCalendariosConductor
            servidor={config.Servidor}
            token={config.Token}
            conductor={conductorContexto}
            onVolver={() => setPantalla("conductores")}
          />
        ) : (
          <PantallaPendiente nombre={pantalla} irA={setPantalla} />
        )}
      </main>
    </div>
  );
}
