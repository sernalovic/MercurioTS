/* Estado tras la importación: reclamaciones del 450 por mes, calendarios 2026, usuarios admin. */
import fs from "fs";
import pg from "pg";

const env = fs.readFileSync("../../apps/web/.env.local", "utf8");
const m = /^DATABASE_URL=postgresql:\/\/postgres:([^@]+)@localhost:5432\/mercurio_ts$/m.exec(env);
const clave = m === null ? "" : m[1];
const pool = new pg.Pool({ connectionString: `postgresql://postgres:${encodeURIComponent(clave)}@localhost:5432/mercurio_ts` });

const r1 = await pool.query(
  `SELECT r."Fecha", r."ConductorId", r."Cerrada", r."Id" FROM "Reclamaciones" r
   JOIN "Conductores" k ON k."Id" = r."ConductorId" WHERE k."Matricula" = 450 ORDER BY r."Fecha"`);
console.log("reclamaciones del 450:", JSON.stringify(r1.rows.map((x) => `${x.Id}:${x.Fecha.toISOString().slice(0, 10)} cerrada=${x.Cerrada}`)));

const r2 = await pool.query(
  `SELECT "Fecha", COUNT(*)::int AS n FROM "Calendarios" WHERE "Fecha" >= '2026-01-01' AND "Fecha" < '2027-01-01' GROUP BY 1 ORDER BY 1`);
console.log("calendarios 2026 por mes:", JSON.stringify(r2.rows));

const r3 = await pool.query(
  `SELECT "UserName", "IsAdmin", "IsSuper", ("LockoutEnd" IS NOT NULL AND "LockoutEnd" > now()) AS bloqueado, "Id"
   FROM "AspNetUsers" WHERE "NormalizedUserName" IN ('PRUEBA') `);
console.log("usuarios clave:", JSON.stringify(r3.rows));

const r4 = await pool.query(`SELECT COUNT(*)::int AS n FROM "Conductores" WHERE "Centro" = 1`);
console.log("conductores Donosti:", r4.rows[0].n);

await pool.end();
