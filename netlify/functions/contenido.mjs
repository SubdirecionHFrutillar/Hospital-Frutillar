// Contenido del sitio editable desde la intranet (Servicios, Horarios, Autoridades).
//   GET /api/contenido   → { cambios, historial }        (comunicaciones o admin)
//   PUT /api/contenido   → { cambios: { ruta: valor | null } }  guarda; null vuelve al texto original
// El sitio lo muestra al instante (vía /api/sitio-vivo) sin regenerarse; se purga la caché del CDN.
import * as C from "../lib/contenido.mjs";
import { PUEDEN_PUBLICAR_SITIO } from "../lib/usuarios.mjs";
import { manejador, sesionActual, leerJSON, json, error } from "../lib/http.mjs";
import { purgarSitioVivo } from "../lib/vivo.mjs";

export default manejador(["GET", "PUT"], async (req) => {
  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401);
  if (u.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);
  if (!PUEDEN_PUBLICAR_SITIO.includes(u.rol)) return error("Solo Comunicaciones o un administrador puede editar el contenido del sitio.", 403);

  if (req.method === "GET") return json(await C.estado());

  const { error: e, datos } = C.validar((await leerJSON(req)).cambios);
  if (e) return error(e);
  await C.guardar(datos, u);
  await purgarSitioVivo();
  return json(await C.estado());
});

export const config = { path: "/api/contenido" };
