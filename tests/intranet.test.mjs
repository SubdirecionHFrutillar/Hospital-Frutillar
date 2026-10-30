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

test("Noticias del sitio: solo Comunicaciones/Admin publican; API pública y archivos públicos", async () => {
  const { cAdmin, cEditor, cFunc } = await preparar();
  const noticias = (await import("../netlify/functions/noticias.mjs")).default;
  const narch = (await import("../netlify/functions/noticias-archivos.mjs")).default;

  // Cuenta de Comunicaciones
  const r0 = await admin(req("/api/admin/usuarios", { metodo: "POST", cookie: cAdmin, datos: { rut: "15555555-6", nombre: "Comunicaciones", rol: "comunicaciones" } }));
  assert.equal(r0.status, 201, await r0.clone().text());
  const temp = (await r0.json()).claveTemporal;
  let c = cookieDe(await login("15555555-6", temp));
  c = cookieDe(await cambiar(req("/api/auth/cambiar-clave", { metodo: "POST", cookie: c, datos: { actual: temp, nueva: "Prensa2026sur" } })));

  // Editor y funcionario no pueden
  for (const ck of [cEditor, cFunc]) {
    assert.equal((await noticias(req("/api/noticias", { metodo: "POST", cookie: ck, datos: { titulo: "x", resumen: "y" } }), { params: {} })).status, 403);
  }
  // Comunicaciones sube imagen y publica
  let r = await narch(req("/api/noticias-archivos", { metodo: "POST", cookie: c, headers: { "content-type": "image/png", "x-nombre": "foto.png" }, cuerpo: new Uint8Array([137, 80, 78, 71]) }), { params: {} });
  assert.equal(r.status, 201);
  const foto = (await r.json()).archivo;
  r = await noticias(req("/api/noticias", { metodo: "POST", cookie: c, datos: { titulo: "Llega nueva ambulancia a la base SAMU", resumen: "La base SAMU Frutillar recibe una ambulancia de alta tecnología.", categoria: "Institucional", cuerpo: "Texto", destacada: true, adjuntos: [foto.id] } }), { params: {} });
  assert.equal(r.status, 201);
  const n = (await r.json()).noticia;
  assert.equal(n.slug, "llega-nueva-ambulancia-a-la-base-samu");
  assert.equal(n.imagen, foto.id);

  // Mismo título → dirección única
  r = await noticias(req("/api/noticias", { metodo: "POST", cookie: c, datos: { titulo: "Llega nueva ambulancia a la base SAMU", resumen: "Duplicada para probar la dirección única." } }), { params: {} });
  assert.equal((await r.json()).noticia.slug, "llega-nueva-ambulancia-a-la-base-samu-2");

  // Falta resumen
  r = await noticias(req("/api/noticias", { metodo: "POST", cookie: c, datos: { titulo: "Sin resumen" } }), { params: {} });
  assert.equal(r.status, 400);

  // Admin puede fijar la dirección (migración); comunicaciones no
  r = await noticias(req("/api/noticias", { metodo: "POST", cookie: cAdmin, datos: { titulo: "Operativo rural", resumen: "Operativo de salud comunitaria en sector rural.", slug: "operativo-rural", fecha: "2026-05-19T12:00:00Z" } }), { params: {} });
  assert.equal((await r.json()).noticia.slug, "operativo-rural");

  // API pública sin sesión
  r = await noticias(req("/api/noticias/publicas"), { params: { id: "publicas" } });
  const pub = (await r.json()).noticias;
  assert.equal(pub.length, 3);
  // Archivo público sin sesión, con caché larga
  r = await narch(req(`/api/noticias-archivos/${foto.id}`), { params: { id: foto.id } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /immutable/);

  // Gestión requiere sesión
  assert.equal((await noticias(req("/api/noticias"), { params: {} })).status, 401);

  // Editar y eliminar
  r = await noticias(req(`/api/noticias/${n.id}`, { metodo: "PATCH", cookie: c, datos: { titulo: "Llega nueva ambulancia", resumen: "Resumen corregido de la noticia.", adjuntos: [] } }), { params: { id: n.id } });
  const ed = (await r.json()).noticia;
  assert.equal(ed.slug, "llega-nueva-ambulancia-a-la-base-samu", "la dirección no cambia al editar el título");
  assert.equal(ed.imagen, null);
  assert.equal((await narch(req(`/api/noticias-archivos/${foto.id}`), { params: { id: foto.id } })).status, 404, "la foto quitada se borra");
  assert.equal((await noticias(req(`/api/noticias/${n.id}`, { metodo: "DELETE", cookie: c }), { params: { id: n.id } })).status, 200);
});

test("Archivos grandes: subida por partes y descarga completa", async () => {
  const { cEditor, cFunc } = await preparar();
  const total = 3, tam = 4 * 1024 * 1024;
  const subida = "0123456789abcdef";
  let r;
  for (let i = 0; i < total; i++) {
    const parte = new Uint8Array(i === total - 1 ? 1000 : tam).fill(65 + i);
    r = await archivos(req("/api/intranet/archivos", { metodo: "POST", cookie: cEditor, headers: { "content-type": "application/pdf", "x-nombre": "Boletin.pdf", "x-subida": subida, "x-parte": String(i), "x-partes": String(total) }, cuerpo: parte }), { params: {} });
    assert.equal(r.status, i < total - 1 ? 202 : 201);
  }
  const a = (await r.json()).archivo;
  assert.equal(a.tamano, 2 * tam + 1000);
  r = await archivos(req(`/api/intranet/archivos/${a.id}`, { cookie: cFunc }), { params: { id: a.id } });
  const bytes = new Uint8Array(await r.arrayBuffer());
  assert.equal(bytes.length, 2 * tam + 1000);
  assert.equal(bytes[0], 65);
  assert.equal(bytes[tam], 66);
  assert.equal(bytes.at(-1), 67);
  // Parte inválida
  r = await archivos(req("/api/intranet/archivos", { metodo: "POST", cookie: cEditor, headers: { "content-type": "application/pdf", "x-subida": subida, "x-parte": "5", "x-partes": "3" }, cuerpo: new Uint8Array(10) }), { params: {} });
  assert.equal(r.status, 400);
  // Un envío simple > 5 MB se rechaza
  r = await archivos(req("/api/intranet/archivos", { metodo: "POST", cookie: cEditor, headers: { "content-type": "application/pdf" }, cuerpo: new Uint8Array(6 * 1024 * 1024) }), { params: {} });
  assert.equal(r.status, 413);
});

test("Miniaturas de imágenes: solo editores las suben; el listado las usa y cae al original si faltan", async () => {
  const { cEditor, cFunc } = await preparar();
  const foto = new Uint8Array(2000).fill(7);
  let r = await archivos(req("/api/intranet/archivos", { metodo: "POST", cookie: cEditor, headers: { "content-type": "image/jpeg", "x-nombre": "foto.jpg" }, cuerpo: foto }), { params: {} });
  const { archivo } = await r.json();
  const p = { id: archivo.id };

  // Sin miniatura: ?tam=min entrega el original con caché corta
  r = await archivos(req(`/api/intranet/archivos/${archivo.id}?tam=min`, { cookie: cFunc }), { params: p });
  assert.equal(r.status, 200);
  assert.equal((await r.arrayBuffer()).byteLength, 2000);
  assert.match(r.headers.get("cache-control"), /max-age=3600/);

  // Funcionario no puede subir miniaturas; tipo y tamaño se validan
  const mini = (cookie, tipo, cuerpo) => archivos(req(`/api/intranet/archivos/${archivo.id}/miniatura`, { metodo: "POST", cookie, headers: { "content-type": tipo }, cuerpo }), { params: { ...p, accion: "miniatura" } });
  assert.equal((await mini(cFunc, "image/webp", new Uint8Array(10))).status, 403);
  assert.equal((await mini(cEditor, "image/png", new Uint8Array(10))).status, 415);
  assert.equal((await mini(cEditor, "image/webp", new Uint8Array(400 * 1024))).status, 413);
  assert.equal((await mini(cEditor, "image/webp", new Uint8Array(300))).status, 201);

  r = await archivos(req(`/api/intranet/archivos/${archivo.id}?tam=min`, { cookie: cFunc }), { params: p });
  assert.equal((await r.arrayBuffer()).byteLength, 300);
  assert.equal(r.headers.get("content-type"), "image/webp");
  assert.match(r.headers.get("cache-control"), /immutable/);

  // Un PDF no admite miniatura
  r = await archivos(req("/api/intranet/archivos", { metodo: "POST", cookie: cEditor, headers: { "content-type": "application/pdf", "x-nombre": "a.pdf" }, cuerpo: new Uint8Array([37, 80, 68, 70]) }), { params: {} });
  const pdf = (await r.json()).archivo;
  r = await archivos(req(`/api/intranet/archivos/${pdf.id}/miniatura`, { metodo: "POST", cookie: cEditor, headers: { "content-type": "image/webp" }, cuerpo: new Uint8Array(10) }), { params: { id: pdf.id, accion: "miniatura" } });
  assert.equal(r.status, 404);
});

test("Avisos del sitio: solo Comunicaciones/Admin; validación, máximo y API pública de vigentes", async () => {
  const avisos = (await import("../netlify/functions/avisos.mjs")).default;
  const { cAdmin, cEditor } = await preparar();
  const crear = (cookie, datos) => avisos(req("/api/avisos", { metodo: "POST", cookie, datos }), { params: {} });

  assert.equal((await crear(cEditor, { texto: "Aviso de prueba" })).status, 403, "editor de intranet no publica en el sitio");
  assert.equal((await crear(cAdmin, { texto: "Hola" })).status, 400, "texto muy corto");
  assert.equal((await crear(cAdmin, { texto: "Aviso con enlace raro", url: "javascript:alert(1)" })).status, 400);
  assert.equal((await crear(cAdmin, { texto: "Aviso que ya venció", hasta: "2000-01-01" })).status, 400);

  let r = await crear(cAdmin, { texto: "Farmacia cerrada el feriado", tipo: "importante", url: "/horarios.html", hasta: "2999-12-31" });
  assert.equal(r.status, 201);
  const { aviso } = await r.json();
  assert.equal(aviso.tipo, "importante");
  for (let i = 0; i < 4; i++) assert.equal((await crear(cAdmin, { texto: `Aviso número ${i}` })).status, 201);
  assert.equal((await crear(cAdmin, { texto: "Uno de más" })).status, 409, "máximo 5 avisos");

  r = await avisos(req("/api/avisos/vigentes"), { params: { id: "vigentes" } });
  assert.equal((await r.json()).avisos.length, 5, "la lista pública no requiere sesión");
  assert.equal((await avisos(req("/api/avisos"), { params: {} })).status, 401);

  r = await avisos(req(`/api/avisos/${aviso.id}`, { metodo: "DELETE", cookie: cAdmin }), { params: { id: aviso.id } });
  assert.equal(r.status, 200);
  r = await avisos(req("/api/avisos/vigentes"), { params: { id: "vigentes" } });
  assert.equal((await r.json()).avisos.length, 4);
});

test("Noticias en vivo: página armada al momento, API pública con caché y sin HTML del autor", async () => {
  const { cAdmin } = await preparar();
  const noticias = (await import("../netlify/functions/noticias.mjs")).default;
  const pagina = (await import("../netlify/functions/noticia-pagina.mjs")).default;
  const vivo = (await import("../netlify/functions/sitio-vivo.mjs")).default;
  const avisos = (await import("../netlify/functions/avisos.mjs")).default;

  // La función descarga la plantilla y el 404 del propio sitio
  const PLANTILLA = '<html><head><title>__NOTICIA_TITULO__ - Hospital</title><meta name="description" content="__NOTICIA_RESUMEN__">'
    + '<link rel="canonical" href="https://hospital.test/noticias/plantilla.html"><meta property="og:image" content="https://hospital.test/__NOTICIA_IMAGEN__">'
    + "</head><body><main><!--__NOTICIA_CUERPO__--></main></body></html>";
  const fetchOriginal = globalThis.fetch;
  const pedidas = [];
  globalThis.fetch = async (url) => {
    pedidas.push(String(url));
    if (String(url).endsWith("/noticias/plantilla.html")) return new Response(PLANTILLA);
    if (String(url).endsWith("/404.html")) return new Response("<h1>No encontrada</h1>");
    return fetchOriginal(url);
  };
  try {
    let r = await noticias(req("/api/noticias", { metodo: "POST", cookie: cAdmin, datos: {
      titulo: 'Vacunación "influenza" <2026>', resumen: "Campaña de vacunación en el hospital & CESFAM.", categoria: "Salud",
      cuerpo: "**Horario:** 08:00 a 17:00\n\n<script>alert(1)</script>",
    } }), { params: {} });
    assert.equal(r.status, 201);
    const n = (await r.json()).noticia;

    // Página: datos escapados en <head>, Markdown interpretado y HTML crudo neutralizado
    r = await pagina(req(`/noticias/${n.slug}/`), { params: { slug: n.slug } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("netlify-cdn-cache-control"), /s-maxage/);
    assert.equal(r.headers.get("netlify-cache-tag"), "sitio-vivo");
    const html = await r.text();
    assert.match(html, /<title>Vacunación &quot;influenza&quot; &lt;2026&gt; - Hospital<\/title>/);
    assert.match(html, /content="Campaña de vacunación en el hospital &amp; CESFAM\."/);
    assert.match(html, new RegExp(`href="https://hospital.test/noticias/${n.slug}/"`));
    assert.match(html, /og:image" content="https:\/\/hospital.test\/img\/hero-hospital.jpg"/, "sin foto usa la imagen del hospital");
    assert.match(html, /<strong>Horario:<\/strong>/);
    assert.doesNotMatch(html, /<script>alert/);
    assert.doesNotMatch(html, /__NOTICIA_/);

    // Sin barra final → redirige a la dirección canónica
    r = await pagina(req(`/noticias/${n.slug}`), { params: { slug: n.slug } });
    assert.equal(r.status, 301);
    assert.equal(r.headers.get("location"), `/noticias/${n.slug}/`);

    // Inexistente → 404 del sitio
    r = await pagina(req("/noticias/no-existe/"), { params: { slug: "no-existe" } });
    assert.equal(r.status, 404);
    assert.match(await r.text(), /No encontrada/);

    // API pública: resumen de noticias + avisos vigentes, sin sesión y en caché del CDN
    await avisos(req("/api/avisos", { metodo: "POST", cookie: cAdmin, datos: { texto: "Corte de agua programado el lunes", tipo: "importante" } }), { params: {} });
    r = await vivo(req("/api/sitio-vivo"));
    assert.equal(r.status, 200);
    assert.match(r.headers.get("netlify-cdn-cache-control"), /durable/);
    const d = await r.json();
    assert.equal(d.noticias.length, 1);
    assert.equal(d.noticias[0].url, `/noticias/${n.slug}/`);
    assert.equal(d.noticias[0].cuerpo, undefined, "el listado no trae el cuerpo");
    assert.equal(d.avisos.length, 1);

    // Editar se refleja de inmediato; eliminar deja la dirección en 404
    await noticias(req(`/api/noticias/${n.id}`, { metodo: "PATCH", cookie: cAdmin, datos: { titulo: "Vacunación influenza 2026", resumen: "Resumen corregido de la campaña.", adjuntos: [] } }), { params: { id: n.id } });
    r = await pagina(req(`/noticias/${n.slug}/`), { params: { slug: n.slug } });
    assert.match(await r.text(), /<title>Vacunación influenza 2026 - Hospital<\/title>/);
    await noticias(req(`/api/noticias/${n.id}`, { metodo: "DELETE", cookie: cAdmin }), { params: { id: n.id } });
    assert.equal((await pagina(req(`/noticias/${n.slug}/`), { params: { slug: n.slug } })).status, 404);
    assert.equal(pedidas.filter((u) => u.endsWith("plantilla.html")).length, 1, "la plantilla se descarga una sola vez");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
