/**
 * Cliente de base de datos de la web. Un único pool por proceso, creado la
 * primera vez que se solicita mediante `getDb()`.
 */
import { crearDb, type Db } from "@mercurio/db";

let instancia: Db | undefined;

export function getDb(): Db {
  if (instancia === undefined) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "Falta DATABASE_URL en el entorno (copia apps/web/.env.example a apps/web/.env.local).",
      );
    }
    instancia = crearDb(url);
  }
  return instancia;
}
