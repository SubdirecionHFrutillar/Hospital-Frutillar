// Datos en vivo del sitio público, para actualizar en el navegador los listados de noticias y la
// franja de avisos sin regenerar el sitio.
//   GET /api/sitio-vivo → { noticias: [resumen], avisos: [vigentes] }   (público, en caché del CDN)
import { noticiasPublicas, CACHE_PUBLICA } from "../lib/vivo.mjs";
import { vigentes } from "../lib/avisos.mjs";
import { json, error } from "../lib/http.mjs";

export default async (req) => {
  if (req.method !== "GET") return error("Método no permitido.", 405, { allow: "GET" });
  try {
    const [noticias, avisos] = await Promise.all([noticiasPublicas(), vigentes()]);
    return json({ noticias, avisos }, 200, CACHE_PUBLICA);
  } catch (e) {
    console.error(e);
    return error("No se pudieron leer los datos.", 500);
  }
};

export const config = { path: "/api/sitio-vivo" };
