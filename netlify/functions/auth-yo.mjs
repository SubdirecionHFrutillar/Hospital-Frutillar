// GET /api/auth/yo → datos del funcionario con sesión activa
import { cookieBorrar } from "../lib/sesion.mjs";
import { publico } from "../lib/usuarios.mjs";
import { manejador, sesionActual, json, error } from "../lib/http.mjs";

export default manejador(["GET"], async (req) => {
  const u = await sesionActual(req);
  if (!u) return error("Sesión no válida.", 401, { "set-cookie": cookieBorrar() });
  return json({ usuario: publico(u) });
});

export const config = { path: "/api/auth/yo" };
