/**
 * Tamaños de los separadores de paneles: se guardan en la configuración
 * local (campo `Medidas`, un mapa pantalla → píxeles) para que un panel
 * redimensionado en una sesión se recuerde en la siguiente. La escritura
 * se aplaza un poco (rebote) para no grabar en cada fotograma del
 * arrastre.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { leerConfig, guardarConfig } from "./configuracion";

/** Devuelve el valor guardado para la clave (o el defecto) y un setter que lo persiste. */
export function useMedida(clave: string, defecto: number): [number, (valor: number) => void] {
  const [valor, setValor] = useState(defecto);
  const reloj = useRef<number | undefined>(undefined);
  const pendiente = useRef<number | null>(null);

  useEffect(() => {
    let vivo = true;
    void leerConfig().then((c) => {
      const guardado = c.Medidas?.[clave];
      if (vivo && typeof guardado === "number" && guardado > 0) setValor(guardado);
    });
    return () => { vivo = false; };
  }, [clave]);

  // Al desmontar con una escritura pendiente (rebote aún sin disparar),
  // se pega ya el último tamaño arrastrado.
  useEffect(() => () => {
    window.clearTimeout(reloj.current);
    if (pendiente.current !== null) {
      const n = pendiente.current;
      pendiente.current = null;
      void leerConfig().then((c) =>
        guardarConfig({ ...c, Medidas: { ...(c.Medidas ?? {}), [clave]: n } }));
    }
  }, [clave]);

  const cambiar = useCallback((nuevo: number) => {
    setValor(nuevo);
    pendiente.current = nuevo;
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => {
      pendiente.current = null;
      void leerConfig().then((c) =>
        guardarConfig({ ...c, Medidas: { ...(c.Medidas ?? {}), [clave]: nuevo } }));
    }, 250);
  }, [clave]);

  return [valor, cambiar];
}
