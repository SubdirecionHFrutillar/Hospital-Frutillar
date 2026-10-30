// Avisos breves del hospital (franja en el sitio público), en Netlify Blobs (almacén "avisos", clave "lista").
//   { id, texto, tipo: "info" | "importante", url, hasta (AAAA-MM-DD, opcional), creado, autor }
// Se muestran en vivo (sin regenerar el sitio); los vencidos se ocultan en el navegador.
import { abrirAlmacen } from "./almacen.mjs";
import { nuevoId, esId, texto } from "./archivos.mjs";

export const TIPOS = ["info", "importante"];
export const MAX_AVISOS = 5;
const almacen = () => abrirAlmacen("avisos");

/** Fecha de hoy en Chile (AAAA-MM-DD). */
export const hoyChile = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
export const vigente = (a, hoy = hoyChile()) => !a.hasta || a.hasta >= hoy;

export async function listar() {
  return (await (await almacen()).get("lista", { type: "json" })) || [];
}
export async function vigentes() {
  const hoy = hoyChile();
  return (await listar()).filter((a) => vigente(a, hoy));
}

export function validar(d) {
  if (!d || typeof d !== "object") return { error: "Datos inválidos." };
  const t = texto(d.texto, 220).replace(/\s+/g, " ");
  if (t.length < 5) return { error: "Escriba el aviso (mínimo 5 caracteres)." };
  const tipo = TIPOS.includes(d.tipo) ? d.tipo : "info";
  let url = texto(d.url, 300);
  if (url && !/^(https:\/\/|\/)[^\s<>"]*$/.test(url)) return { error: "El enlace debe empezar con https:// o con / (página del sitio)." };
  const hasta = texto(d.hasta, 10);
  if (hasta && !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return { error: "Fecha de término inválida." };
  if (hasta && hasta < hoyChile()) return { error: "La fecha de término ya pasó." };
  return { datos: { texto: t, tipo, url, hasta } };
}

export async function crear(datos, autor) {
  const st = await almacen();
  const lista = (await listar()).filter((a) => vigente(a));
  if (lista.length >= MAX_AVISOS) return { error: `Máximo ${MAX_AVISOS} avisos a la vez. Elimine uno antes de agregar otro.` };
  const aviso = { id: nuevoId(), ...datos, creado: new Date().toISOString(), autor: autor.nombre };
  lista.unshift(aviso);
  await st.setJSON("lista", lista);
  return { aviso };
}

export async function eliminar(id) {
  if (!esId(id)) return false;
  const st = await almacen();
  const lista = await listar();
  const resto = lista.filter((a) => a.id !== id);
  if (resto.length === lista.length) return false;
  await st.setJSON("lista", resto);
  return true;
}
