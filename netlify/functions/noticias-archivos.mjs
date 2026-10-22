// Imágenes y documentos de las noticias públicas.
//   POST /api/noticias-archivos      (comunicaciones o admin) cuerpo = archivo; cabeceras content-type y x-nombre
//   GET  /api/noticias-archivos/:id  público, con caché larga (el contenido de un id nunca cambia)
import { archivos } from "../lib/noticias.mjs";
import { TIPOS_PERMITIDOS, MAX_ARCHIVO_MB, respuestaArchivo } from "../lib/archivos.mjs";
import { PUEDEN_PUBLICAR_SITIO } from "../lib/usuarios.mjs";
import { manejador, sesionActual, json, error } from "../lib/http.mjs";

export default manejador(["GET", "POST"], async (req, ctx) => {
  if (req.method === "GET") {
    const r = await archivos.leer(ctx?.params?.id);
    if (!r) return error("Archivo no encontrado.", 404);
    return respuestaArchivo(r, {
      "cache-control": "public, max-age=31536000, immutable",
      "netlify-cdn-cache-control": "public, max-age=31536000, immutable, durable",
    });
  }

  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401);
  if (u.debeCambiarClave || !PUEDEN_PUBLICAR_SITIO.includes(u.rol)) return error("No tiene permisos para subir archivos al sitio.", 403);
  const tipo = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!TIPOS_PERMITIDOS[tipo]) return error("Tipo de archivo no permitido. Use PDF, imágenes u Office.", 415);
  const datos = await req.arrayBuffer();
  if (!datos.byteLength) return error("El archivo está vacío.");
  if (datos.byteLength > MAX_ARCHIVO_MB * 1024 * 1024) return error(`El archivo supera los ${MAX_ARCHIVO_MB} MB.`, 413);
  let nombre = "archivo";
  try { nombre = decodeURIComponent(req.headers.get("x-nombre") || "archivo"); } catch {}
  return json({ archivo: await archivos.guardar({ datos, nombre, tipo, subidoPor: u.rut }) }, 201);
});

export const config = { path: ["/api/noticias-archivos", "/api/noticias-archivos/:id"] };
