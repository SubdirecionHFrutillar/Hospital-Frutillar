// POST /api/auth/cambiar-clave  { actual, nueva }
// Al cambiar la clave se invalidan las demás sesiones abiertas (sv + 1).
import { firmar, cookieSesion } from "../lib/sesion.mjs";
import * as U from "../lib/usuarios.mjs";
import { manejador, sesionActual, leerJSON, json, error, env } from "../lib/http.mjs";

export default manejador(["POST"], async (req) => {
  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401);

  const { actual, nueva } = await leerJSON(req);
  if (!(await U.verificarClave(actual ?? "", u.hash))) return error("La contraseña actual no es correcta.", 400);
  if (actual === nueva) return error("La nueva contraseña debe ser distinta de la actual.", 400);
  const problema = U.problemaClave(nueva, u.rut);
  if (problema) return error(problema, 400);

  u.hash = await U.hashClave(nueva);
  u.sv += 1;
  u.debeCambiarClave = false;
  await U.guardar(u);

  const token = await firmar({ rut: u.rut, nombre: u.nombre, rol: u.rol, sv: u.sv }, env("SESSION_SECRET"));
  return json({ ok: true }, 200, { "set-cookie": cookieSesion(token) });
});

export const config = { path: "/api/auth/cambiar-clave" };
