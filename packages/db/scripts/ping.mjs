import net from "net";
import pg from "pg";
console.log("DATABASE_URL definida:", process.env.DATABASE_URL !== undefined, process.env.DATABASE_URL ? `(host: ${new URL(process.env.DATABASE_URL.replace("postgresql://", "http://")).hostname}:${new URL(process.env.DATABASE_URL.replace("postgresql://", "http://")).port})` : "");
const s = net.connect({ host: "localhost", port: 5432, timeout: 5000 });
s.on("connect", () => { console.log("TCP 5432 conecta"); s.end(); });
s.on("timeout", () => { console.log("TCP 5432 TIMEOUT"); s.destroy(); });
s.on("error", (e) => console.log("TCP 5432 ERROR:", e.code));
