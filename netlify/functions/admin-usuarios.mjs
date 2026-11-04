// Gestión de cuentas (solo rol "admin").
//   GET   /api/admin/usuarios                         → lista
//   POST  /api/admin/usuarios  { rut, nombre, cargo, rol }   → crea la cuenta
//         Clave inicial (ver claveInicial en lib/usuarios.mjs): por defecto los 4 primeros dígitos del RUT;
//         con FUNCIONARIOS_CLAVE_INICIAL, esa clave común; con FUNCIONARIOS_CLAVE_ALEATORIA=si, una aleatoria.
//         En todos los casos vence a las 72 h si no se cambia.
//   PATCH /api/admin/usuarios  { rut, accion: "restablecer" | "activar" | "desactivar" | "editar", nombre?, cargo?, rol?, correo? }
//   DELETE /api/admin/usuarios { rut }  → elimina la cuenta (no la propia ni el último administrador)
import { normalizarRut } from "../lib/rut.mjs";
import * as U from "../lib/usuarios.mjs";
import { manejador, sesionActual, leerJSON, json, error, env } from "../lib/http.mjs";

// La clave común nunca viaja en la respuesta (el administrador ya la conoce).
const entregarClave = (clave, modo) =>
  modo === "comun" ? { claveComun: true } : { claveTemporal: clave, ...(modo === "rut" && { claveDeRut: true }) };

const texto = (v, max = 120) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export default manejador(["GET", "POST", "PATCH", "DELETE"], async (req) => {
  const yo = await sesionActual(req);
  if (!yo) return error("Sesión no válida.", 401);
  if (yo.rol !== "admin") return error("No tiene permisos para administrar cuentas.", 403);
  if (yo.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);

  if (req.method === "GET") {
    return json({
      usuarios: (await U.listar()).map(U.publico),
      claveComunConfigurada: !!env("FUNCIONARIOS_CLAVE_INICIAL"),
      modoClave: U.modoClave(env),
      vigenciaHoras: U.VIGENCIA_TEMPORAL_HORAS,
    });
  }

  const datos = await leerJSON(req);
  const rut = normalizarRut(datos.rut);
  if (!rut) return error("RUT inválido.");

  if (req.method === "POST") {
    const nombre = texto(datos.nombre);
    if (nombre.length < 3) return error("Ingrese el nombre completo.");
    const rol = U.ROLES.includes(datos.rol) ? datos.rol : "funcionario";
    if (await U.obtener(rut)) return error("Ya existe una cuenta con ese RUT.", 409);
    const correo = U.correoValido(datos.correo);
    if (correo === null) return error("El correo de contacto no es válido.");

    const { clave: temporal, modo } = U.claveInicial(rut, env);
    const ahora = new Date().toISOString();
    const nuevo = await U.guardar({
      rut, nombre, cargo: texto(datos.cargo), correo, rol, activo: true,
      hash: await U.hashClave(temporal), sv: 1, debeCambiarClave: true, claveTemporalVence: U.venceTemporal(),
      creado: ahora, creadoPor: yo.rut, ultimoAcceso: null,
    });
    return json({ usuario: U.publico(nuevo), ...entregarClave(temporal, modo) }, 201);
  }

  const u = await U.obtener(rut);
  if (!u) return error("No existe una cuenta con ese RUT.", 404);
  const esUno = u.rut === yo.rut;
  const otrosAdmins = async () => (await U.listar()).some((x) => x.rut !== u.rut && x.rol === "admin" && x.activo);

  if (req.method === "DELETE") {
    if (esUno) return error("No puede eliminar su propia cuenta.");
    if (u.rol === "admin" && !(await otrosAdmins())) return error("No se puede eliminar al único administrador.");
    await U.eliminar(rut);
    return json({ ok: true });
  }

  // PATCH
  let entrega = {};

  switch (datos.accion) {
    case "restablecer": {
      const { clave, modo } = U.claveInicial(rut, env);
      entrega = entregarClave(clave, modo);
      u.hash = await U.hashClave(clave);
      u.debeCambiarClave = true;
      u.claveTemporalVence = U.venceTemporal();
      u.sv += 1;
      await U.limpiarFallos(rut);
      break;
    }
    case "activar":
      u.activo = true;
      await U.limpiarFallos(rut);
      break;
    case "desactivar":
      if (esUno) return error("No puede desactivar su propia cuenta.");
      u.activo = false;
      u.sv += 1;
      break;
    case "editar": {
      if (datos.nombre !== undefined) {
        const n = texto(datos.nombre);
        if (n.length < 3) return error("Ingrese el nombre completo.");
        u.nombre = n;
      }
      if (datos.cargo !== undefined) u.cargo = texto(datos.cargo);
      if (datos.correo !== undefined) {
        const c = U.correoValido(datos.correo);
        if (c === null) return error("El correo de contacto no es válido.");
        u.correo = c;
      }
      if (datos.rol !== undefined) {
        if (!U.ROLES.includes(datos.rol)) return error("Rol inválido.");
        if (esUno && datos.rol !== "admin") return error("No puede quitarse a sí mismo el rol de administrador.");
        if (u.rol !== datos.rol) u.sv += 1;
        u.rol = datos.rol;
      }
      break;
    }
    default:
      return error("Acción no reconocida.");
  }
  await U.guardar(u);
  return json({ usuario: U.publico(u), ...entrega });
});

export const config = { path: "/api/admin/usuarios" };
