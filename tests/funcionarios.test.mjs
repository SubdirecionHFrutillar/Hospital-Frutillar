// Pruebas del acceso de funcionarios (sin Netlify: almacén en memoria).
// Ejecutar: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.FUNCIONARIOS_STORE = "memoria";
process.env.SESSION_SECRET = "s".repeat(40);
process.env.FUNCIONARIOS_SETUP_KEY = "llave-de-prueba";
globalThis.Netlify = { env: { get: (k) => process.env[k] } };

const { normalizarRut, formatearRut } = await import("../netlify/lib/rut.mjs");
const U = await import("../netlify/lib/usuarios.mjs");
const ingresar = (await import("../netlify/functions/auth-ingresar.mjs")).default;
const yo = (await import("../netlify/functions/auth-yo.mjs")).default;
const cambiar = (await import("../netlify/functions/auth-cambiar-clave.mjs")).default;
const admin = (await import("../netlify/functions/admin-usuarios.mjs")).default;
const config = (await import("../netlify/functions/configuracion-inicial.mjs")).default;
const borde = (await import("../netlify/edge-functions/proteger-portal.js")).default;

const BASE = "https://hospital.test";
const ADMIN = { rut: "11.111.111-1", clave: "Frutillar2026" };

function req(ruta, { metodo = "GET", datos, cookie, origen = BASE } = {}) {
  const headers = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  if (origen) headers.origin = origen;
  return new Request(BASE + ruta, { method: metodo, headers, body: datos ? JSON.stringify(datos) : undefined });
}
const cookieDe = (res) => res.headers.get("set-cookie").split(";")[0];

async function crearAdmin() {
  const r = await config(req("/api/configuracion-inicial", { metodo: "POST", datos: { claveConfiguracion: "llave-de-prueba", rut: ADMIN.rut, nombre: "Admin Prueba", clave: ADMIN.clave } }));
  assert.equal(r.status, 201);
}
async function login(rut, clave) {
  return ingresar(req("/api/auth/ingresar", { metodo: "POST", datos: { rut, clave } }));
}

beforeEach(() => U._reiniciarAlmacenPrueba());

test("RUT: valida dígito verificador y normaliza", () => {
  assert.equal(normalizarRut("11.111.111-1"), "11111111-1");
  assert.equal(normalizarRut("12345678-5"), "12345678-5");
  assert.equal(normalizarRut("12.345.678-K"), null);
  assert.equal(normalizarRut("6.000.017-k"), null);
  assert.equal(normalizarRut("10.000.013-k"), "10000013-K");
  assert.equal(normalizarRut("abc"), null);
  assert.equal(formatearRut("12345678-5"), "12.345.678-5");
});

test("Contraseña: reglas mínimas", () => {
  assert.ok(U.problemaClave("corta1", "12345678-5"));
  assert.ok(U.problemaClave("sololetras", "12345678-5"));
  assert.ok(U.problemaClave("x12345678", "12345678-5"));
  assert.equal(U.problemaClave("Frutillar2026", "12345678-5"), null);
});

test("Configuración inicial: una sola vez y con la llave correcta", async () => {
  let r = await config(req("/api/configuracion-inicial", { metodo: "POST", datos: { claveConfiguracion: "otra", rut: ADMIN.rut, nombre: "X Y Z", clave: ADMIN.clave } }));
  assert.equal(r.status, 403);
  await crearAdmin();
  r = await config(req("/api/configuracion-inicial"));
  assert.deepEqual(await r.json(), { disponible: false });
  r = await config(req("/api/configuracion-inicial", { metodo: "POST", datos: { claveConfiguracion: "llave-de-prueba", rut: "12345678-5", nombre: "Otro", clave: "Otra2026clave" } }));
  assert.equal(r.status, 403);
});

test("Ingreso: credenciales correctas e incorrectas, sesión y salida del borde", async () => {
  await crearAdmin();
  assert.equal((await login(ADMIN.rut, "mala")).status, 401);
  assert.equal((await login("12345678-5", "mala")).status, 401); // RUT inexistente: mismo mensaje
  const r = await login("11111111-1", ADMIN.clave);
  assert.equal(r.status, 200);
  const sc = r.headers.get("set-cookie");
  assert.match(sc, /HttpOnly/);
  assert.match(sc, /SameSite=Strict/);
  assert.match(sc, /Secure/);
  const cookie = cookieDe(r);

  const me = await (await yo(req("/api/auth/yo", { cookie }))).json();
  assert.equal(me.usuario.rut, "11111111-1");
  assert.equal(me.usuario.hash, undefined, "nunca exponer el hash");

  // Borde: sin cookie → redirige al ingreso; con cookie → deja pasar
  const ctx = { next: async () => new Response("portal") };
  let b = await borde(new Request(BASE + "/funcionarios/"), ctx);
  assert.equal(b.status, 302);
  assert.match(b.headers.get("location"), /\/funcionarios\/ingresar\.html\?volver=%2Ffuncionarios%2F/);
  b = await borde(new Request(BASE + "/funcionarios/", { headers: { cookie } }), ctx);
  assert.equal(await b.text(), "portal");
  assert.equal(b.headers.get("cache-control"), "private, no-store");
  // Token alterado → rechazado
  b = await borde(new Request(BASE + "/funcionarios/", { headers: { cookie: cookie.slice(0, -3) + "abc" } }), ctx);
  assert.equal(b.status, 302);
});

test("Bloqueo tras 5 intentos fallidos", async () => {
  await crearAdmin();
  for (let i = 0; i < 4; i++) assert.equal((await login(ADMIN.rut, "mala")).status, 401);
  assert.equal((await login(ADMIN.rut, "mala")).status, 429);
  assert.equal((await login(ADMIN.rut, ADMIN.clave)).status, 429, "bloqueado aunque la clave sea correcta");
});

test("CSRF: rechaza POST desde otro origen", async () => {
  await crearAdmin();
  const r = await ingresar(req("/api/auth/ingresar", { metodo: "POST", datos: { rut: ADMIN.rut, clave: ADMIN.clave }, origen: "https://malicioso.test" }));
  assert.equal(r.status, 403);
});

test("Administración: crear cuenta, clave temporal, cambio obligatorio y permisos", async () => {
  await crearAdmin();
  const cAdmin = cookieDe(await login(ADMIN.rut, ADMIN.clave));

  // Crear funcionario
  let r = await admin(req("/api/admin/usuarios", { metodo: "POST", cookie: cAdmin, datos: { rut: "12.345.678-5", nombre: "Ana Pérez", cargo: "TENS", rol: "funcionario" } }));
  assert.equal(r.status, 201);
  const { claveTemporal, usuario } = await r.json();
  assert.match(claveTemporal, /^[a-z]{4}-\d{4}-[a-z]{4}$/);
  assert.equal(usuario.debeCambiarClave, true);

  // Duplicado
  r = await admin(req("/api/admin/usuarios", { metodo: "POST", cookie: cAdmin, datos: { rut: "12345678-5", nombre: "Ana Pérez" } }));
  assert.equal(r.status, 409);

  // El funcionario ingresa con la temporal y debe cambiarla
  r = await login("12345678-5", claveTemporal);
  assert.equal((await r.json()).debeCambiarClave, true);
  const cAna = cookieDe(r);

  // Un funcionario no puede administrar
  assert.equal((await admin(req("/api/admin/usuarios", { cookie: cAna }))).status, 403);
  // Ni entrar a la página de administración (borde)
  const b = await borde(new Request(BASE + "/funcionarios/administrar.html", { headers: { cookie: cAna } }), { next: async () => new Response("x") });
  assert.equal(b.status, 302);
  assert.match(b.headers.get("location"), /\/funcionarios\/$/);

  // Cambio de clave: invalida la sesión anterior
  r = await cambiar(req("/api/auth/cambiar-clave", { metodo: "POST", cookie: cAna, datos: { actual: claveTemporal, nueva: "Lago2026sur" } }));
  assert.equal(r.status, 200);
  const cAna2 = cookieDe(r);
  assert.equal((await yo(req("/api/auth/yo", { cookie: cAna }))).status, 401, "sesión vieja invalidada");
  assert.equal((await yo(req("/api/auth/yo", { cookie: cAna2 }))).status, 200);

  // Desactivar → ya no puede ingresar ni usar su sesión
  r = await admin(req("/api/admin/usuarios", { metodo: "PATCH", cookie: cAdmin, datos: { rut: "12345678-5", accion: "desactivar" } }));
  assert.equal(r.status, 200);
  assert.equal((await yo(req("/api/auth/yo", { cookie: cAna2 }))).status, 401);
  assert.equal((await login("12345678-5", "Lago2026sur")).status, 401);

  // Reactivar y restablecer
  await admin(req("/api/admin/usuarios", { metodo: "PATCH", cookie: cAdmin, datos: { rut: "12345678-5", accion: "activar" } }));
  r = await admin(req("/api/admin/usuarios", { metodo: "PATCH", cookie: cAdmin, datos: { rut: "12345678-5", accion: "restablecer" } }));
  const nueva = (await r.json()).claveTemporal;
  assert.equal((await login("12345678-5", nueva)).status, 200);

  // El admin no puede desactivarse ni quitarse el rol a sí mismo
  r = await admin(req("/api/admin/usuarios", { metodo: "PATCH", cookie: cAdmin, datos: { rut: ADMIN.rut, accion: "desactivar" } }));
  assert.equal(r.status, 400);
  r = await admin(req("/api/admin/usuarios", { metodo: "PATCH", cookie: cAdmin, datos: { rut: ADMIN.rut, accion: "editar", rol: "funcionario" } }));
  assert.equal(r.status, 400);

  // Listado sin hashes
  const lista = (await (await admin(req("/api/admin/usuarios", { cookie: cAdmin }))).json()).usuarios;
  assert.equal(lista.length, 2);
  assert.ok(lista.every((u) => !("hash" in u)));
});
