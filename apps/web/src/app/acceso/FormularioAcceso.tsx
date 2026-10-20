"use client";

import { useActionState } from "react";
import { iniciarSesion } from "./actions";
import styles from "./acceso.module.css";

export default function FormularioAcceso() {
  const [error, formAction, pendiente] = useActionState(iniciarSesion, null);

  return (
    <form className={styles.formulario} action={formAction} aria-busy={pendiente}>
      <label className={styles.etiqueta}>
        Usuario
        <input
          className={styles.campo}
          name="usuario"
          autoComplete="username"
          autoFocus
          required
        />
      </label>

      <label className={styles.etiqueta}>
        Clave
        <input
          className={styles.campo}
          name="clave"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      <button className={styles.boton} type="submit" disabled={pendiente}>
        {pendiente ? "Comprobando…" : "Entrar"}
      </button>

      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
