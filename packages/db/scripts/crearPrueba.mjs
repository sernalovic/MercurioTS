/* Crea el usuario de pruebas `prueba` (admin + super) con hash de Identity. */
import fs from "fs";
import crypto from "crypto";
import pg from "pg";
import { hashContrasena } from "../src/contrasena.ts";

const env = fs.readFileSync("../../apps/web/.env.local", "utf8");
const m = /^DATABASE_URL=postgresql:\/\/postgres:([^@]+)@localhost:5432\/mercurio_ts$/m.exec(env);
const clave = m === null ? "" : m[1];
const pool = new pg.Pool({ connectionString: `postgresql://postgres:${encodeURIComponent(clave)}@localhost:5432/mercurio_ts` });

const existe = await pool.query(`SELECT "Id" FROM "AspNetUsers" WHERE "NormalizedUserName" = 'PRUEBA'`);
if (existe.rows.length > 0) {
  console.log("el usuario prueba ya existe (Id " + existe.rows[0].Id + ")");
} else {
  const hash = hashContrasena("Mercurio-2026!");
  const r = await pool.query(
    `INSERT INTO "AspNetUsers"
       ("Matricula", "Nombre", "Apellidos", "FechaAlta", "IsAfiliado", "IsAdmin", "IsSuper",
        "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed",
        "PasswordHash", "SecurityStamp", "ConcurrencyStamp", "LockoutEnabled", "AccessFailedCount",
        "PhoneNumberConfirmed", "TwoFactorEnabled")
     VALUES (1, 'Prueba', 'Admin', now(), false, true, true,
             'prueba', 'PRUEBA', 'prueba@mercurio.local', 'PRUEBA@MERCURIO.LOCAL', true,
             $1, $2, $3, true, 0, false, false) RETURNING "Id"`,
    [hash, crypto.randomBytes(16).toString("hex"), crypto.randomUUID()],
  );
  console.log("usuario prueba creado con Id", r.rows[0].Id);
}
await pool.end();
