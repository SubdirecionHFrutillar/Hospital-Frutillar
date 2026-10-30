// Noticias del sitio web público.
//   GET    /api/noticias/publicas         → todas las noticias completas (público; lo usa el build para el sitemap y la copia estática)
//   GET    /api/noticias                  → listado para gestionar   (comunicaciones o admin)
//   POST   /api/noticias                  → crear                    (comunicaciones o admin)
//   GET    /api/noticias/:id              → detalle para editar      (comunicaciones o admin)
//   PATCH  /api/noticias/:id              → editar                   (comunicaciones o admin)
//   DELETE /api/noticias/:id              → eliminar                 (comunicaciones o admin)
// Tras cada cambio se purga la caché del CDN: la noticia se ve al instante, sin regenerar el sitio.
import * as N from "../lib/noticias.mjs";
import { PUEDEN_PUBLICAR_SITIO } from "../lib/usuarios.mjs";
import { manejador, sesionActual, leerJSON, json, error } from "../lib/http.mjs";
import { purgarSitioVivo } from "../lib/vivo.mjs";

export default manejador(["GET", "POST", "PATCH", "DELETE"], async (req, ctx) => {
  const id = ctx?.params?.id;

  if (req.method === "GET" && id === "publicas") {
    return json({ noticias: await N.todas() }, 200, { "cache-control": "no-store" });
  }

  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401);
  if (u.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);
  if (!PUEDEN_PUBLICAR_SITIO.includes(u.rol)) return error("Solo Comunicaciones o un administrador puede gestionar las noticias del sitio.", 403);
  const esAdmin = u.rol === "admin";

  if (req.method === "GET") {
    if (!id) return json({ noticias: await N.listar(), categorias: N.CATEGORIAS });
    const n = await N.obtener(id);
    return n ? json({ noticia: n }) : error("Noticia no encontrada.", 404);
  }

  if (req.method === "POST") {
    if (id) return error("Ruta no válida.", 404);
    const { error: e, datos } = N.validar(await leerJSON(req), { esAdmin });
    if (e) return error(e);
    const noticia = await N.crear(datos, u);
    await purgarSitioVivo();
    return json({ noticia }, 201);
  }

  const n = await N.obtener(id);
  if (!n) return error("Noticia no encontrada.", 404);
  if (req.method === "DELETE") {
    await N.eliminar(n);
    await purgarSitioVivo();
    return json({ ok: true });
  }
  const { error: e, datos } = N.validar(await leerJSON(req), { esAdmin });
  if (e) return error(e);
  const noticia = await N.actualizar(n, datos);
  await purgarSitioVivo();
  return json({ noticia });
});

export const config = { path: ["/api/noticias", "/api/noticias/:id"] };
