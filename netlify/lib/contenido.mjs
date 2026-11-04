// Contenido del sitio editado desde la intranet, en Netlify Blobs (almacén "contenido").
//   cambios   → { [ruta]: { valor, autor, editado } }   (lo que difiere del repositorio)
//   historial → [ { ruta, antes, despues, autor, fecha } ]  (los 300 más recientes primero)
//   archivos/<id> → fotos subidas (públicas)
import { abrirAlmacen } from "./almacen.mjs";
import { repoArchivos } from "./archivos.mjs";
import { campo, fotoValida } from "./contenido-campos.mjs";

const almacen = () => abrirAlmacen("contenido");
export const archivos = repoArchivos("contenido");
const MAX_HISTORIAL = 300;

async function leerCambios(st) {
  return (await st.get("cambios", { type: "json" })) || {};
}

/** { ruta: valor } de lo editado (para el sitio público). */
export async function vigentes() {
  const c = await leerCambios(await almacen());
  return Object.fromEntries(Object.entries(c).map(([r, v]) => [r, v.valor]));
}

/** Para el editor: cambios con autor y fecha, y el historial reciente. */
export async function estado({ limite = 40 } = {}) {
  const st = await almacen();
  return { cambios: await leerCambios(st), historial: ((await st.get("historial", { type: "json" })) || []).slice(0, limite) };
}

/**
 * Valida un lote { ruta: valor | null } (null = volver al texto original del sitio).
 * Devuelve { error } o { datos }.
 */
export function validar(lote) {
  if (!lote || typeof lote !== "object" || Array.isArray(lote)) return { error: "Datos inválidos." };
  const entradas = Object.entries(lote);
  if (!entradas.length) return { error: "No hay cambios para guardar." };
  if (entradas.length > 80) return { error: "Demasiados cambios a la vez." };
  const datos = {};
  for (const [ruta, valor] of entradas) {
    const def = campo(ruta);
    if (!def) return { error: `El campo "${ruta}" no se puede editar desde aquí.` };
    if (valor === null) { datos[ruta] = null; continue; }
    if (typeof valor !== "string") return { error: "Valor inválido." };
    const v = valor.replace(/\r\n/g, "\n").trim();
    if (def.tipo === "foto") {
      if (!fotoValida(v)) return { error: "La foto debe subirse desde el portal." };
    } else {
      if (v.length > def.max) return { error: `El texto supera los ${def.max} caracteres.` };
      if (def.tipo === "texto" && v.includes("\n")) return { error: "Este campo es de una sola línea." };
    }
    datos[ruta] = v;
  }
  return { datos };
}

/** Aplica un lote ya validado. Devuelve los cambios vigentes. */
export async function guardar(datos, autor) {
  const st = await almacen();
  const cambios = await leerCambios(st);
  const historial = (await st.get("historial", { type: "json" })) || [];
  const fecha = new Date().toISOString();
  for (const [ruta, valor] of Object.entries(datos)) {
    const antes = cambios[ruta]?.valor ?? null;
    if (valor === antes) continue;
    if (valor === null) delete cambios[ruta];
    else cambios[ruta] = { valor, autor: autor.nombre, editado: fecha };
    historial.unshift({ ruta, antes, despues: valor, autor: autor.nombre, fecha });
  }
  await st.setJSON("cambios", cambios);
  await st.setJSON("historial", historial.slice(0, MAX_HISTORIAL));
  return cambios;
}
