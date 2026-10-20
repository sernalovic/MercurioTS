/**
 * Port de la tabla de mapeo dominio ↔ BD. Convertir filas del esquema
 * (`schema.ts`) en entidades del dominio (`@mercurio/domain`) queda para
 * los repositorios; aquí solo las utilidades de conversión de tipo.
 */
export * from "./convertir";
export * from "./schema";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/** Crea el `Pool` de conexiones. `url` tipo postgresql://usuario:clave@host:puerto/bd. */
export function crearPool(url: string): pg.Pool {
  return new pg.Pool({ connectionString: url });
}

/** Crea el cliente Drizzle para consultas tipadas. */
export function crearDb(url: string): Db {
  return drizzle(crearPool(url), { schema });
}
