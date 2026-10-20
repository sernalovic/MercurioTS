/** Página pública de privacidad (enlace del pie del portal). */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacidad · Mercurio",
};

export default function Pagina() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: "1.3rem", color: "#4f9426" }}>Privacidad</h1>
      <p>
        Mercurio es la herramienta de gestión del sindicato: guarda únicamente
        los datos de calendarios, nóminas y reclamaciones introducidos por sus
        usuarios, y solo se usan para ese fin.
      </p>
      <p>
        La cuenta guarda un nombre, una dirección de correo electrónico y la
        clave de acceso (almacenada cifrada con PBKDF2 y su sal individual).
        Ningún dato se cede a terceros.
      </p>
      <p>
        <a href="/portal">Volver al portal</a>
      </p>
    </main>
  );
}
