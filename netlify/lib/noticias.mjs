// Noticias del sitio web público, en Netlify Blobs (almacén "noticias").
//   noticias/<id> → { id, slug, titulo, categoria, resumen, cuerpo, fecha, destacada, imagen, adjuntos[], autor, creado, editado }
//   archivos/<id> → imágenes y documentos (públicos)
//   indice        → [ resumen de cada noticia ]
// El sitio se regenera después de cada cambio (NETLIFY_BUILD_HOOK) y las páginas se generan en el build.
import { abrirAlmacen } from "./almacen.mjs";
import { repoArchivos, esId, texto, nuevoId } from "./archivos.mjs";

export const CATEGORIAS = ["Institucional", "Comunidad", "Salud", "Farmacia", "Gestión", "Acreditación", "RRHH"];

const almacen = () => abrirAlmacen("noticias");
export const archivos = repoArchivos("noticias");

export const urlArchivo = (id) => `/api/noticias-archivos/${id}`;

/** "Operativo de salud — Frutillar 2026" → "operativo-de-salud-frutillar-2026" */
export function slugDe(titulo) {
  return (
    String(titulo)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70)
      .replace(/-+$/g, "") || "noticia"
  );
}
const slugValido = (s) => typeof s === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(s);

function resumenIndice(n) {
  return {
    id: n.id,
    slug: n.slug,
    titulo: n.titulo,
    categoria: n.categoria,
    resumen: n.resumen,
    fecha: n.fecha,
    destacada: n.destacada,
    imagen: n.imagen,
    autor: n.autor?.nombre,
  };
}

async function leerIndice(st) {
  return (await st.get("indice", { type: "json" })) || [];
}
async function guardarIndice(st, indice) {
  indice.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  await st.setJSON("indice", indice);
}

export async function listar() {
  return leerIndice(await almacen());
}

export async function obtener(id) {
  if (!esId(id)) return null;
  return (await almacen()).get(`noticias/${id}`, { type: "json" });
}

/** Todas las noticias completas (para generar el sitio). */
export async function todas() {
  const st = await almacen();
  const indice = await leerIndice(st);
  const out = [];
  for (const r of indice) {
    const n = await st.get(`noticias/${r.id}`, { type: "json" });
    if (n) out.push(n);
  }
  return out;
}

/** Valida y normaliza. Devuelve { error } o { datos }. */
export function validar(e, { esAdmin }) {
  const titulo = texto(e.titulo, 200);
  if (titulo.length < 3) return { error: "Ingrese un título." };
  const resumen = texto(e.resumen, 300);
  if (resumen.length < 10) return { error: "Escriba un resumen (aparece en el listado de noticias)." };
  const categoria = CATEGORIAS.includes(e.categoria) ? e.categoria : "Institucional";
  const cuerpo = texto(e.cuerpo, 20000);
  let fecha;
  if (e.fecha) {
    const f = new Date(e.fecha);
    if (isNaN(f)) return { error: "Fecha inválida." };
    if (f.getTime() > Date.now() + 86400_000) return { error: "La fecha no puede ser futura." };
    fecha = f.toISOString();
  }
  const adjuntos = Array.isArray(e.adjuntos) ? e.adjuntos.filter(esId) : [];
  if (adjuntos.length > 20) return { error: "Máximo 20 adjuntos por noticia." };
  const datos = { titulo, resumen, categoria, cuerpo, fecha, destacada: e.destacada === true, adjuntos };
  if (esAdmin && e.autorNombre) datos.autorNombre = texto(e.autorNombre, 80);
  if (esAdmin && e.slug !== undefined) {
    if (!slugValido(e.slug)) return { error: "Dirección (slug) inválida." };
    datos.slug = e.slug;
  }
  return { datos };
}

async function slugUnico(st, base, idPropio) {
  const usados = new Set((await leerIndice(st)).filter((x) => x.id !== idPropio).map((x) => x.slug));
  let s = base, i = 2;
  while (usados.has(s)) s = `${base}-${i++}`;
  return s;
}

export async function crear(d, autor) {
  const st = await almacen();
  const ahora = new Date().toISOString();
  const adjuntos = await archivos.describir(d.adjuntos);
  const n = {
    id: nuevoId(),
    slug: await slugUnico(st, d.slug || slugDe(d.titulo)),
    titulo: d.titulo,
    categoria: d.categoria,
    resumen: d.resumen,
    cuerpo: d.cuerpo,
    fecha: d.fecha || ahora,
    destacada: d.destacada,
    imagen: adjuntos.find((a) => a.tipo.startsWith("image/"))?.id || null,
    adjuntos,
    autor: { rut: autor.rut, nombre: d.autorNombre || autor.nombre },
    creado: ahora,
    editado: null,
  };
  await st.setJSON(`noticias/${n.id}`, n);
  const indice = await leerIndice(st);
  indice.push(resumenIndice(n));
  await guardarIndice(st, indice);
  return n;
}

export async function actualizar(n, d) {
  const st = await almacen();
  const antes = new Set(n.adjuntos.map((a) => a.id));
  const adjuntos = await archivos.describir(d.adjuntos);
  Object.assign(n, {
    titulo: d.titulo,
    categoria: d.categoria,
    resumen: d.resumen,
    cuerpo: d.cuerpo,
    fecha: d.fecha || n.fecha,
    destacada: d.destacada,
    imagen: adjuntos.find((a) => a.tipo.startsWith("image/"))?.id || null,
    adjuntos,
    editado: new Date().toISOString(),
  });
  if (d.slug) n.slug = await slugUnico(st, d.slug, n.id);
  if (d.autorNombre) n.autor.nombre = d.autorNombre;
  for (const id of antes) if (!d.adjuntos.includes(id)) await archivos.borrar(id);
  await st.setJSON(`noticias/${n.id}`, n);
  const indice = (await leerIndice(st)).filter((x) => x.id !== n.id);
  indice.push(resumenIndice(n));
  await guardarIndice(st, indice);
  return n;
}

export async function eliminar(n) {
  const st = await almacen();
  for (const a of n.adjuntos) await archivos.borrar(a.id);
  await st.delete(`noticias/${n.id}`);
  await guardarIndice(st, (await leerIndice(st)).filter((x) => x.id !== n.id));
}

/** Pide a Netlify que regenere el sitio. Devuelve true si se solicitó. */
export async function regenerarSitio(hook) {
  if (!hook) return false;
  try {
    const r = await fetch(hook, { method: "POST", body: "{}" });
    return r.ok;
  } catch (e) {
    console.error("No se pudo regenerar el sitio:", e);
    return false;
  }
}
