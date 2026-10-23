/**
 * Pantalla Usuarios — aspecto Orión 2 (`GestionUsuarios`, solo la ven
 * los súper): rejilla Blog./Matrícula/Nombre/Apellidos/Email/Alta/
 * Afiliado/Admin/Super con los permisos como texto Sí/No editable
 * (clic sobre la celda = alternar, se guarda al instante por usuario vía
 * `cuenta/usuarios/{id}/permisos`), agrupación opcional y la ventana
 * «Enviar email» como modal con las dos listas y los botones de
 * añadir/quitar del original. El envío queda preparado (validación y
 * destinatarios) pero todavía no conectado.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
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

/** Flags editables sobre el básico (el `is*` es el valor guardado). */
interface FilaUsuario extends UsuarioBasico {
  afiliado: boolean;
  admin: boolean;
  super: boolean;
  bloqueado: boolean;
}

function filaDe(u: UsuarioBasico): FilaUsuario {
  return { ...u, afiliado: u.isAfiliado, admin: u.isAdmin, super: u.isSuper, bloqueado: u.isLocked };
}

/** Fecha ISO → `dd-mm-aaaa` (formato de la rejilla original). */
function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso.slice(0, 10);
}

export function PantallaUsuarios({ servidor, token, onVolver }: {
  servidor: string;
  token: string;
  onVolver: () => void;
}): ReactNode {
  const [usuarios, setUsuarios] = useState<FilaUsuario[]>([]);
  const [agrupar, setAgrupar] = useState("0");
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ventana «Enviar email».
  const [mostrarEmail, setMostrarEmail] = useState(false);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [selIzq, setSelIzq] = useState<number[]>([]);
  const [selDer, setSelDer] = useState<number[]>([]);
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");

  function cargar(): void {
    setOcupado(true);
    setError(null);
    api<{ usuarios: UsuarioBasico[] }>(servidor, token, "cuenta/usuarios")
      .then((r) => setUsuarios(r.usuarios.map(filaDe)))
      .catch((e) => setError((e as Error).message))
      .finally(() => setOcupado(false));
  }

  useEffect(cargar, [servidor, token]);

  /** Alterna un permiso con clic y lo guarda al instante en el servidor. */
  async function alternar(u: FilaUsuario, campo: "afiliado" | "admin" | "super" | "bloqueado"): Promise<void> {
    const tras: FilaUsuario = { ...u, [campo]: !u[campo] };
    setUsuarios((us) => us.map((x) => (x.id === u.id ? tras : x)));
    try {
      await api(servidor, token, `cuenta/usuarios/${u.id}/permisos`, {
        metodo: "PUT",
        cuerpo: { isAdmin: tras.admin, isSuper: tras.super, isAfiliado: tras.afiliado, isLocked: tras.bloqueado },
      });
      // Se refleja lo guardado como base, para no reenviar el mismo permiso.
      setUsuarios((us) => us.map((x) => (x.id === u.id
        ? { ...x, isAfiliado: x.afiliado, isAdmin: x.admin, isSuper: x.super, isLocked: x.bloqueado }
        : x)));
    } catch (e) {
      setError((e as Error).message);
      setUsuarios((us) => us.map((x) => (x.id === u.id ? u : x))); // revertir
    }
  }

  // ---- rejilla con agrupación opcional ----

  const filas = useMemo(() => {
    const orden = [...usuarios].sort((a, b) => a.matricula - b.matricula);
    const salidas: ReactNode[] = [];
    let claveGrupo = "";
    for (const u of orden) {
      if (agrupar !== "0") {
        const si = agrupar === "1" ? u.afiliado : agrupar === "2" ? u.admin : u.super;
        const etiqueta = `${agrupar === "1" ? "Afiliado" : agrupar === "2" ? "Admin" : "Super"}: ${si ? "Sí" : "No"}`;
        if (etiqueta !== claveGrupo) {
          claveGrupo = etiqueta;
          salidas.push(<tr key={`grupo-${etiqueta}`} className="filaGrupo"><td colSpan={9}>{etiqueta}</td></tr>);
        }
      }
      salidas.push(
        <tr key={u.id} className={seleccion === u.id ? "sel" : undefined} onClick={() => setSeleccion(u.id)}>
          <td className="usuCambio" title="Bloqueado — pulsa para alternar" onClick={(e) => { e.stopPropagation(); void alternar(u, "bloqueado"); }}>
            <span className={u.bloqueado ? "usuNo" : "usuSi"}>{u.bloqueado ? "Sí" : "No"}</span>
          </td>
          <td className="num">{u.matricula}</td>
          <td>{u.nombre}</td>
          <td>{u.apellidos}</td>
          <td className="usuEmail">{u.email ?? ""}</td>
          <td>{fechaCorta(u.fechaAlta)}</td>
          <td className="usuCambio" onClick={(e) => { e.stopPropagation(); void alternar(u, "afiliado"); }}>
            <span className={u.afiliado ? "usuSi" : "usuNo"}>{u.afiliado ? "Sí" : "No"}</span>
          </td>
          <td className="usuCambio" onClick={(e) => { e.stopPropagation(); void alternar(u, "admin"); }}>
            <span className={u.admin ? "usuSi" : "usuNo"}>{u.admin ? "Sí" : "No"}</span>
          </td>
          <td className="usuCambio" onClick={(e) => { e.stopPropagation(); void alternar(u, "super"); }}>
            <span className={u.super ? "usuSi" : "usuNo"}>{u.super ? "Sí" : "No"}</span>
          </td>
        </tr>,
      );
    }
    return salidas;
  }, [usuarios, agrupar, seleccion]);

  // ---- ventana «Enviar email» ----

  function porId(id: number): FilaUsuario | undefined {
    return usuarios.find((u) => u.id === id);
  }

  function abrirEmail(): void {
    setElegidos([]);
    setSelIzq([]);
    setSelDer([]);
    setMostrarEmail(true);
  }

  function elegirIzq(id: number, ampliar: boolean): void {
    setSelDer([]);
    setSelIzq(ampliar ? (selIzq.includes(id) ? selIzq.filter((i) => i !== id) : [...selIzq, id]) : [id]);
  }

  function elegirDer(id: number, ampliar: boolean): void {
    setSelIzq([]);
    setSelDer(ampliar ? (selDer.includes(id) ? selDer.filter((i) => i !== id) : [...selDer, id]) : [id]);
  }

  /** Mueve de la izquierda a la derecha los `selIzq` que falten. */
  function anadir(): void {
    setElegidos([...new Set([...elegidos, ...selIzq])]);
    setSelIzq([]);
  }

  /** Añade a la derecha todos los que cumplan el predicado. */
  function anadirPor(pred: (u: FilaUsuario) => boolean): void {
    setElegidos((prev) => [...new Set([...prev, ...usuarios.filter(pred).map((u) => u.id)])]);
  }

  /** Quita de la derecha los `selDer`, o los que cumplan el predicado. */
  function quitar(): void {
    setElegidos(elegidos.filter((id) => !selDer.includes(id)));
    setSelDer([]);
  }

  function quitarPor(pred: (u: FilaUsuario) => boolean): void {
    setElegidos(elegidos.filter((id) => { const u = porId(id); return u !== undefined && !pred(u); }));
    setSelDer([]);
  }

  /**
   * Envío pendiente de conectar: de momento solo se valida y se avisa
   * con los destinatarios que se usarían (el SMTP del servidor aún no
   * está en uso).
   */
  function enviar(): void {
    const conEmail = elegidos
      .map(porId)
      .filter((u): u is FilaUsuario => u !== undefined && (u.email ?? "").trim() !== "")
      .map((u) => u.email as string);
    if (conEmail.length === 0) {
      window.alert("Ningún destinatario seleccionado tiene email.");
      return;
    }
    window.alert(`Preparado el envío de «${asunto}» a ${conEmail.length} destinatarios.\nEl envío de correos todavía no está conectado.`);
  }

  const etiqueta = (u: FilaUsuario): string => `${u.matricula} ${u.apellidos}`;

  // ---- render ----

  return (
    <div className="pagina paginaUsuarios">
      <div className="opcionesPagina">
        <button className="boton" onClick={onVolver} disabled={ocupado}>← Volver</button>
        <button className="boton" onClick={cargar} disabled={ocupado}>↻ Recargar usuarios</button>
        {ocupado ? <span className="cargando">Trabajando…</span> : null}
        {error ? <span className="error" role="alert">{error}</span> : null}
      </div>
      <div className="bandaTitulo">USUARIOS</div>
      <div className="barraPanel">
        <button className="boton" onClick={abrirEmail} disabled={ocupado || usuarios.length === 0}>✉ Enviar email</button>
        <span className="hueco" />
        <select className="celda" value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
          <option value="0">Sin agrupar</option>
          <option value="1">Por afiliado</option>
          <option value="2">Por admin</option>
          <option value="3">Por super</option>
        </select>
      </div>
      <div className="marcoRejilla">
        <table className="rejilla">
          <thead>
            <tr>
              <th>Blog.</th><th>Matrícula</th><th>Nombre</th><th>Apellidos</th><th>Email</th><th>Alta</th>
              <th>Afiliado</th><th>Admin</th><th>Super</th>
            </tr>
          </thead>
          <tbody>
            {filas}
            {usuarios.length === 0 && !ocupado ? (
              <tr><td colSpan={9} className="vacio">No hay usuarios.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="barraEstado">{usuarios.length} usuarios</p>
      {mostrarEmail ? (
        <div className="veloDetalle" onClick={() => setMostrarEmail(false)}>
          <div className="ventanaDetalle ventanaEmail" onClick={(e) => e.stopPropagation()}>
            <div className="cabeceraVentana">
              <span>Enviar email</span>
              <button className="cerrarVentana" onClick={() => setMostrarEmail(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="emailCuerpo">
              <div className="emailLista">
                <div className="bandaTitulo">TODOS LOS USUARIOS</div>
                <ul className="listaEmail">
                  {usuarios.map((u) => (
                    <li key={u.id} className={selIzq.includes(u.id) ? "sel" : undefined} onClick={(e) => elegirIzq(u.id, e.ctrlKey || e.metaKey)}>
                      {etiqueta(u)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="emailBotones">
                <button className="boton" onClick={anadir} disabled={selIzq.length === 0}>➡ Añadir</button>
                <button className="boton" onClick={() => setElegidos(usuarios.map((u) => u.id))}>⇉ Añadir todos</button>
                <button className="boton" onClick={() => anadirPor((u) => u.afiliado)}>Añadir afiliados</button>
                <button className="boton" onClick={() => anadirPor((u) => u.admin)}>Añadir Admin</button>
                <button className="boton" onClick={() => anadirPor((u) => u.super)}>Añadir Super</button>
                <span className="sep" />
                <button className="boton" onClick={quitar} disabled={selDer.length === 0}>⬅ Quitar</button>
                <button className="boton" onClick={() => { setElegidos([]); setSelDer([]); }}>⇇ Quitar todos</button>
                <button className="boton" onClick={() => quitarPor((u) => u.afiliado)}>Quitar afiliados</button>
                <button className="boton" onClick={() => quitarPor((u) => u.admin)}>Quitar Admin</button>
                <button className="boton" onClick={() => quitarPor((u) => u.super)}>Quitar Super</button>
              </div>
              <div className="emailLista">
                <div className="bandaTitulo">USUARIOS SELECCIONADOS</div>
                <ul className="listaEmail">
                  {elegidos.map((id) => {
                    const u = porId(id);
                    return u === undefined ? null : (
                      <li key={id} className={selDer.includes(id) ? "sel" : undefined} onClick={(e) => elegirDer(id, e.ctrlKey || e.metaKey)}>
                        {etiqueta(u)}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="emailContenido">
                <div className="bandaTitulo">CONTENIDO DEL EMAIL</div>
                <label className="emailCampo"><span>Asunto</span>
                  <input className="emailAsunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
                </label>
                <label className="emailCampo alto"><span>Cuerpo</span>
                  <textarea className="emailArea" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
                </label>
              </div>
            </div>
            <div className="emailPie">
              <span className="etiquetaMini">{elegidos.length === 0 ? "Sin destinatarios" : `${elegidos.length} destinatarios`}</span>
              <span className="hueco" />
              <button className="boton" onClick={() => setMostrarEmail(false)}>Cancelar</button>
              <button className="botonPrincipal" onClick={enviar} disabled={elegidos.length === 0 || asunto.trim() === ""}>Enviar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
