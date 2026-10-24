// Cuentas de funcionarios guardadas en Netlify Blobs (almacén "funcionarios").
// No requiere base de datos externa. Claves:
//   usuarios/<rut>   → { rut, nombre, cargo, rol, activo, hash, sv, debeCambiarClave, ... }
//   intentos/<rut>   → { fallos, bloqueadoHasta }
import { scrypt as scryptCb, randomBytes, timingSafeEqual, randomInt } from "node:crypto";
import { promisify } from "node:util";
import { abrirAlmacen, _reiniciarAlmacenesPrueba } from "./almacen.mjs";

const scrypt = promisify(scryptCb);
const N = 16384, R = 8, P = 1, LARGO = 64;

export const ROLES = ["funcionario", "editor", "comunicaciones", "admin"];
/** Roles que pueden publicar en la intranet. */
export const PUEDEN_PUBLICAR = ["editor", "comunicaciones", "admin"];
/** Roles que pueden publicar noticias en el sitio web público. */
export const PUEDEN_PUBLICAR_SITIO = ["comunicaciones", "admin"];
export const MAX_FALLOS = 5;
export const BLOQUEO_MIN = 15;
/** Horas que dura una clave inicial o temporal antes de vencer si no se ha cambiado. */
export const VIGENCIA_TEMPORAL_HORAS = 72;

/** Fecha ISO en que vence una clave temporal creada ahora. */
export function venceTemporal(ahora = Date.now()) {
  return new Date(ahora + VIGENCIA_TEMPORAL_HORAS * 3600_000).toISOString();
}

/** ¿La clave temporal de este usuario ya venció? (cuentas antiguas sin fecha no vencen) */
export function temporalVencida(u, ahora = Date.now()) {
  return !!(u.debeCambiarClave && u.claveTemporalVence && Date.parse(u.claveTemporalVence) < ahora);
}

// ── Almacén ────────────────────────────────────────────────────────────────
export const almacen = () => abrirAlmacen("funcionarios");
export const _reiniciarAlmacenPrueba = _reiniciarAlmacenesPrueba;

// ── Contraseñas ────────────────────────────────────────────────────────────
export async function hashClave(clave) {
  const sal = randomBytes(16);
  const h = await scrypt(clave.normalize("NFKC"), sal, LARGO, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64")}$${h.toString("base64")}`;
}

export async function verificarClave(clave, guardado) {
  const [alg, n, r, p, sal, h] = String(guardado || "").split("$");
  if (alg !== "scrypt") return false;
  const esperado = Buffer.from(h, "base64");
  const calc = await scrypt(String(clave).normalize("NFKC"), Buffer.from(sal, "base64"), esperado.length, {
    N: Number(n), r: Number(r), p: Number(p),
  });
  return timingSafeEqual(calc, esperado);
}

// Hash ficticio para igualar tiempos cuando el RUT no existe (evita enumerar cuentas).
let hashFicticio;
export async function gastarTiempo(clave) {
  hashFicticio ??= await hashClave("clave-ficticia-para-igualar-tiempos");
  await verificarClave(clave, hashFicticio);
}

/** Reglas mínimas. Devuelve un mensaje de error o null si la clave sirve. */
export function problemaClave(clave, rut) {
  if (typeof clave !== "string" || clave.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (clave.length > 128) return "La contraseña es demasiado larga.";
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(clave) || !/\d/.test(clave)) return "La contraseña debe incluir letras y números.";
  const soloRut = rut ? rut.replace("-", "").toUpperCase() : "";
  const cuerpo = rut ? rut.split("-")[0] : "";
  const plana = clave.toUpperCase().replace(/[.\-\s]/g, "");
  if (soloRut && (plana.includes(soloRut) || plana.includes(cuerpo))) return "La contraseña no puede contener su RUT.";
  return null;
}

/** Contraseña temporal legible, sin caracteres ambiguos (0/O, 1/l/I). */
export function claveTemporal() {
  const letras = "abcdefghjkmnpqrstuvwxyz", nums = "23456789";
  const pick = (s, k) => Array.from({ length: k }, () => s[randomInt(s.length)]).join("");
  return `${pick(letras, 4)}-${pick(nums, 4)}-${pick(letras, 4)}`;
}

// ── Usuarios ───────────────────────────────────────────────────────────────
const kU = (rut) => `usuarios/${rut}`;
const kI = (rut) => `intentos/${rut}`;

export async function obtener(rut) {
  return (await almacen()).get(kU(rut), { type: "json" });
}
export async function guardar(usuario) {
  usuario.actualizado = new Date().toISOString();
  await (await almacen()).setJSON(kU(usuario.rut), usuario);
  return usuario;
}
export async function listar() {
  const st = await almacen();
  const { blobs } = await st.list({ prefix: "usuarios/" });
  const lista = await Promise.all(blobs.map((b) => st.get(b.key, { type: "json" })));
  return lista.filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
export async function eliminar(rut) {
  const st = await almacen();
  await st.delete(kU(rut));
  await st.delete(kI(rut));
}
/** Correo de contacto opcional: "" si viene vacío, null si es inválido. */
export function correoValido(v) {
  if (v === undefined || v === null || v === "") return "";
  const c = String(v).trim().toLowerCase().slice(0, 120);
  if (!c) return "";
  return /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/.test(c) ? c : null;
}
export async function hayAdministrador() {
  return (await listar()).some((u) => u.rol === "admin" && u.activo);
}

/** Datos que se pueden mostrar (nunca el hash). */
export function publico(u) {
  const { hash, ...resto } = u;
  return resto;
}

// ── Bloqueo por intentos fallidos ──────────────────────────────────────────
export async function estaBloqueado(rut, ahora = Date.now()) {
  const i = await (await almacen()).get(kI(rut), { type: "json" });
  return i?.bloqueadoHasta && i.bloqueadoHasta > ahora ? i.bloqueadoHasta : null;
}
export async function registrarFallo(rut, ahora = Date.now()) {
  const st = await almacen();
  const i = (await st.get(kI(rut), { type: "json" })) || { fallos: 0 };
  if (i.bloqueadoHasta && i.bloqueadoHasta <= ahora) i.fallos = 0;
  i.fallos += 1;
  i.bloqueadoHasta = i.fallos >= MAX_FALLOS ? ahora + BLOQUEO_MIN * 60_000 : null;
  await st.setJSON(kI(rut), i);
  return i;
}
export async function limpiarFallos(rut) {
  await (await almacen()).delete(kI(rut));
}
