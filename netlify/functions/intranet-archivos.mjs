// Archivos adjuntos de la intranet (requiere sesión).
//   POST /api/intranet/archivos      cuerpo = el archivo; cabeceras content-type y x-nombre (URI-encoded)
//   GET  /api/intranet/archivos/:id  descarga / vista del archivo
import * as I from "../lib/intranet.mjs";
import { PUEDEN_PUBLICAR } from "../lib/usuarios.mjs";
import { manejador, sesionActual, json, error } from "../lib/http.mjs";
import { respuestaArchivo, recibirArchivo } from "../lib/archivos.mjs";

export default manejador(["GET", "POST"], async (req, ctx) => {
  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401);
  if (u.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);

  if (req.method === "GET") {
    const r = await I.leerArchivo(ctx?.params?.id);
    if (!r) return error("Archivo no encontrado.", 404);
    return respuestaArchivo(r, { "cache-control": "private, max-age=3600" });
  }

  if (!PUEDEN_PUBLICAR.includes(u.rol)) return error("No tiene permisos para subir archivos.", 403);
  const r = await recibirArchivo(req, I.archivosRepo, u.rut);
  return json(r.cuerpo, r.status);
});

export const config = { path: ["/api/intranet/archivos", "/api/intranet/archivos/:id"] };
