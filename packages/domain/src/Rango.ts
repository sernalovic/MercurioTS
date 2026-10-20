/**
 * Port de `RangoNumeros` (Utilidades.cs): conjunto de números expresado como
 * "1-50, 60, 70..80" (extremos incluidos); el `..` también separa rangos.
 */
export class RangoNumeros {
  private readonly rangos: Array<{ desde: number; hasta: number }> = [];

  constructor(expresion?: string | null) {
    if (!expresion) return;
    const texto = expresion.replaceAll(" ", "").replaceAll("..", "-");
    for (const parte of texto.split(",")) {
      if (parte === "") continue;
      const limites = parte.split("-");
      const desdeTexto = limites[0];
      if (desdeTexto === undefined) continue;
      const desde = Number.parseInt(desdeTexto, 10);
      if (Number.isNaN(desde)) continue;
      let hasta = desde;
      const hastaTexto = limites[1];
      if (hastaTexto !== undefined) {
        const parseado = Number.parseInt(hastaTexto, 10);
        if (Number.isNaN(parseado)) continue;
        hasta = parseado;
      }
      if (desde === 0 && hasta === 0) continue;
      this.rangos.push({ desde, hasta });
    }
  }

  contiene(valor: number): boolean {
    return this.rangos.some((r) => valor >= r.desde && valor <= r.hasta);
  }
}
