// Gestión de cuentas (solo rol "admin").
//   GET   /api/admin/usuarios                         → lista
//   POST  /api/admin/usuarios  { rut, nombre, cargo, rol }   → crea; devuelve clave temporal
//   PATCH /api/admin/usuarios  { rut, accion: "restablecer" | "activar" | "desactivar" | "editar", nombre?, cargo?, rol? }
import { normalizarRut } from "../lib/rut.mjs";
import * as U from "../lib/usuarios.mjs";
import { manejador, sesionActual, leerJSON, json, error } from "../lib/http.mjs";

const texto = (v, max = 120) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export default manejador(["GET", "POST", "PATCH"], async (req) => {
  const yo = await sesionActual(req);
  if (!yo) return error("Sesión no válida.", 401);
  if (yo.rol !== "admin") return error("No tiene permisos para administrar cuentas.", 403);
  if (yo.debeCambiarClave) return error("Debe cambiar su contraseña temporal antes de continuar.", 403);

  if (req.method === "GET") {
    return json({ usuarios: (await U.listar()).map(U.publico) });
  }

  const datos = await leerJSON(req);
  const rut = normalizarRut(datos.rut);
  if (!rut) return error("RUT inválido.");

  if (req.method === "POST") {
    const nombre = texto(datos.nombre);
    if (nombre.length < 3) return error("Ingrese el nombre completo.");
    const rol = U.ROLES.includes(datos.rol) ? datos.rol : "funcionario";
    if (await U.obtener(rut)) return error("Ya existe una cuenta con ese RUT.", 409);

    const temporal = U.claveTemporal();
    const ahora = new Date().toISOString();
    const nuevo = await U.guardar({
      rut, nombre, cargo: texto(datos.cargo), rol, activo: true,
      hash: await U.hashClave(temporal), sv: 1, debeCambiarClave: true,
      creado: ahora, creadoPor: yo.rut, ultimoAcceso: null,
    });
    return json({ usuario: U.publico(nuevo), claveTemporal: temporal }, 201);
  }

  // PATCH
  const u = await U.obtener(rut);
  if (!u) return error("No existe una cuenta con ese RUT.", 404);
  const esUno = u.rut === yo.rut;
  let claveTemporal;

  switch (datos.accion) {
    case "restablecer":
      claveTemporal = U.claveTemporal();
      u.hash = await U.hashClave(claveTemporal);
      u.debeCambiarClave = true;
      u.sv += 1;
      await U.limpiarFallos(rut);
      break;
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
  return json({ usuario: U.publico(u), ...(claveTemporal && { claveTemporal }) });
});

export const config = { path: "/api/admin/usuarios" };
