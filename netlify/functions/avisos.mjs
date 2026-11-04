// Avisos del hospital (franja del sitio público).
//   GET    /api/avisos/vigentes  → avisos vigentes del sitio público (sin sesión; lo usa el build)
//   GET    /api/avisos/intranet  → avisos vigentes de la intranet (cualquier funcionario con sesión)
//   GET    /api/avisos           → todos, para gestionar  (comunicaciones o admin)
//   POST   /api/avisos           → crear { texto, tipo, destino, url?, hasta? }
//   DELETE /api/avisos/:id       → eliminar
// Tras cada cambio se purga la caché del CDN: el aviso se ve al instante, sin regenerar el sitio.
import * as A from "../lib/avisos.mjs";
import { PUEDEN_PUBLICAR_SITIO } from "../lib/usuarios.mjs";
import { manejador, sesionActual, leerJSON, json, error } from "../lib/http.mjs";
import { purgarSitioVivo } from "../lib/vivo.mjs";

export default manejador(["GET", "POST", "DELETE"], async (req, ctx) => {
  const id = ctx?.params?.id;
  if (req.method === "GET" && id === "vigentes") return json({ avisos: await A.vigentes() }, 200, { "cache-control": "no-store" });

  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401);
  if (u.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);
  if (req.method === "GET" && id === "intranet") return json({ avisos: await A.vigentes("intranet") });
  if (!PUEDEN_PUBLICAR_SITIO.includes(u.rol)) return error("Solo Comunicaciones o un administrador puede gestionar los avisos.", 403);

  if (req.method === "GET") {
    if (id) return error("Ruta no válida.", 404);
    const hoy = A.hoyChile();
    return json({ avisos: (await A.listar()).map((a) => ({ ...a, destino: A.destinoDe(a), vigente: A.vigente(a, hoy) })), maximo: A.MAX_AVISOS });
  }
  if (req.method === "POST") {
    if (id) return error("Ruta no válida.", 404);
    const v = A.validar(await leerJSON(req));
    if (v.error) return error(v.error);
    const r = await A.crear(v.datos, u);
    if (r.error) return error(r.error, 409);
    await purgarSitioVivo();
    return json({ aviso: r.aviso }, 201);
  }
  // DELETE
  if (!(await A.eliminar(id))) return error("Aviso no encontrado.", 404);
  await purgarSitioVivo();
  return json({ ok: true });
});

export const config = { path: ["/api/avisos", "/api/avisos/:id"] };
