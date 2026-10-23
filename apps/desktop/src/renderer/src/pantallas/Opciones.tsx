/**
 * Ventana Opciones — port de la ventana «Opciones» del original, con las
 * tres pestañas General / Rutas / API Server. Se abre desde el mosaico
 * del menú y se cierra con Cerrar (guarda todo de una vez):
 *
 * - General: «Pedir siempre inicio de sesión» (no reutiliza la sesión
 *   guardada al abrir) y «Abrir PDFs después de haberse generados».
 *   (Se omite el tamaño de las imágenes de los botones: el mosaico
 *   nuevo usa iconos, no imágenes.)
 * - Rutas: carpeta por defecto de los informes PDF, logotipo de informes
 *   y reclamaciones y marca de agua de las reclamaciones (los botones
 *   «…» abren el diálogo nativo; el embutido en los PDFs se conectará
 *   cuando se retome la generación).
 * - API Server: dirección del servidor, con el aviso de reinicio.
 */
import { useState, type ReactNode } from "react";
import type { Configuracion } from "../lib/configuracion";

type Pestana = "general" | "rutas" | "servidor";

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: "general", etiqueta: "General" },
  { id: "rutas", etiqueta: "Rutas" },
  { id: "servidor", etiqueta: "API Server" },
];

/** Interruptor Sí/No del original (dos estados, texto según el valor). */
function Interruptor({ valor, onValor }: { valor: boolean; onValor: (v: boolean) => void }): ReactNode {
  return (
    <button className={`interruptor${valor ? " si" : " no"}`} onClick={() => onValor(!valor)}>
      {valor ? "Sí" : "No"}
    </button>
  );
}

export function PantallaOpciones({ configuracion, onGuardar, onVolver }: {
  configuracion: Configuracion;
  onGuardar: (cambios: Partial<Configuracion>) => void;
  onVolver: () => void;
}): ReactNode {
  const [pestana, setPestana] = useState<Pestana>("general");
  const [pedirSesion, setPedirSesion] = useState(configuracion.PedirSesion !== false);
  const [abrirPdf, setAbrirPdf] = useState(configuracion.AbrirPdf !== false);
  const [carpeta, setCarpeta] = useState(configuracion.CarpetaInformes ?? "");
  const [logo, setLogo] = useState(configuracion.LogoRuta ?? "");
  const [marca, setMarca] = useState(configuracion.MarcaAguaRuta ?? "");
  const [servidor, setServidor] = useState(configuracion.Servidor);

  function cerrar(): void {
    onGuardar({
      PedirSesion: pedirSesion,
      AbrirPdf: abrirPdf,
      CarpetaInformes: carpeta.trim(),
      LogoRuta: logo.trim(),
      MarcaAguaRuta: marca.trim(),
      Servidor: servidor.trim() === "" ? configuracion.Servidor : servidor.trim(),
    });
    onVolver();
  }

  async function explorar(imagen: boolean, onRuta: (ruta: string) => void): Promise<void> {
    const puente = window.mercurio;
    if (!puente) {
      window.alert("Los diálogos de archivos solo están disponibles en la aplicación de escritorio.");
      return;
    }
    const ruta = imagen ? await puente.dialogoImagen() : await puente.dialogoCarpeta();
    if (ruta !== null) onRuta(ruta);
  }

  return (
    <div className="pagina paginaOpciones">
      <div className="ventanaOpciones">
        <div className="cabeceraVentana">
          <span>Opciones</span>
          <button className="cerrarVentana" onClick={cerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="opcionesCuerpo">
          <div className="tabsOpciones">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                className={`tabOpcion${pestana === p.id ? " sel" : ""}`}
                onClick={() => setPestana(p.id)}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
          <div className="opcionContenido">
            {pestana === "general" ? (
              <>
                <div className="filaOpcion">
                  <span className="etiquetaOpcion">Pedir siempre inicio de sesión</span>
                  <Interruptor valor={pedirSesion} onValor={setPedirSesion} />
                </div>
                <div className="filaOpcion">
                  <span className="etiquetaOpcion">Abrir PDFs después de haberse generados</span>
                  <Interruptor valor={abrirPdf} onValor={setAbrirPdf} />
                </div>
              </>
            ) : null}
            {pestana === "rutas" ? (
              <>
                <div className="campoRuta">
                  <span className="rutaEtiqueta">Ruta de la carpeta Informes</span>
                  <div className="rutaEntrada">
                    <input value={carpeta} onChange={(e) => setCarpeta(e.target.value)} placeholder="Documentos\Mercurio\Informes (por defecto)" />
                    <button className="boton" onClick={() => void explorar(false, setCarpeta)} title="Examinar…">…</button>
                  </div>
                </div>
                <div className="campoRuta">
                  <span className="rutaEtiqueta">Ruta del logotipo que se usará en los informes y reclamaciones</span>
                  <div className="rutaEntrada">
                    <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="(sin logotipo)" />
                    <button className="boton" onClick={() => void explorar(true, setLogo)} title="Examinar…">…</button>
                  </div>
                </div>
                <div className="campoRuta">
                  <span className="rutaEtiqueta">Ruta de la marca de agua que se usará en las reclamaciones</span>
                  <div className="rutaEntrada">
                    <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="(sin marca de agua)" />
                    <button className="boton" onClick={() => void explorar(true, setMarca)} title="Examinar…">…</button>
                  </div>
                </div>
              </>
            ) : null}
            {pestana === "servidor" ? (
              <div className="campoRuta">
                <span className="rutaEtiqueta">Dirección del API Server</span>
                <input value={servidor} onChange={(e) => setServidor(e.target.value)} />
                <span className="avisoRojo">Si cambias este valor debes reiniciar la aplicación.</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="opcionesPie">
          <button className="boton" onClick={cerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
