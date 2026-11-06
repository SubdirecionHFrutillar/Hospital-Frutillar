// Archivos de los protocolos (PDF o Word), solo con sesión.
//   POST /api/protocolos-archivos       cuerpo = el archivo (simple o por partes, hasta 30 MB); editor o administrador
//   GET  /api/protocolos-archivos/:id   abre el PDF en el navegador (Word se descarga)
import * as P from "../lib/protocolos.mjs";
import { PUEDEN_PUBLICAR } from "../lib/usuarios.mjs";
import { manejador, sesionActual, json, error } from "../lib/http.mjs";
import { respuestaArchivo, recibirArchivo } from "../lib/archivos.mjs";

export default manejador(["GET", "POST"], async (req, ctx) => {
  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401);
  if (u.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);
  const id = ctx?.params?.id;

  if (req.method === "GET") {
    // Solo archivos que pertenecen a un protocolo (vigente o versión anterior)
    if (!id || !(await P.archivoRegistrado(id))) return error("Archivo no encontrado.", 404);
    const r = await P.archivos.leer(id);
    if (!r) return error("Archivo no encontrado.", 404);
    return respuestaArchivo(r, { "cache-control": "private, max-age=31536000, immutable" });
  }

  if (id) return error("Ruta no válida.", 404);
  if (!PUEDEN_PUBLICAR.includes(u.rol)) return error("No tiene permisos para subir protocolos.", 403);
  const tipo = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!P.TIPOS_ARCHIVO[tipo]) return error("El protocolo debe ser PDF o Word.", 415);
  const r = await recibirArchivo(req, P.archivos, u.rut);
  return json(r.cuerpo, r.status);
});

export const config = { path: ["/api/protocolos-archivos", "/api/protocolos-archivos/:id"] };
