// Pruebas de la intranet (publicaciones y archivos), con almacén en memoria.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.FUNCIONARIOS_STORE = "memoria";
process.env.SESSION_SECRET = "s".repeat(40);
process.env.FUNCIONARIOS_SETUP_KEY = "llave-de-prueba";
globalThis.Netlify = { env: { get: (k) => process.env[k] } };

const { _reiniciarAlmacenesPrueba } = await import("../netlify/lib/almacen.mjs");
const ingresar = (await import("../netlify/functions/auth-ingresar.mjs")).default;
const cambiar = (await import("../netlify/functions/auth-cambiar-clave.mjs")).default;
const admin = (await import("../netlify/functions/admin-usuarios.mjs")).default;
const config = (await import("../netlify/functions/configuracion-inicial.mjs")).default;
const pubs = (await import("../netlify/functions/intranet-publicaciones.mjs")).default;
const archivos = (await import("../netlify/functions/intranet-archivos.mjs")).default;

const BASE = "https://hospital.test";
function req(ruta, { metodo = "GET", datos, cookie, headers = {}, cuerpo } = {}) {
  const h = { origin: BASE, ...headers };
  if (datos) h["content-type"] = "application/json";
  if (cookie) h.cookie = cookie;
  return new Request(BASE + ruta, { method: metodo, headers: h, body: cuerpo ?? (datos ? JSON.stringify(datos) : undefined) });
}
const cookieDe = (r) => r.headers.get("set-cookie").split(";")[0];
const login = (rut, clave) => ingresar(req("/api/auth/ingresar", { metodo: "POST", datos: { rut, clave } }));

/** Crea admin + una cuenta con el rol pedido (ya con clave personal) y devuelve sus cookies. */
async function preparar() {
  await config(req("/api/configuracion-inicial", { metodo: "POST", datos: { claveConfiguracion: "llave-de-prueba", rut: "11111111-1", nombre: "Admin", clave: "Frutillar2026" } }));
  const cAdmin = cookieDe(await login("11111111-1", "Frutillar2026"));
  const cuenta = async (rut, nombre, rol) => {
    const r = await admin(req("/api/admin/usuarios", { metodo: "POST", cookie: cAdmin, datos: { rut, nombre, rol } }));
    const temp = (await r.json()).claveTemporal;
    const c = cookieDe(await login(rut, temp));
    const r2 = await cambiar(req("/api/auth/cambiar-clave", { metodo: "POST", cookie: c, datos: { actual: temp, nueva: "Lago2026sur" } }));
    return cookieDe(r2);
  };
  return { cAdmin, cEditor: await cuenta("12345678-5", "Editora Bienestar", "editor"), cFunc: await cuenta("10000013-K", "Luis Soto", "funcionario") };
}

beforeEach(() => _reiniciarAlmacenesPrueba());

test("Intranet: publicar con adjunto, listar, ver, descargar y permisos", async () => {
  const { cAdmin, cEditor, cFunc } = await preparar();

  // Sin sesión
  assert.equal((await pubs(req("/api/intranet/publicaciones"), { params: {} })).status, 401);

  // Funcionario no puede subir ni publicar
  let r = await archivos(req("/api/intranet/archivos", { metodo: "POST", cookie: cFunc, headers: { "content-type": "application/pdf", "x-nombre": "a.pdf" }, cuerpo: new Uint8Array([37, 80, 68, 70]) }), { params: {} });
  assert.equal(r.status, 403);

  // Tipo no permitido
  r = await archivos(req("/api/intranet/archivos", { metodo: "POST", cookie: cEditor, headers: { "content-type": "text/html", "x-nombre": "x.html" }, cuerpo: "<script>" }), { params: {} });
  assert.equal(r.status, 415);

  // Editor sube PDF y publica
  r = await archivos(req("/api/intranet/archivos", { metodo: "POST", cookie: cEditor, headers: { "content-type": "application/pdf", "x-nombre": encodeURIComponent("Menú octubre.pdf") }, cuerpo: new Uint8Array([37, 80, 68, 70, 45]) }), { params: {} });
  assert.equal(r.status, 201);
  const archivo = (await r.json()).archivo;
  assert.equal(archivo.nombre, "Menú octubre.pdf");

  r = await pubs(req("/api/intranet/publicaciones", { metodo: "POST", cookie: cEditor, datos: { titulo: "Menú casino octubre", categoria: "Casino", area: "Casino", cuerpo: "Revise el **menú**.", adjuntos: [archivo.id] } }), { params: {} });
  assert.equal(r.status, 201);
  const pub = (await r.json()).publicacion;
  assert.equal(pub.adjuntos[0].nombre, "Menú octubre.pdf");

  // Publicación con fecha antigua (migración) queda después en el listado
  await pubs(req("/api/intranet/publicaciones", { metodo: "POST", cookie: cAdmin, datos: { titulo: "Acta 22.09", categoria: "Actas", fecha: "2026-09-22T12:00:00Z", autorNombre: "Pablo Vásquez S." } }), { params: {} });

  // Funcionario ve el listado ordenado por fecha y puede filtrar
  r = await pubs(req("/api/intranet/publicaciones", { cookie: cFunc }), { params: {} });
  let lista = await r.json();
  assert.equal(lista.total, 2);
  assert.equal(lista.publicaciones[0].titulo, "Menú casino octubre");
  assert.equal(lista.publicaciones[1].autor, "Pablo Vásquez S.");
  assert.equal(lista.puedePublicar, false);
  r = await pubs(req("/api/intranet/publicaciones?categoria=Actas", { cookie: cFunc }), { params: {} });
  assert.equal((await r.json()).total, 1);

  // Detalle y descarga
  r = await pubs(req(`/api/intranet/publicaciones/${pub.id}`, { cookie: cFunc }), { params: { id: pub.id } });
  const det = await r.json();
  assert.equal(det.puedeEditar, false);
  r = await archivos(req(`/api/intranet/archivos/${archivo.id}`, { cookie: cFunc }), { params: { id: archivo.id } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  assert.equal(new Uint8Array(await r.arrayBuffer()).length, 5);
  assert.equal((await archivos(req(`/api/intranet/archivos/${archivo.id}`), { params: { id: archivo.id } })).status, 401, "sin sesión no se descarga");

  // Funcionario no puede editar ni borrar
  r = await pubs(req(`/api/intranet/publicaciones/${pub.id}`, { metodo: "DELETE", cookie: cFunc }), { params: { id: pub.id } });
  assert.equal(r.status, 403);

  // Autor edita y quita el adjunto → el archivo se elimina
  r = await pubs(req(`/api/intranet/publicaciones/${pub.id}`, { metodo: "PATCH", cookie: cEditor, datos: { titulo: "Menú casino octubre (actualizado)", categoria: "Casino", cuerpo: "Nuevo menú", adjuntos: [] } }), { params: { id: pub.id } });
  assert.equal(r.status, 200);
  assert.equal((await archivos(req(`/api/intranet/archivos/${archivo.id}`, { cookie: cFunc }), { params: { id: archivo.id } })).status, 404);

  // El editor no puede borrar lo que publicó el admin; el admin sí puede borrar lo del editor
  const otra = (await (await pubs(req("/api/intranet/publicaciones", { cookie: cFunc }), { params: {} })).json()).publicaciones.find((p) => p.categoria === "Actas");
  assert.equal((await pubs(req(`/api/intranet/publicaciones/${otra.id}`, { metodo: "DELETE", cookie: cEditor }), { params: { id: otra.id } })).status, 403);
  assert.equal((await pubs(req(`/api/intranet/publicaciones/${pub.id}`, { metodo: "DELETE", cookie: cAdmin }), { params: { id: pub.id } })).status, 200);
  lista = await (await pubs(req("/api/intranet/publicaciones", { cookie: cFunc }), { params: {} })).json();
  assert.equal(lista.total, 1);
});

test("Intranet: validaciones", async () => {
  const { cEditor } = await preparar();
  let r = await pubs(req("/api/intranet/publicaciones", { metodo: "POST", cookie: cEditor, datos: { titulo: "" } }), { params: {} });
  assert.equal(r.status, 400);
  r = await pubs(req("/api/intranet/publicaciones", { metodo: "POST", cookie: cEditor, datos: { titulo: "Futuro", fecha: "2099-01-01" } }), { params: {} });
  assert.equal(r.status, 400);
  r = await pubs(req("/api/intranet/publicaciones", { metodo: "POST", cookie: cEditor, datos: { titulo: "Categoría rara", categoria: "<script>" } }), { params: {} });
  assert.equal((await r.json()).publicacion.categoria, "General");
  r = await pubs(req("/api/intranet/publicaciones/../../x", { cookie: cEditor }), { params: { id: "../../x" } });
  assert.equal(r.status, 404);
});
