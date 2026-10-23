/**
 * Pantalla Usuarios — port de `UsuariosViewModel` + `UsuariosView` (solo la
 * ven los súper): rejilla de usuarios del portal con marca para el correo y
 * permisos (afiliado/admin/super/bloqueado), panel de email a la derecha.
 * Los permisos solo se guardan si cambiaron (port de `PermisosCambiados`).
 */
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";

interface UsuarioBasico {
  id: number;
  userName: string | null;
  emailConfirmed: boolean;
  matricula: number;
  nombre: string;
  apellidos: string;
  fechaAlta: string;
  email: string | null;
  isAfiliado: boolean;
  isAdmin: boolean;
  isSuper: boolean;
  isLocked: boolean;
}

interface FilaUsuario extends UsuarioBasico {
  marcado: boolean;
  afiliado: boolean;
  admin: boolean;
  super: boolean;
  bloqueado: boolean;
}

/** `UsuarioSeleccionable` del original: flags editables sobre el básico. */
function filaDe(u: UsuarioBasico): FilaUsuario {
  return { ...u, marcado: false, afiliado: u.isAfiliado, admin: u.isAdmin, super: u.isSuper, bloqueado: u.isLocked };
}

function permisosCambiados(u: FilaUsuario): boolean {
  return u.afiliado !== u.isAfiliado || u.admin !== u.isAdmin
    || u.super !== u.isSuper || u.bloqueado !== u.isLocked;
}

export function PantallaUsuarios({ servidor, token, onVolver }: {
  servidor: string;
  token: string;
  onVolver: () => void;
}): ReactNode {
  const [usuarios, setUsuarios] = useState<FilaUsuario[]>([]);
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cargar(): void {
    setOcupado(true);
    setError(null);
    api<{ usuarios: UsuarioBasico[] }>(servidor, token, "cuenta/usuarios")
      .then((r) => setUsuarios(r.usuarios.map(filaDe)))
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(cargar, [servidor, token]);

  // ---- marcas ----

  function marcarTodos(): void { setUsuarios(usuarios.map((u) => ({ ...u, marcado: true }))); }
  function marcarAfiliados(): void { setUsuarios(usuarios.map((u) => ({ ...u, marcado: u.isAfiliado }))); }
  function marcarAdmin(): void { setUsuarios(usuarios.map((u) => ({ ...u, marcado: u.isAdmin }))); }
  function desmarcar(): void { setUsuarios(usuarios.map((u) => ({ ...u, marcado: false }))); }

  function cambiar(u: FilaUsuario, cambios: Partial<FilaUsuario>): void {
    setUsuarios(usuarios.map((x) => (x === u ? { ...x, ...cambios } : x)));
  }

  /** `GuardarPermisos`: PUT por cada usuario con permisos cambiados. */
  async function guardarPermisos(): Promise<void> {
    setOcupado(true);
    setError(null);
    try {
      const cambiados = usuarios.filter(permisosCambiados);
      for (const u of cambiados) {
        await api(servidor, token, `cuenta/usuarios/${u.id}/permisos`, {
          metodo: "PUT",
          cuerpo: { isAdmin: u.admin, isSuper: u.super, isAfiliado: u.afiliado, isLocked: u.bloqueado },
        });
      }
      cargar();
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  /** `Enviar`: email a los marcados con email (el SMTP lo configuran el entorno). */
  async function enviar(): Promise<void> {
    setOcupado(true);
    setError(null);
    try {
      const destinos = usuarios
        .filter((u) => u.marcado && u.email !== null && u.email.trim() !== "")
        .map((u) => ({ nombre: `${u.nombre} ${u.apellidos}`.trim(), email: u.email as string }));
      if (destinos.length === 0 || asunto.trim() === "") {
        window.alert("Indica el asunto y al menos un destinatario con email.");
        return;
      }
      await api(servidor, token, "cuenta/enviarEmail", { metodo: "POST", cuerpo: { asunto, cuerpo, direcciones: destinos } });
      window.alert("Se ha enviado el email correctamente");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="pagina paginaUsuarios">
      <div className="cabeceraPagina">
        <h2 className="tituloPagina">Gestión de usuarios</h2>
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
      </div>
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver} disabled={ocupado}>Volver</button>
        <button className="boton" onClick={cargar} disabled={ocupado}>Recargar</button>
        <button className="boton" onClick={marcarTodos} disabled={ocupado}>Marcar todos</button>
        <button className="boton" onClick={marcarAfiliados} disabled={ocupado}>Marcar afiliados</button>
        <button className="boton" onClick={marcarAdmin} disabled={ocupado}>Marcar administradores</button>
        <button className="boton" onClick={desmarcar} disabled={ocupado}>Desmarcar</button>
        <button className="botonPrincipal" onClick={guardarPermisos} disabled={ocupado}>Guardar permisos</button>
      </div>
      <div className="usuariosCuerpo">
        <div className="usuariosRejilla">
          <table className="rejilla">
            <thead>
              <tr>
                <th>✓</th><th>Usuario</th><th>Matrícula</th><th>Nombre</th><th>Apellidos</th><th>Email</th><th>Alta</th>
                <th>Afiliado</th><th>Admin</th><th>Super</th><th>Bloqueado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="centro"><input type="checkbox" checked={u.marcado} onChange={(e) => cambiar(u, { marcado: e.target.checked })} /></td>
                  <td>{u.userName ?? ""}</td>
                  <td className="num">{u.matricula}</td>
                  <td>{u.nombre}</td>
                  <td>{u.apellidos}</td>
                  <td>{u.email ?? ""}</td>
                  <td>{u.fechaAlta}</td>
                  <td className="centro"><input type="checkbox" checked={u.afiliado} onChange={(e) => cambiar(u, { afiliado: e.target.checked })} /></td>
                  <td className="centro"><input type="checkbox" checked={u.admin} onChange={(e) => cambiar(u, { admin: e.target.checked })} /></td>
                  <td className="centro"><input type="checkbox" checked={u.super} onChange={(e) => cambiar(u, { super: e.target.checked })} /></td>
                  <td className="centro"><input type="checkbox" checked={u.bloqueado} onChange={(e) => cambiar(u, { bloqueado: e.target.checked })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel panelEmail">
          <h3 className="tituloSeccion">Enviar email a los marcados</h3>
          <div className="campoEtiqueta"><span>Asunto</span>
            <input className="celda ancho" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          </div>
          <div className="campoEtiqueta arriba"><span>Mensaje</span>
            <textarea className="cuerpoEmail" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
          </div>
          <button className="botonPrincipal" onClick={enviar} disabled={ocupado}>Enviar</button>
        </div>
      </div>
    </div>
  );
}
