// Foto de perfil opcional de los funcionarios (solo dentro del portal, requiere sesión).
//   GET    /api/perfil/foto/:rut?v=…   imagen (la URL lleva la versión: caché larga en el navegador)
//   PUT    /api/perfil/foto            cuerpo = imagen; cambia la foto propia
//   PUT    /api/perfil/foto/:rut       idem para otra cuenta (solo administradores)
//   DELETE /api/perfil/foto[/:rut]     quita la foto
// El navegador la recorta y achica a 256 × 256 antes de subirla (≤ 300 KB).
import { normalizarRut } from "../lib/rut.mjs";
import * as U from "../lib/usuarios.mjs";
import { manejador, sesionActual, json, error } from "../lib/http.mjs";

export default manejador(["GET", "PUT", "DELETE"], async (req, ctx) => {
  const yo = await sesionActual(req);
  if (!yo) return error("Sesión no válida.", 401);
  const otro = ctx?.params?.rut;
  const rut = otro ? normalizarRut(otro) : yo.rut;
  if (!rut) return error("RUT inválido.");

  if (req.method === "GET") {
    const r = await U.leerFoto(rut);
    if (!r) return error("Sin foto.", 404);
    return new Response(r.data, {
      headers: {
        "content-type": r.metadata.tipo,
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'",
      },
    });
  }

  if (yo.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);
  if (rut !== yo.rut && yo.rol !== "admin") return error("Solo un administrador puede cambiar la foto de otra cuenta.", 403);
  const u = rut === yo.rut ? yo : await U.obtener(rut);
  if (!u) return error("No existe una cuenta con ese RUT.", 404);

  if (req.method === "DELETE") {
    await U.borrarFoto(rut);
    delete u.foto;
    await U.guardar(u);
    return json({ usuario: U.publico(u) });
  }

  const tipo = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!U.TIPOS_FOTO.includes(tipo)) return error("La foto debe ser JPG, PNG o WebP.", 415);
  const datos = await req.arrayBuffer();
  if (!datos.byteLength) return error("No llegó la imagen.");
  if (datos.byteLength > U.MAX_FOTO_KB * 1024) return error(`La foto no puede pesar más de ${U.MAX_FOTO_KB} KB.`, 413);
  await U.guardarFoto(rut, datos, tipo);
  u.foto = Date.now().toString(36);
  await U.guardar(u);
  return json({ usuario: U.publico(u) });
});

export const config = { path: ["/api/perfil/foto", "/api/perfil/foto/:rut"] };
