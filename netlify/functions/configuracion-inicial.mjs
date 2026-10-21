// Crea la PRIMERA cuenta de administrador. Solo funciona si:
//   1) la variable de entorno FUNCIONARIOS_SETUP_KEY está definida, y
//   2) todavía no existe ningún administrador activo.
// GET  /api/configuracion-inicial → { disponible: boolean }
// POST /api/configuracion-inicial { claveConfiguracion, rut, nombre, clave }
import { timingSafeEqual, createHash } from "node:crypto";
import { normalizarRut } from "../lib/rut.mjs";
import * as U from "../lib/usuarios.mjs";
import { manejador, leerJSON, json, error, env } from "../lib/http.mjs";

const igual = (a, b) => timingSafeEqual(createHash("sha256").update(String(a)).digest(), createHash("sha256").update(String(b)).digest());

export default manejador(["GET", "POST"], async (req) => {
  const llave = env("FUNCIONARIOS_SETUP_KEY");
  const disponible = !!llave && !(await U.hayAdministrador());
  if (req.method === "GET") return json({ disponible });
  if (!disponible) return error("La configuración inicial no está disponible.", 403);

  const d = await leerJSON(req);
  if (!igual(d.claveConfiguracion ?? "", llave)) return error("Clave de configuración incorrecta.", 403);
  const rut = normalizarRut(d.rut);
  if (!rut) return error("RUT inválido.");
  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  if (nombre.length < 3) return error("Ingrese el nombre completo.");
  const problema = U.problemaClave(d.clave, rut);
  if (problema) return error(problema);

  const ahora = new Date().toISOString();
  await U.guardar({
    rut, nombre, cargo: typeof d.cargo === "string" ? d.cargo.trim() : "", rol: "admin", activo: true,
    hash: await U.hashClave(d.clave), sv: 1, debeCambiarClave: false,
    creado: ahora, creadoPor: "configuracion-inicial", ultimoAcceso: null,
  });
  return json({ ok: true }, 201);
});

export const config = { path: "/api/configuracion-inicial" };
