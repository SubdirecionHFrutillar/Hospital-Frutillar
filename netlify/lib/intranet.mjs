// Publicaciones y archivos de la intranet, en Netlify Blobs (almacén "intranet").
//   publicaciones/<id>  → { id, titulo, categoria, area, cuerpo, fecha, autor, adjuntos[], creado, editado }
//   archivos/<id>       → binario; metadata { nombre, tipo, tamano, subidoPor, subido }
//   indice              → [ resumen de cada publicación ] (para listar rápido sin leer una por una)
import { abrirAlmacen } from "./almacen.mjs";
import { repoArchivos, esId, texto, nuevoId, MAX_ARCHIVO_MB, TIPOS_PERMITIDOS } from "./archivos.mjs";

export { esId, MAX_ARCHIVO_MB, TIPOS_PERMITIDOS };

export const CATEGORIAS = [
  "General",
  "Bienestar",
  "Capacitación",
  "Actas",
  "Casino",
  "Recursos Humanos",
  "Calidad",
  "Prevención de riesgos",
  "Dirección",
];

const almacen = () => abrirAlmacen("intranet");
const archivos = repoArchivos("intranet");
export const guardarArchivo = archivos.guardar;
export const leerArchivo = archivos.leer;
export const borrarArchivo = archivos.borrar;

// ── Publicaciones ──────────────────────────────────────────────────────────
function resumen(p) {
  const plano = p.cuerpo.replace(/[#*_>`\[\]()!-]/g, " ").replace(/\s+/g, " ").trim();
  const imagen = p.adjuntos.find((a) => a.tipo?.startsWith("image/"));
  return {
    id: p.id,
    titulo: p.titulo,
    categoria: p.categoria,
    area: p.area,
    fecha: p.fecha,
    autor: p.autor?.nombre,
    extracto: plano.slice(0, 220),
    imagen: imagen?.id || null,
    adjuntos: p.adjuntos.length,
  };
}

async function leerIndice(st) {
  return (await st.get("indice", { type: "json" })) || [];
}
async function guardarIndice(st, indice) {
  indice.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  await st.setJSON("indice", indice);
}

export async function listar({ categoria, limite = 30, desde = 0 } = {}) {
  let lista = await leerIndice(await almacen());
  if (categoria) lista = lista.filter((p) => p.categoria === categoria);
  return { total: lista.length, publicaciones: lista.slice(desde, desde + limite) };
}

export async function obtener(id) {
  if (!esId(id)) return null;
  return (await almacen()).get(`publicaciones/${id}`, { type: "json" });
}

/** Valida y normaliza los campos editables. Devuelve { error } o { datos }. */
export function validar(entrada, { esAdmin }) {
  const titulo = texto(entrada.titulo, 200);
  if (titulo.length < 3) return { error: "Ingrese un título." };
  const categoria = CATEGORIAS.includes(entrada.categoria) ? entrada.categoria : "General";
  const cuerpo = texto(entrada.cuerpo, 20000);
  const area = texto(entrada.area, 80);
  let fecha;
  if (entrada.fecha) {
    const f = new Date(entrada.fecha);
    if (isNaN(f)) return { error: "Fecha inválida." };
    if (f.getTime() > Date.now() + 86400_000) return { error: "La fecha no puede ser futura." };
    fecha = f.toISOString();
  }
  const adjuntos = Array.isArray(entrada.adjuntos) ? entrada.adjuntos.filter(esId) : [];
  if (adjuntos.length > 20) return { error: "Máximo 20 adjuntos por publicación." };
  return { datos: { titulo, categoria, cuerpo, area, fecha, adjuntos, ...(esAdmin && entrada.autorNombre ? { autorNombre: texto(entrada.autorNombre, 80) } : {}) } };
}

const describirAdjuntos = archivos.describir;

export async function crear(datos, autor) {
  const st = await almacen();
  const ahora = new Date().toISOString();
  const p = {
    id: nuevoId(),
    titulo: datos.titulo,
    categoria: datos.categoria,
    area: datos.area,
    cuerpo: datos.cuerpo,
    fecha: datos.fecha || ahora,
    autor: { rut: autor.rut, nombre: datos.autorNombre || autor.nombre },
    adjuntos: await describirAdjuntos(datos.adjuntos),
    creado: ahora,
    editado: null,
  };
  await st.setJSON(`publicaciones/${p.id}`, p);
  const indice = await leerIndice(st);
  indice.push(resumen(p));
  await guardarIndice(st, indice);
  return p;
}

export async function actualizar(p, datos) {
  const st = await almacen();
  const antes = new Set(p.adjuntos.map((a) => a.id));
  Object.assign(p, {
    titulo: datos.titulo,
    categoria: datos.categoria,
    area: datos.area,
    cuerpo: datos.cuerpo,
    fecha: datos.fecha || p.fecha,
    adjuntos: await describirAdjuntos(datos.adjuntos),
    editado: new Date().toISOString(),
  });
  if (datos.autorNombre) p.autor.nombre = datos.autorNombre;
  // Archivos quitados de la publicación se eliminan
  for (const id of antes) if (!datos.adjuntos.includes(id)) await borrarArchivo(id);
  await st.setJSON(`publicaciones/${p.id}`, p);
  const indice = (await leerIndice(st)).filter((x) => x.id !== p.id);
  indice.push(resumen(p));
  await guardarIndice(st, indice);
  return p;
}

export async function eliminar(p) {
  const st = await almacen();
  for (const a of p.adjuntos) await borrarArchivo(a.id);
  await st.delete(`publicaciones/${p.id}`);
  await guardarIndice(st, (await leerIndice(st)).filter((x) => x.id !== p.id));
}
