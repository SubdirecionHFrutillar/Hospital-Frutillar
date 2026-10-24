// Archivos adjuntos de la intranet (requiere sesión).
//   POST /api/intranet/archivos                 cuerpo = el archivo; cabeceras content-type y x-nombre (URI-encoded)
//   GET  /api/intranet/archivos/:id             descarga / vista del archivo
//   GET  /api/intranet/archivos/:id?tam=min     miniatura para listados (si no existe, el original)
//   POST /api/intranet/archivos/:id/miniatura   guarda la miniatura de una imagen (WebP/JPEG, ≤ 300 KB)
import * as I from "../lib/intranet.mjs";
import { PUEDEN_PUBLICAR } from "../lib/usuarios.mjs";
import { manejador, sesionActual, json, error } from "../lib/http.mjs";
import { respuestaArchivo, recibirArchivo, TIPOS_MINIATURA, MAX_MINIATURA_KB } from "../lib/archivos.mjs";

// Los archivos no cambian nunca (un archivo nuevo tiene otro id): caché larga en el navegador.
const CACHE_FIJA = { "cache-control": "private, max-age=31536000, immutable" };
// Si se pidió la miniatura y aún no existe, se entrega el original con caché corta para tomarla después.
const CACHE_CORTA = { "cache-control": "private, max-age=3600" };

export default manejador(["GET", "POST"], async (req, ctx) => {
  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401);
  if (u.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);
  const id = ctx?.params?.id;
  const accion = ctx?.params?.accion;

  if (req.method === "GET") {
    if (accion) return error("Ruta no encontrada.", 404);
    if (new URL(req.url).searchParams.get("tam") === "min") {
      const m = await I.leerMiniatura(id);
      if (m) return respuestaArchivo(m, CACHE_FIJA);
      const r = await I.leerArchivo(id);
      if (!r) return error("Archivo no encontrado.", 404);
      return respuestaArchivo(r, CACHE_CORTA);
    }
    const r = await I.leerArchivo(id);
    if (!r) return error("Archivo no encontrado.", 404);
    return respuestaArchivo(r, CACHE_FIJA);
  }

  if (!PUEDEN_PUBLICAR.includes(u.rol)) return error("No tiene permisos para subir archivos.", 403);

  if (id && accion === "miniatura") {
    const tipo = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!TIPOS_MINIATURA.includes(tipo)) return error("La miniatura debe ser WebP o JPEG.", 415);
    const datos = await req.arrayBuffer();
    if (!datos.byteLength || datos.byteLength > MAX_MINIATURA_KB * 1024) return error("Miniatura vacía o demasiado grande.", 413);
    if (!(await I.guardarMiniatura(id, datos, tipo))) return error("La imagen no existe.", 404);
    return json({ ok: true }, 201);
  }
  if (id) return error("Ruta no encontrada.", 404);

  const r = await recibirArchivo(req, I.archivosRepo, u.rut);
  return json(r.cuerpo, r.status);
});

export const config = { path: ["/api/intranet/archivos", "/api/intranet/archivos/:id", "/api/intranet/archivos/:id/:accion"] };
