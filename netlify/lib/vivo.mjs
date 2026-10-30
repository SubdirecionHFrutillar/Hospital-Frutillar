// Contenido "en vivo" del sitio público (noticias y avisos publicados desde el portal).
// Ya no se regenera el sitio tras cada cambio: las páginas de noticias las arma una función y
// los listados/avisos se actualizan en el navegador. Todo pasa por la caché de Netlify (CDN),
// que se purga apenas alguien publica, edita o elimina; así casi ninguna visita ejecuta funciones.
import MarkdownIt from "markdown-it";
import { abrirAlmacen } from "./almacen.mjs";

export const ETIQUETA_CACHE = "sitio-vivo";

/** Cabeceras para respuestas públicas que pueden quedar en la caché del CDN. */
export const CACHE_PUBLICA = {
  // El navegador siempre pregunta; el CDN guarda 5 minutos y, vencidos, sirve la copia mientras renueva.
  "cache-control": "public, max-age=0, must-revalidate",
  "netlify-cdn-cache-control": "public, durable, s-maxage=300, stale-while-revalidate=604800",
  "netlify-cache-tag": ETIQUETA_CACHE,
};

/** Borra de la caché del CDN todo el contenido en vivo. No falla si no se puede. */
// Igual que purgeCache() de @netlify/functions, sin agregar esa dependencia: Netlify inyecta
// NETLIFY_PURGE_API_TOKEN y SITE_ID en el entorno de las funciones.
export async function purgarSitioVivo() {
  if (process.env.FUNCIONARIOS_STORE === "memoria") return false;
  const leer = (k) => globalThis.Netlify?.env?.get(k) ?? process.env[k];
  const token = leer("NETLIFY_PURGE_API_TOKEN");
  const sitio = leer("SITE_ID");
  if (!token || !sitio) {
    console.warn("Sin NETLIFY_PURGE_API_TOKEN/SITE_ID: los cambios se verán al vencer la caché (5 minutos).");
    return false;
  }
  try {
    const r = await fetch("https://api.netlify.com/api/v1/purge", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf8", authorization: `Bearer ${token}` },
      body: JSON.stringify({ site_id: sitio, cache_tags: [ETIQUETA_CACHE] }),
    });
    if (!r.ok) throw new Error(`respuesta ${r.status}`);
    return true;
  } catch (e) {
    console.error("No se pudo purgar la caché del sitio:", e.message);
    return false;
  }
}

// ---------- Utilidades de HTML ----------

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Markdown de las noticias: sin HTML crudo (lo escriben funcionarios, se muestra a todo público).
const md = new MarkdownIt({ html: false, breaks: true, linkify: true });
export const markdown = (t) => (t ? md.render(String(t)) : "");

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10-30T22:10:00Z" → "30 de octubre de 2026" (hora de Chile). Una fecha AAAA-MM-DD se toma tal cual. */
export function fechaES(fecha) {
  const s = String(fecha || "");
  let a, m, d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) [a, m, d] = s.split("-").map(Number);
  else {
    const f = new Date(s);
    if (isNaN(f)) return "";
    [a, m, d] = f.toLocaleDateString("en-CA", { timeZone: "America/Santiago" }).split("-").map(Number);
  }
  return `${d} de ${MESES[m - 1]} de ${a}`;
}
export const fechaISO = (fecha) => {
  const s = String(fecha || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const f = new Date(s);
  return isNaN(f) ? "" : f.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
};

export const urlArchivo = (id) => `/api/noticias-archivos/${id}`;
export const imagenCdn = (url, ancho) => `/.netlify/images?url=${encodeURIComponent(url)}&w=${ancho}&q=75`;

// ---------- Página de una noticia ----------

/** Cuerpo de la página de una noticia (lo que va dentro de <main>), igual al diseño de noticia.njk. */
export function articuloHTML(n) {
  const img = n.imagen ? urlArchivo(n.imagen) : "";
  const adjuntos = (n.adjuntos || []).filter((a) => a.id !== n.imagen);
  const hero = img
    ? `<img src="${esc(imagenCdn(img, 1400))}" onerror="this.onerror=null;this.src='${esc(img)}'" alt="" fetchpriority="high" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>`
    : `<div class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span class="material-symbols-outlined text-white/10 text-[120px] leading-none">article</span>
        </div>`;
  const lista = adjuntos.length
    ? `<ul class="mt-6 flex flex-col gap-2 border-t border-gray-100 pt-5">${adjuntos
        .map((a) =>
          a.tipo?.startsWith("image/")
            ? `<li><img src="${esc(urlArchivo(a.id))}" alt="" loading="lazy" class="w-full rounded-custom border border-gray-200"></li>`
            : `<li><a href="${esc(urlArchivo(a.id))}" target="_blank" rel="noopener" class="flex items-center gap-3 border border-gray-200 rounded-custom px-4 py-3 hover:bg-primary-bg hover:border-primary-pale">
            <span aria-hidden="true" class="material-symbols-outlined text-red-600 text-2xl">${a.tipo === "application/pdf" ? "picture_as_pdf" : "description"}</span>
            <span class="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">${esc(a.nombre)}</span>
            <span aria-hidden="true" class="material-symbols-outlined text-primary text-lg">open_in_new</span>
          </a></li>`
        )
        .join("")}</ul>`
    : "";

  return `<div class="container mx-auto px-4 py-10 max-w-3xl">
  <nav class="text-xs text-gray-500 mb-6 flex items-center gap-1.5" aria-label="Ruta de navegación">
    <a href="/" class="hover:text-primary transition-colors">Inicio</a>
    <span aria-hidden="true" class="material-symbols-outlined text-xs">chevron_right</span>
    <a href="/noticias.html" class="hover:text-primary transition-colors">Noticias</a>
    <span aria-hidden="true" class="material-symbols-outlined text-xs">chevron_right</span>
    <span class="text-gray-700 font-medium truncate max-w-[200px]" aria-current="page">${esc(n.titulo)}</span>
  </nav>
  <article class="bg-white rounded-custom shadow-md overflow-hidden">
    <div class="bg-noticia relative ${img ? "h-64 md:h-80" : "h-48"} overflow-hidden">
      ${hero}
      <span class="absolute top-4 left-4 px-2.5 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded shadow-md">${esc(n.categoria)}</span>
      <div class="absolute bottom-4 left-4 flex items-center gap-1.5 text-white/80 text-xs">
        <span aria-hidden="true" class="material-symbols-outlined text-sm">calendar_today</span>
        <time datetime="${esc(fechaISO(n.fecha))}">${esc(fechaES(n.fecha))}</time>
      </div>
    </div>
    <div class="p-6 md:p-8">
      <h2 class="text-2xl md:text-3xl font-bold text-gray-900 leading-snug mb-4">${esc(n.titulo)}</h2>
      <p class="text-base text-gray-500 leading-relaxed border-l-4 border-primary-pale pl-4 mb-6">${esc(n.resumen)}</p>
      <div class="prose max-w-none text-gray-700 leading-relaxed">${markdown(n.cuerpo)}</div>
      ${lista}
    </div>
  </article>
  <a href="/noticias.html" class="mt-8 inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
    <span aria-hidden="true" class="material-symbols-outlined text-base">arrow_back</span>Volver a Noticias
  </a>
</div>`;
}

// Marcas que deja noticias-plantilla.njk en el HTML para que la función las reemplace.
export const MARCAS = {
  titulo: "__NOTICIA_TITULO__",
  resumen: "__NOTICIA_RESUMEN__",
  imagen: "/__NOTICIA_IMAGEN__",
  url: "/noticias/plantilla.html",
  cuerpo: "<!--__NOTICIA_CUERPO__-->",
};

/** Rellena la plantilla (HTML completo del sitio con las marcas) con una noticia. */
export function paginaNoticia(plantilla, n) {
  const imagen = n.imagen ? urlArchivo(n.imagen) : "/img/hero-hospital.jpg";
  // Primero el cuerpo (su contenido no debe pasar por los demás reemplazos)
  const [antes, despues] = plantilla.split(MARCAS.cuerpo);
  const rellenar = (t) =>
    t
      .replaceAll(MARCAS.titulo, esc(n.titulo))
      .replaceAll(MARCAS.resumen, esc(n.resumen))
      .replaceAll(MARCAS.imagen, esc(imagen))
      .replaceAll(MARCAS.url, `/noticias/${esc(n.slug)}/`);
  return rellenar(antes) + articuloHTML(n) + rellenar(despues ?? "");
}

// ---------- Datos públicos ----------

/** Resumen público de las noticias del portal, más recientes primero. */
export async function noticiasPublicas() {
  const indice = (await (await abrirAlmacen("noticias")).get("indice", { type: "json" })) || [];
  return indice.map((n) => ({
    url: `/noticias/${n.slug}/`,
    titulo: n.titulo,
    categoria: n.categoria,
    resumen: n.resumen,
    fecha: n.fecha,
    destacada: n.destacada === true,
    imagen: n.imagen ? urlArchivo(n.imagen) : "",
  }));
}
