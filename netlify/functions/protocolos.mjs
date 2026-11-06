// Protocolos clínicos (intranet).
//   GET    /api/protocolos       → { areas, documentos, puedeEditar }   (cualquier funcionario con sesión)
//   POST   /api/protocolos       → crear { area, titulo, codigo?, version?, vigencia?, url?, archivo? }
//   PUT    /api/protocolos/:id   → editar (archivo nuevo: el anterior queda como versión previa; null: quitarlo)
//   DELETE /api/protocolos/:id   → eliminar (con sus archivos)
// Gestionan: editor, comunicaciones y administrador. Los cambios se ven al instante (sin regenerar el sitio).
import * as P from "../lib/protocolos.mjs";
import { PUEDEN_PUBLICAR } from "../lib/usuarios.mjs";
import { manejador, sesionActual, leerJSON, json, error } from "../lib/http.mjs";

const ID = /^[a-z0-9-]{1,80}$/;

export default manejador(["GET", "POST", "PUT", "DELETE"], async (req, ctx) => {
  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401);
  if (u.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);
  const id = ctx?.params?.id;
  if (id && !ID.test(id)) return error("Protocolo no encontrado.", 404);
  const puedeEditar = PUEDEN_PUBLICAR.includes(u.rol);

  if (req.method === "GET") {
    if (id) return error("Ruta no válida.", 404);
    return json({ areas: P.AREAS, documentos: await P.listar(), puedeEditar, hoy: P.hoyChile() }, 200, { "cache-control": "private, no-store" });
  }
  if (!puedeEditar) return error("Solo un editor o un administrador puede modificar los protocolos.", 403);

  if (req.method === "DELETE") {
    if (!id) return error("Ruta no válida.", 404);
    return (await P.eliminar(id)) ? json({ ok: true }) : error("Protocolo no encontrado.", 404);
  }
  const v = P.validar(await leerJSON(req));
  if (v.error) return error(v.error);
  if (req.method === "POST") {
    if (id) return error("Ruta no válida.", 404);
    const r = await P.crear(v.datos, u);
    return r.error ? error(r.error) : json(r, 201);
  }
  if (!id) return error("Ruta no válida.", 404);
  const r = await P.actualizar(id, v.datos, u);
  return r.error ? error(r.error, r.status || 400) : json(r);
});

export const config = { path: ["/api/protocolos", "/api/protocolos/:id"] };
