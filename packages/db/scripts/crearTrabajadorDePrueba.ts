/**
 * Sembrado de desarrollo: crea un trabajador de prueba con sus resúmenes
 * mensuales del año en curso, para poder ver la portada y el gráfico del
 * portal con (datos sintéticos; NADA de esto son datos reales). Además
 * vincula un usuario existente a esa matrícula (AspNetUsers.Matricula).
 *
 * Uso: node scripts/crearTrabajadorDePrueba.ts [matricula] [usuario]
 * Requiere DATABASE_URL definida (ver README del paquete).
 */
import pg from "pg";

const [matriculaArg, usuarioArg] = process.argv.slice(2);
const matricula = Number(matriculaArg) || 450;
const usuario = (usuarioArg ?? "PRUEBA").toUpperCase();
const ano = new Date().getFullYear();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");

  await pool.query("BEGIN");

  // ---- Trabajador (sin datos personales: sintético) ----
  const existente = await pool.query(
    `SELECT "Id" FROM "Conductores" WHERE "Matricula" = $1`,
    [matricula],
  );
  let conductorId: number;
  if (existente.rowCount === 0) {
    const creado = await pool.query(
      `INSERT INTO "Conductores"
         ("Centro", "Categoria", "Situacion", "Matricula", "IsUsuario", "FechaAntiguedad",
          "PorcentajeIrpf", "NumeroAfiliado", "IsReduccionJornada", "PorcentajeJornada",
          "Nombre", "Apellidos", "Telefono", "Email", "AcumuladasIniciales",
          "DcsIniciales", "DndsIniciales", "PlusDistancia", "Notas",
          "ModifiedDate", "ModifiedBy")
       VALUES (1, 0, 0, $1, false, '2020-01-01', '17.00', 3001, false, 100,
               'Conductor', 'De Prueba', NULL, NULL, '00:00:00',
               '20.86', '3.00', '0.00', NULL,
               $2, 1)
       RETURNING "Id"`,
      [matricula, ahora],
    );
    conductorId = creado.rows[0].Id;
    console.log(`Trabajador creado: matricula ${matricula} (ConductorId ${conductorId}).`);
  } else {
    conductorId = existente.rows[0].Id;
    console.log(`El trabajador de matricula ${matricula} ya existía (ConductorId ${conductorId}).`);
  }

  // Vincula el usuario de login a la matrícula.
  const vinculado = await pool.query(
    `UPDATE "AspNetUsers" SET "Matricula" = $1 WHERE "NormalizedUserName" = $2 RETURNING "Id"`,
    [matricula, usuario],
  );
  console.log(
    vinculado.rowCount === 0
      ? `No se encontró el usuario "${usuario}"; sin vincular.`
      : `Usuario "${usuario}" (Id ${vinculado.rows[0].Id}) vinculado a la matrícula ${matricula}. Vuelve a iniciar sesión para refrescar la cookie.`,
  );

  // ---- Calendarios y resúmenes mensuales del año en curso ----
  // Las columnas de Resumenes se rellenan con su valor neutro según el tipo
  // (0 / 0.00 / 00:00:00 / '') y solo se sobreescriben los contadores de
  // interés; así no dependemos de cubrir a mano todas las columnas.
  const columnasResumen = (await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'Resumenes'
       AND column_name NOT IN ('Id', 'CalendarioId', 'ModifiedDate', 'ModifiedBy')`,
  )).rows as unknown as { column_name: string; data_type: string }[];
  const neutroPorTipo: Record<string, unknown> = {
    "integer": 0,
    "numeric": "0.00",
    "interval": "00:00:00",
    "character varying": "",
    "text": "",
  };
  const neutros = Object.fromEntries(
    columnasResumen.map((c) => [c.column_name, neutroPorTipo[c.data_type] ?? ""]),
  );

  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  for (let mes = 1; mes <= 12; mes++) {
    const fecha = `${ano}-${String(mes).padStart(2, "0")}-01 00:00:00`;
    const calendario = await pool.query(
      `INSERT INTO "Calendarios"
         ("ConductorId", "Centro", "Fecha",
          "TotalImportePlusSabados", "TotalImportePlusFestivos", "TotalImportePlusNocturnidad",
          "TotalImportePlusNocturnidadParcial", "TotalImportePlusPaqueteria", "TotalImportePlusLimpieza",
          "TotalImportePlusMenorDescanso", "TotalImportePlusNavidad", "TotalImportePlusViaje",
          "TotalQuebrantoMoneda", "TotalRefuerzos", "TotalImporteDietas", "TotalDcsPendientes",
          "TotalDndsPendientes", "TotalImporteDndsCobrados",
          "ModifiedDate", "ModifiedBy")
       VALUES ($1, 1, $2, '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '0.00',
               '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', $3, 1)
       ON CONFLICT ("ConductorId", "Fecha") DO NOTHING
       RETURNING "Id"`,
      [conductorId, fecha, ahora],
    );
    if (calendario.rowCount === 0) continue; // ya sembrado

    // Contadores sintéticos del mes: trabajo + descansos + vacaciones
    // (en julio/agosto el grueso de las vacaciones, como en convenio).
    const contadores: Record<string, number> = {
      "DiasTrabajo": 18,
      "DiasTrabajoJD": 1,
      "DiasTrabajoFN": 1,
      "DiasJD": 3,
      "DiasFN": 1,
      "DiasDC": 2,
      "DiasOV": mes === 7 || mes === 8 ? 20 : 6,
    };
    const fila = { ...neutros, ...contadores };
    const nombres = Object.keys(fila);
    const valores = Object.values(fila);
    const marcadores = nombres.map((_, i) => `$${i + 3}`).join(", ");
    await pool.query(
      `INSERT INTO "Resumenes" ("CalendarioId", ${nombres.map((n) => `"${n}"`).join(", ")}, "ModifiedDate", "ModifiedBy")
       VALUES ($1, ${marcadores}, $2, 1)`,
      [calendario.rows[0].Id, ahora, ...valores],
    );
  }
  console.log(`> Resúmenes sembrados para ${ano} (18-21 días trabajados al mes; vacaciones en julio/agosto).`);

  await pool.query("COMMIT");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}
