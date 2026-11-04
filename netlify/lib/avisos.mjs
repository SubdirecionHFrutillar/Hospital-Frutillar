// Avisos breves del hospital (franja bajo el menú), en Netlify Blobs (almacén "avisos", clave "lista").
//   { id, texto, tipo: "info" | "importante", destino: "publico" | "intranet" | "ambos", url, hasta (AAAA-MM-DD, opcional), creado, autor }
// destino: dónde se muestra. "intranet" solo lo ven funcionarios con sesión (nunca sale por las API públicas).
// Los avisos antiguos sin destino son del sitio público.
// Se muestran en vivo (sin regenerar el sitio); los vencidos se ocultan en el navegador.
import { abrirAlmacen } from "./almacen.mjs";
import { nuevoId, esId, texto } from "./archivos.mjs";

export const TIPOS = ["info", "importante"];
export const DESTINOS = ["publico", "intranet", "ambos"];
export const MAX_AVISOS = 5; // por lugar: 5 en el sitio público y 5 en la intranet
export const destinoDe = (a) => (DESTINOS.includes(a?.destino) ? a.destino : "publico");
/** ¿El aviso se muestra en ese lugar ("publico" o "intranet")? */
export const seMuestraEn = (a, lugar) => destinoDe(a) === "ambos" || destinoDe(a) === lugar;
const almacen = () => abrirAlmacen("avisos");

/** Fecha de hoy en Chile (AAAA-MM-DD). */
export const hoyChile = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
export const vigente = (a, hoy = hoyChile()) => !a.hasta || a.hasta >= hoy;

export async function listar() {
  return (await (await almacen()).get("lista", { type: "json" })) || [];
}
/** Avisos vigentes de un lugar (por defecto, el sitio público). */
export async function vigentes(lugar = "publico") {
  const hoy = hoyChile();
  return (await listar()).filter((a) => vigente(a, hoy) && seMuestraEn(a, lugar));
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
  const destino = DESTINOS.includes(d.destino) ? d.destino : "publico";
  return { datos: { texto: t, tipo, destino, url, hasta } };
}

export async function crear(datos, autor) {
  const st = await almacen();
  const lista = (await listar()).filter((a) => vigente(a));
  for (const [lugar, nombre] of [["publico", "el sitio público"], ["intranet", "la intranet"]]) {
    if (seMuestraEn(datos, lugar) && lista.filter((a) => seMuestraEn(a, lugar)).length >= MAX_AVISOS)
      return { error: `Máximo ${MAX_AVISOS} avisos a la vez en ${nombre}. Elimine uno antes de agregar otro.` };
  }
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
