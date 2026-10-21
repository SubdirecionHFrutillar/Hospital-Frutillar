// POST /api/auth/ingresar  { rut, clave }
import { normalizarRut } from "../lib/rut.mjs";
import { firmar, cookieSesion } from "../lib/sesion.mjs";
import * as U from "../lib/usuarios.mjs";
import { manejador, leerJSON, json, error, env } from "../lib/http.mjs";

const INVALIDO = "RUT o contraseña incorrectos.";

export default manejador(["POST"], async (req) => {
  const { rut: rutIn, clave } = await leerJSON(req);
  const rut = normalizarRut(rutIn);
  if (!rut || typeof clave !== "string" || !clave) {
    return error("Ingrese un RUT válido y su contraseña.", 400);
  }

  const bloqueo = await U.estaBloqueado(rut);
  if (bloqueo) {
    const min = Math.ceil((bloqueo - Date.now()) / 60000);
    return error(`Demasiados intentos fallidos. Intente nuevamente en ${min} minuto(s).`, 429);
  }

  const u = await U.obtener(rut);
  const ok = u ? await U.verificarClave(clave, u.hash) : (await U.gastarTiempo(clave), false);
  if (!ok || !u.activo) {
    const i = await U.registrarFallo(rut);
    if (i.bloqueadoHasta) return error(`Demasiados intentos fallidos. Cuenta bloqueada por ${U.BLOQUEO_MIN} minutos.`, 429);
    return error(INVALIDO, 401);
  }

  await U.limpiarFallos(rut);
  u.ultimoAcceso = new Date().toISOString();
  await U.guardar(u);

  const token = await firmar({ rut: u.rut, nombre: u.nombre, rol: u.rol, sv: u.sv }, env("SESSION_SECRET"));
  return json(
    { ok: true, debeCambiarClave: !!u.debeCambiarClave, usuario: U.publico(u) },
    200,
    { "set-cookie": cookieSesion(token) }
  );
});

export const config = { path: "/api/auth/ingresar" };
