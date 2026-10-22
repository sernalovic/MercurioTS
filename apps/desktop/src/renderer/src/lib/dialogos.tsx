/**
 * Port de `Dialogos.Pedir` del original: diálogo modal de entrada de texto.
 * `window.prompt` no existe en Electron, así que la SPA usa este modal
 * (el original abría un `InputWindow` con el mismo papel). El host se monta
 * una vez en `App.tsx`; las pantallas solo llaman a `pedirTexto`, que
 * resuelve con el texto introducido o null si se cancela.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type Petición = {
  titulo: string;
  mensaje: string;
  defecto: string;
  resolver: (valor: string | null) => void;
};

let enEspera: Petición | null = null;
const oyentes = new Set<() => void>();

/** Pide un texto al usuario (equivalente a `Dialogos.Pedir`). */
export function pedirTexto(titulo: string, mensaje: string, defecto = ""): Promise<string | null> {
  return new Promise((resolver) => {
    enEspera = { titulo, mensaje, defecto, resolver };
    oyentes.forEach((o) => o());
  });
}

export function PedirHost(): ReactNode {
  const [petición, setPetición] = useState<Petición | null>(enEspera);
  const [valor, setValor] = useState(enEspera?.defecto ?? "");

  useEffect(() => {
    const notificar = (): void => {
      setPetición(enEspera);
      setValor(enEspera?.defecto ?? "");
    };
    oyentes.add(notificar);
    return () => { oyentes.delete(notificar); };
  }, []);

  if (petición === null) return null;

  const resolverDe = petición.resolver;

  function responder(valorNulo: string | null): void {
    enEspera = null;
    oyentes.forEach((o) => o());
    resolverDe(valorNulo);
  }

  function enviar(e: FormEvent): void {
    e.preventDefault();
    responder(valor);
  }

  return (
    <div className="velo" onClick={() => responder(null)}>
      <form className="ventanaPedir" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
        <h3>{petición.titulo}</h3>
        <p>{petición.mensaje}</p>
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") responder(null);
          }}
        />
        <div className="opcionesVentana">
          <button type="submit" className="botonPrincipal">Aceptar</button>
          <button type="button" className="boton" onClick={() => responder(null)}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
