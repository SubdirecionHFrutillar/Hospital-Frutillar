import { verificar, leerCookie } from "./sesion.mjs";
import { obtener } from "./usuarios.mjs";

export function env(nombre) {
  return globalThis.Netlify?.env?.get(nombre) ?? process.env[nombre];
}

export function json(datos, status = 200, headers = {}) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
export const error = (mensaje, status = 400, headers) => json({ error: mensaje }, status, headers);

export async function leerJSON(req) {
  try { return await req.json(); } catch { return {}; }
}

/** Protección CSRF: las peticiones que cambian datos deben venir de este mismo sitio. */
export function mismoOrigen(req) {
  const origen = req.headers.get("origin");
  if (!origen) return req.headers.get("sec-fetch-site") !== "cross-site";
  try { return new URL(origen).host === new URL(req.url).host; } catch { return false; }
}

/**
 * Sesión vigente de la petición, o null.
 * Además de la firma, revisa que la cuenta siga activa y que la sesión no haya sido
 * invalidada (cambio de contraseña o desactivación incrementan `sv`).
 */
export async function sesionActual(req) {
  const datos = await verificar(leerCookie(req), env("SESSION_SECRET"));
  if (!datos) return null;
  const u = await obtener(datos.rut);
  if (!u || !u.activo || u.sv !== datos.sv) return null;
  return u;
}

/** Envoltorio común: método permitido, CSRF y errores inesperados. */
export function manejador(metodos, fn) {
  return async (req, ctx) => {
    if (!metodos.includes(req.method)) return error("Método no permitido.", 405, { allow: metodos.join(", ") });
    if (req.method !== "GET" && !mismoOrigen(req)) return error("Origen no permitido.", 403);
    try {
      return await fn(req, ctx);
    } catch (e) {
      console.error(e);
      return error("Error interno. Intente nuevamente.", 500);
    }
  };
}
