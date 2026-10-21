// Publicaciones de la intranet (requiere sesión).
//   GET    /api/intranet/publicaciones?categoria=&desde=   → listado (todas las cuentas)
//   GET    /api/intranet/publicaciones/:id                 → detalle
//   POST   /api/intranet/publicaciones                     → crear   (editor o admin)
//   PATCH  /api/intranet/publicaciones/:id                 → editar  (autor o admin)
//   DELETE /api/intranet/publicaciones/:id                 → borrar  (autor o admin)
import * as I from "../lib/intranet.mjs";
import { PUEDEN_PUBLICAR } from "../lib/usuarios.mjs";
import { manejador, sesionActual, leerJSON, json, error } from "../lib/http.mjs";

const puedeEditar = (u, p) => u.rol === "admin" || (PUEDEN_PUBLICAR.includes(u.rol) && p.autor?.rut === u.rut);

export default manejador(["GET", "POST", "PATCH", "DELETE"], async (req, ctx) => {
  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401);
  if (u.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);
  const id = ctx?.params?.id;

  if (req.method === "GET") {
    if (!id) {
      const q = new URL(req.url).searchParams;
      const r = await I.listar({ categoria: q.get("categoria") || undefined, desde: Math.max(0, Number(q.get("desde")) || 0) });
      return json({ ...r, categorias: I.CATEGORIAS, puedePublicar: PUEDEN_PUBLICAR.includes(u.rol) });
    }
    const p = await I.obtener(id);
    if (!p) return error("Publicación no encontrada.", 404);
    return json({ publicacion: p, puedeEditar: puedeEditar(u, p) });
  }

  if (!PUEDEN_PUBLICAR.includes(u.rol)) return error("No tiene permisos para publicar.", 403);

  if (req.method === "POST") {
    if (id) return error("Ruta no válida.", 404);
    const { error: e, datos } = I.validar(await leerJSON(req), { esAdmin: u.rol === "admin" });
    if (e) return error(e);
    return json({ publicacion: await I.crear(datos, u) }, 201);
  }

  const p = await I.obtener(id);
  if (!p) return error("Publicación no encontrada.", 404);
  if (!puedeEditar(u, p)) return error("Solo el autor o un administrador puede modificar esta publicación.", 403);

  if (req.method === "DELETE") {
    await I.eliminar(p);
    return json({ ok: true });
  }

  const { error: e, datos } = I.validar(await leerJSON(req), { esAdmin: u.rol === "admin" });
  if (e) return error(e);
  return json({ publicacion: await I.actualizar(p, datos) });
});

export const config = { path: ["/api/intranet/publicaciones", "/api/intranet/publicaciones/:id"] };
