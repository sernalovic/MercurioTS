/**
 * Ayuda (enlace desde la insignia AYUDA del Calendario anual): cómo se
 * introduce la situación de cada día y qué significa cada código.
 */
import type { Metadata } from "next";
import Link from "next/link";
import styles from "../portal/_componentes/orion.module.css";
import { CODIGOS_ANUALES, ETIQUETA_INCIDENCIA } from "@/lib/situaciones";
import { Incidencia } from "@mercurio/domain";

export const metadata: Metadata = {
  title: "Ayuda · Mercurio",
};

export default function Pagina() {
  // Lista ordenada de código → etiqueta (los del Calendario anual).
  const codigos = (Object.keys(CODIGOS_ANUALES) as Array<keyof typeof CODIGOS_ANUALES>)
    .map((c) => ({ codigo: c, etiqueta: ETIQUETA_INCIDENCIA[CODIGOS_ANUALES[c]] }))
    .filter((x) => CODIGOS_ANUALES[x.codigo] !== Incidencia.Inactivo);

  return (
    <main className={styles.contenido}>
      <h2 className={styles.ayudaTitulo}>Ayuda</h2>
      <div className={styles.ayudaCaja}>
        <p>
          Las casillas del calendario anual aceptan un código por día: los
          <strong> números</strong> (por ejemplo <strong>3002</strong>) marcan un
          día de <strong>trabajo</strong> con ese número de gráfico, la{" "}
          <strong>T</strong> sola es trabajo sin gráfico, y las{" "}
          <strong>siglas</strong> colocan el descanso o la situación indicada.
        </p>
        <p>
          Deja la casilla <strong>vacía</strong> para vaciar el día.
        </p>
      </div>

      <table className={styles.ayudaTabla}>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Significado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1234</td>
            <td>Trabajo con el gráfico 1234</td>
          </tr>
          <tr>
            <td>T</td>
            <td>{ETIQUETA_INCIDENCIA[Incidencia.Trabajo]}</td>
          </tr>
          {codigos.map((c) => (
            <tr key={c.codigo}>
              <td>{c.codigo}</td>
              <td>{c.etiqueta}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.centroFila}>
        <Link className={styles.botonAzul} href="/portal">
          Volver
        </Link>
      </div>
    </main>
  );
}
