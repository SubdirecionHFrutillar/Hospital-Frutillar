import { test } from "node:test";
import assert from "node:assert/strict";
import { valorAcceso, cookieValida, claveCorrecta, destinoSeguro, paginaAcceso } from "../netlify/lib/acceso-sitio.mjs";

const SECRETO = "x".repeat(40);

test("clave correcta e incorrecta", async () => {
  assert.equal(await claveCorrecta("revision2026", "revision2026", SECRETO), true);
  assert.equal(await claveCorrecta(" revision2026 ", "revision2026", SECRETO), true);
  assert.equal(await claveCorrecta("otra", "revision2026", SECRETO), false);
});

test("sin SITIO_CLAVE configurada no se entra con nada", async () => {
  assert.equal(await claveCorrecta("", undefined, SECRETO), false);
  assert.equal(await claveCorrecta("algo", "", SECRETO), false);
  assert.equal(await cookieValida("", undefined, SECRETO), false);
});

test("la cookie deja de valer si cambia la clave", async () => {
  const v = await valorAcceso("revision2026", SECRETO);
  assert.equal(await cookieValida(v, "revision2026", SECRETO), true);
  assert.equal(await cookieValida(v, "nueva", SECRETO), false);
  assert.equal(await cookieValida("inventada", "revision2026", SECRETO), false);
});

test("solo vuelve a rutas del mismo sitio", () => {
  assert.equal(destinoSeguro("/horarios.html?x=1"), "/horarios.html?x=1");
  assert.equal(destinoSeguro("//malo.com"), "/");
  assert.equal(destinoSeguro("https://malo.com"), "/");
  assert.equal(destinoSeguro(null), "/");
});

test("la página de acceso escapa el destino y no se indexa", () => {
  const html = paginaAcceso({ volver: '/x"><script>' });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes('content="noindex, nofollow"'));
});
