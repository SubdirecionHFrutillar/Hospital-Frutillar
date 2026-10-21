// Token de sesión firmado con HMAC-SHA256 (Web Crypto).
// Funciona igual en las Functions (Node) y en la Edge Function (Deno).
//
// Formato: base64url(JSON payload) + "." + base64url(firma)
// Payload: { rut, nombre, rol, sv, exp }  (sv = versión de sesión del usuario)

export const COOKIE = "hf_sesion";
export const DURACION_SEG = 8 * 60 * 60; // 8 horas (un turno)

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function desdeB64url(txt) {
  const s = atob(txt.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((txt.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const claves = new Map();
async function clave(secreto) {
  if (!secreto || secreto.length < 32) {
    throw new Error("SESSION_SECRET no configurado o demasiado corto (mínimo 32 caracteres).");
  }
  if (!claves.has(secreto)) {
    claves.set(
      secreto,
      crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
    );
  }
  return claves.get(secreto);
}

export async function firmar(datos, secreto, ahora = Date.now()) {
  const payload = { ...datos, exp: Math.floor(ahora / 1000) + DURACION_SEG };
  const cuerpo = b64url(enc.encode(JSON.stringify(payload)));
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", await clave(secreto), enc.encode(cuerpo)));
  return `${cuerpo}.${b64url(firma)}`;
}

/** Devuelve el payload si la firma es válida y no ha expirado; si no, null. */
export async function verificar(token, secreto, ahora = Date.now()) {
  if (!token || typeof token !== "string") return null;
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await clave(secreto), desdeB64url(firma), enc.encode(cuerpo));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(desdeB64url(cuerpo)));
    if (typeof payload.exp !== "number" || payload.exp * 1000 < ahora) return null;
    return payload;
  } catch {
    return null;
  }
}

export function leerCookie(request, nombre = COOKIE) {
  const header = request.headers.get("cookie") || "";
  for (const parte of header.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function cookieSesion(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACION_SEG}`;
}
export function cookieBorrar() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
