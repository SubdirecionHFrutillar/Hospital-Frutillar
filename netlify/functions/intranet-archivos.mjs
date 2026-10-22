// Archivos adjuntos de la intranet (requiere sesión).
//   POST /api/intranet/archivos      cuerpo = el archivo; cabeceras content-type y x-nombre (URI-encoded)
//   GET  /api/intranet/archivos/:id  descarga / vista del archivo
import * as I from "../lib/intranet.mjs";
import { PUEDEN_PUBLICAR } from "../lib/usuarios.mjs";
import { manejador, sesionActual, json, error } from "../lib/http.mjs";
import { respuestaArchivo } from "../lib/archivos.mjs";

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
  const tipo = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!I.TIPOS_PERMITIDOS[tipo]) return error("Tipo de archivo no permitido. Use PDF, imágenes u Office.", 415);
  const datos = await req.arrayBuffer();
  if (!datos.byteLength) return error("El archivo está vacío.");
  if (datos.byteLength > I.MAX_ARCHIVO_MB * 1024 * 1024) return error(`El archivo supera los ${I.MAX_ARCHIVO_MB} MB.`, 413);
  let nombre = "archivo";
  try { nombre = decodeURIComponent(req.headers.get("x-nombre") || "archivo"); } catch {}
  return json({ archivo: await I.guardarArchivo({ datos, nombre, tipo, subidoPor: u.rut }) }, 201);
});

export const config = { path: ["/api/intranet/archivos", "/api/intranet/archivos/:id"] };
