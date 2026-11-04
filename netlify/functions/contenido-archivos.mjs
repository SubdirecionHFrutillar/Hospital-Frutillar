// Fotos del contenido del sitio (equipos de cada servicio, autoridades).
//   POST /api/contenido-archivos      (comunicaciones o admin) cuerpo = imagen; cabeceras content-type y x-nombre
//   GET  /api/contenido-archivos/:id  público, con caché larga (el contenido de un id nunca cambia)
import { archivos } from "../lib/contenido.mjs";
import { respuestaArchivo, recibirArchivo } from "../lib/archivos.mjs";
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
  if (u.debeCambiarClave || !PUEDEN_PUBLICAR_SITIO.includes(u.rol)) return error("No tiene permisos para subir fotos al sitio.", 403);
  if (!/^image\/(jpeg|png|webp)$/.test((req.headers.get("content-type") || "").split(";")[0].trim())) return error("Suba una foto JPG, PNG o WebP.", 415);
  const r = await recibirArchivo(req, archivos, u.rut);
  return json(r.cuerpo, r.status);
});

export const config = { path: ["/api/contenido-archivos", "/api/contenido-archivos/:id"] };
