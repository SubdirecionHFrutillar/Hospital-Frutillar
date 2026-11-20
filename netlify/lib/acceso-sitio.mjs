// Sitio con clave: mientras no se lance oficialmente, el sitio público solo se ve con una clave común
// (variable SITIO_CLAVE en Netlify) o con una sesión del Portal de Funcionarios.
// Funciona igual en Node (pruebas) y en la Edge Function (Deno).

export const COOKIE_ACCESO = "hf_acceso";
export const DURACION_ACCESO_SEG = 30 * 24 * 60 * 60; // 30 días
export const RUTA_ACCESO = "/acceso-sitio";

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Valor de la cookie para una clave: HMAC(secreto, clave). Cambiar la clave invalida las cookies anteriores. */
export async function valorAcceso(claveSitio, secreto) {
  if (!claveSitio || !secreto) return null;
  const k = await crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode("acceso-sitio:" + claveSitio))));
}

function iguales(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function cookieValida(valor, claveSitio, secreto) {
  const esperado = await valorAcceso(claveSitio, secreto);
  return !!esperado && iguales(valor || "", esperado);
}

/** ¿La clave escrita es la correcta? Sin SITIO_CLAVE configurada, nunca. */
export async function claveCorrecta(escrita, claveSitio, secreto) {
  if (!claveSitio || typeof escrita !== "string") return false;
  const a = await valorAcceso(escrita.trim(), secreto);
  const b = await valorAcceso(claveSitio, secreto);
  return !!a && iguales(a, b);
}

export function cookieAcceso(valor) {
  return `${COOKIE_ACCESO}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACION_ACCESO_SEG}`;
}

/** Solo rutas internas del mismo sitio (evita redirigir a otro dominio). */
export function destinoSeguro(volver) {
  return typeof volver === "string" && volver.startsWith("/") && !volver.startsWith("//") && !volver.startsWith("/\\") ? volver : "/";
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function paginaAcceso({ volver = "/", error = false } = {}) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Hospital de Frutillar · Sitio en preparación</title>
<link rel="icon" href="/img/favicon-32.png">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A2A5E;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1F2937;padding:16px}
.caja{background:#fff;border-radius:10px;max-width:400px;width:100%;padding:28px 24px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.logo{display:flex;align-items:center;gap:12px;margin-bottom:18px}.logo img{height:48px}.logo b{display:block;color:#0A2A5E;font-size:18px}.logo small{color:#6B7280;font-size:12px}
h1{font-size:19px;margin:0 0 6px;color:#0A2A5E}p{margin:0 0 16px;font-size:14px;line-height:1.5;color:#4B5563}
label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}input{width:100%;font-size:16px;padding:10px 12px;border:1px solid #D1D5DB;border-radius:6px}
input:focus{outline:3px solid #93C5FD;border-color:#0F69C4}button{margin-top:12px;width:100%;background:#0F69C4;color:#fff;border:0;border-radius:6px;padding:11px;font-size:15px;font-weight:700;cursor:pointer}
button:hover{background:#0A2A5E}.error{background:#FEF2F2;color:#B91C1C;border-radius:6px;padding:8px 10px;font-size:13px;margin-bottom:12px}
.urg{border-top:1px solid #E5E7EB;margin-top:20px;padding-top:14px;font-size:13px;color:#4B5563}.urg a{color:#0F69C4;font-weight:700}
</style></head><body><main class="caja">
<div class="logo"><img src="/img/logo-hospital.png" alt=""><div><b>Hospital de Frutillar</b><small>Servicio de Salud del Reloncaví</small></div></div>
<h1>Sitio en preparación</h1>
<p>Este sitio aún no está abierto al público. Si te dieron la clave de revisión, escríbela para entrar.</p>
${error ? '<div class="error" role="alert">La clave no es correcta.</div>' : ""}
<form method="post" action="${RUTA_ACCESO}">
<input type="hidden" name="volver" value="${esc(destinoSeguro(volver))}">
<label for="clave">Clave de revisión</label>
<input id="clave" name="clave" type="password" autocomplete="current-password" required autofocus>
<button type="submit">Entrar</button>
</form>
<div class="urg">Urgencias: acude directamente al hospital, Av. Las Piedras S/N, Frutillar. Central: <a href="tel:+56652326900">(65) 232 6900</a> · Emergencias: <a href="tel:131">131</a>.<br>Funcionarios: <a href="/funcionarios/ingresar.html">ingresar al portal</a>.</div>
</main></body></html>`;
}
