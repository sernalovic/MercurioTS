import { describe, expect, it } from "vitest";
import { hashContrasena, verificarContrasena } from "../src/contrasena";

describe("contrasena (formato ASP.NET Identity v3)", () => {
  it("crea y verifica un hash ida y vuelta", () => {
    const hash = hashContrasena("Mercurio-2026!");
    expect(hash.startsWith("AQAAAA")).toBe(true); // 0x01 + prf HMACSHA256
    expect(verificarContrasena(hash, "Mercurio-2026!")).toBe(true);
    expect(verificarContrasena(hash, "otra-clave")).toBe(false);
  });

  it("aceita los parámetros por defecto de Identity (10000 iteraciones)", () => {
    const hash = hashContrasena("clave-antigua", { iteraciones: 10_000 });
    expect(verificarContrasena(hash, "clave-antigua")).toBe(true);
  });

  it("rechaza hashes corruptos sin lanzar", () => {
    expect(verificarContrasena("no-es-base64-valido###", "x")).toBe(false);
    expect(verificarContrasena("", "x")).toBe(false);
    expect(verificarContrasena("AAAA", "x")).toBe(false);
  });

  it("no acepta la subclave truncada o modificada", () => {
    const hash = hashContrasena("Mercurio-2026!");
    const rotos = Buffer.from(hash, "base64");
    rotos.writeUint8(rotos[rotos.length - 1] ^ 1, rotos.length - 1);
    expect(verificarContrasena(rotos.toString("base64"), "Mercurio-2026!")).toBe(false);
  });
});
