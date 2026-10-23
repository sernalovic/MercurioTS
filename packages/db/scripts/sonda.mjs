/* Sonda del route conceptosAño (ver error). */
import fs from "fs";
const env = fs.readFileSync("../../apps/web/.env.local", "utf8");
const m = /^DATABASE_URL=postgresql:\/\/postgres:([^@]+)@localhost:5432\/mercurio_ts$/m.exec(env);
const r0 = await fetch("http://localhost:3000/api/v1/cuenta/entrar", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ usuario: "prueba", clave: "Mercurio-2026!" }),
});
const t = (await r0.json()).token;
const r = await fetch("http://localhost:3000/api/v1/reclamaciones/estadisticas/conceptosA%C3%B1o?a%C3%B1o=2026&centro=0", {
  headers: { Authorization: "Bearer " + t },
});
const texto = await r.text();
console.log(r.status, texto.slice(0, 500));
const r2 = await fetch("http://localhost:3000/api/v1/reclamaciones/estadisticas/conceptosA%C3%B1o?a%C3%B1o=99&centro=0", {
  headers: { Authorization: "Bearer " + t },
});
console.log(r2.status, (await r2.text()).slice(0, 300));
