/**
 * Pantalla de acceso: usuario y clave contra la API, con la URL del
 * servidor plegable (Expander "Servidor" del `LoginView` original).
 */
import { useState, type ReactNode, type FormEvent } from "react";
import type { Configuracion } from "../lib/configuracion";

interface Propiedades {
  configuracion: Configuracion;
  onIniciar: (usuario: string, clave: string) => Promise<void>;
  onServidor: (servidor: string) => void;
}

export function PantallaAcceso({ configuracion, onIniciar, onServidor }: Propiedades): ReactNode {
  const [usuario, setUsuario] = useState(configuracion.UsuarioUltimo);
  const [clave, setClave] = useState("");
  const [servidor, setServidor] = useState(configuracion.Servidor);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (): Promise<void> => {
    if (usuario.trim() === "" || clave === "") {
      setError("Introduce el usuario y la clave.");
      return;
    }
    setError(null);
    setOcupado(true);
    try {
      if (servidor.trim() !== configuracion.Servidor.trim()) onServidor(servidor.trim());
      await onIniciar(usuario.trim(), clave);
    } catch (e) {
      setError(String((e as Error).message));
      setOcupado(false);
    }
  };

  const enviarCon = (e: FormEvent): void => {
    e.preventDefault();
    void enviar();
  };

  return (
    <div className="acceso">
      <form className="tarjeta" onSubmit={enviarCon}>
        <h1 className="logotipo">MERCURIO</h1>
        <p className="subtitulo">Portal de gráficos, nóminas y reclamaciones</p>

        <label className="etiqueta" htmlFor="usuario">Usuario</label>
        <input
          id="usuario"
          className="campo"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoFocus
        />

        <label className="etiqueta" htmlFor="clave">Contraseña</label>
        <input
          id="clave"
          className="campo"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoComplete="current-password"
        />

        <button type="button" className="plegable" onClick={() => setAbierto((v) => !v)}>
          {abierto ? "▾" : "▸"} Servidor
        </button>
        {abierto ? (
          <input
            className="campo"
            value={servidor}
            onChange={(e) => setServidor(e.target.value)}
            spellCheck={false}
          />
        ) : null}

        {error ? (
          <p className="error" role="alert">{error}</p>
        ) : null}

        <button type="submit" className="entrar" disabled={ocupado}>
          {ocupado ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
