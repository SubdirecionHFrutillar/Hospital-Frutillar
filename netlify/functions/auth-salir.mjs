// POST /api/auth/salir
import { cookieBorrar } from "../lib/sesion.mjs";
import { manejador, json } from "../lib/http.mjs";

export default manejador(["POST"], async () => json({ ok: true }, 200, { "set-cookie": cookieBorrar() }));

export const config = { path: "/api/auth/salir" };
