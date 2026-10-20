/**
 * Crea (o actualiza) el superusuario inicial de la BD local, equivalente al
 * `UsuarioInicial` de la configuración del sistema anterior.
 *
 * Uso: node scripts/crearSuperUsuario.ts <usuario> <email> <clave>
 * Requiere DATABASE_URL definida (ver README del paquete).
 */
import pg from "pg";
import { hashContrasena, ITERACIONES_CONTRASENA } from "../src/contrasena.ts";

const [usuario, email, clave] = process.argv.slice(2);
if (!usuario || !email || !clave) {
  console.error("Uso: node scripts/crearSuperUsuario.ts <usuario> <email> <clave>");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const hoy = new Date().toISOString().slice(0, 10);
  const hash = hashContrasena(clave, { iteraciones: ITERACIONES_CONTRASENA });
  const resultado = await pool.query(
    `INSERT INTO "AspNetUsers"
       ("Matricula", "Nombre", "Apellidos", "FechaAlta", "IsAfiliado", "IsAdmin", "IsSuper",
        "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed", "PasswordHash",
        "SecurityStamp", "ConcurrencyStamp", "PhoneNumberConfirmed", "TwoFactorEnabled",
        "LockoutEnabled", "AccessFailedCount")
     VALUES (0, 'Administrador', '', $1, false, true, true,
             $2, $3, $4, $5, true, $6,
             $7, $8, true, false, true, 0)
     ON CONFLICT DO NOTHING
     RETURNING "Id"`,
    [
      `${hoy} 00:00:00`,
      usuario, usuario.toUpperCase(), email, email.toUpperCase(),
      hash,
      crypto.randomUUID(), crypto.randomUUID(),
    ],
  );
  if (resultado.rowCount === 0) {
    console.log(`El usuario "${usuario}" ya existía (o colisión); no se modificó nada.`);
  } else {
    console.log(`Superusuario creado: "${usuario}" (Id ${resultado.rows[0].Id}).`);
  }
} finally {
  await pool.end();
}
