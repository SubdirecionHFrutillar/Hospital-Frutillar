const markdownIt = require("markdown-it");
const md = markdownIt({ html: true, breaks: true, linkify: true });
const mdSeguro = markdownIt({ html: false, breaks: true, linkify: true });

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Contenido editado desde la intranet ("Contenido del sitio"), para dejarlo también en el HTML de cada build.
// En vivo lo aplica assets/js/sitio-vivo.js; aquí solo se adelanta para buscadores y visitas sin JavaScript.
let contenidoBuild = {};
async function cargarContenido() {
  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    try {
      const { getStore } = await import("@netlify/blobs");
      const opciones = { name: "contenido", consistency: "strong" };
      if (process.env.NETLIFY_BLOBS_TOKEN) Object.assign(opciones, { siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      const c = (await getStore(opciones).get("cambios", { type: "json" })) || {};
      console.log(`[contenido] ${Object.keys(c).length} campo(s) editado(s) desde la intranet`);
      return Object.fromEntries(Object.entries(c).map(([r, v]) => [r, v.valor]));
    } catch (e) {
      console.warn("[contenido] No se pudo leer Netlify Blobs en el build:", e.message);
    }
  }
  if (process.env.URL) {
    try {
      const r = await fetch(`${process.env.URL}/api/sitio-vivo`);
      if (r.ok) return (await r.json()).contenido || {};
    } catch (e) {
      console.warn("[contenido] No se pudo consultar la API pública:", e.message);
    }
  }
  return {};
}
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

module.exports = function (eleventyConfig) {
  // Archivos estáticos
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("assets/js");
  eleventyConfig.addPassthroughCopy("robots.txt");
  // Validación de RUT: el mismo módulo que usan las funciones del servidor
  eleventyConfig.addPassthroughCopy({ "netlify/lib/rut.mjs": "assets/js/rut.mjs" });

  // El CSS lo genera Tailwind (npm run build:css); Eleventy solo vigila cambios.
  eleventyConfig.addWatchTarget("./assets/css/");

  eleventyConfig.on("eleventy.before", async () => { contenidoBuild = await cargarContenido(); });

  // Valor vigente de un campo editable: lo editado en la intranet o, si no, el del repositorio.
  const valorCampo = (ruta, base) => (Object.prototype.hasOwnProperty.call(contenidoBuild, ruta) ? contenidoBuild[ruta] : base ?? "");
  eleventyConfig.addFilter("cv", (base, ruta) => valorCampo(ruta, base));
  // {% campo ruta, base, "p", "clases" %} → <p data-c="ruta" class="clases">valor</p>
  // data-c-base guarda el texto del repositorio cuando el build aplicó un cambio, para poder volver a él en vivo.
  const campoHTML = (ruta, base, tag = "span", clases = "") => {
    const valor = valorCampo(ruta, base);
    const conBase = valor !== (base ?? "") ? ` data-c-base="${esc(base ?? "")}"` : "";
    return `<${tag} data-c="${esc(ruta)}"${clases ? ` class="${esc(clases)}"` : ""}${conBase}>${esc(valor)}</${tag}>`;
  };
  eleventyConfig.addShortcode("campo", campoHTML);
  // Lo mismo como filtro, para usarlo dentro de macros: {{ base | comoCampo(ruta, "strong", "clases") | safe }}
  eleventyConfig.addFilter("comoCampo", (base, ruta, tag, clases) => campoHTML(ruta, base, tag, clases));
  // {% campoMd ruta, base, "clases" %} → <div data-c="ruta" data-c-md="texto" class="clases">markdown renderizado</div>
  // data-c-md guarda el texto fuente para que el navegador sepa si cambió. Lo editado en la intranet
  // se renderiza sin HTML crudo (mdSeguro); lo del repositorio, igual que antes.
  eleventyConfig.addShortcode("campoMd", (ruta, base, clases = "") => {
    const valor = valorCampo(ruta, base);
    const editado = valor !== (base ?? "");
    const html = valor ? (editado ? mdSeguro : md).render(valor) : "";
    return `<div data-c="${esc(ruta)}" data-c-md="${esc(valor)}"${clases ? ` class="${esc(clases)}"` : ""}${editado ? ` data-c-base="${esc(base ?? "")}"` : ""}>${html}</div>`;
  });

  // Markdown de los campos editados en el CMS
  eleventyConfig.addFilter("markdown", (texto) => (texto ? md.render(texto) : ""));

  // Fechas
  eleventyConfig.addFilter("fechaES", (fecha) => {
    const d = new Date(fecha);
    return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter("fechaISO", (fecha) => new Date(fecha).toISOString().slice(0, 10));

  // Imagen redimensionada por el Image CDN de Netlify (WebP/AVIF según el navegador).
  // Solo para imágenes propias del sitio; las externas se dejan tal cual.
  eleventyConfig.addFilter("imagenCdn", (url, ancho = 1200) => {
    if (typeof url !== "string" || !url.startsWith("/")) return url;
    return `/.netlify/images?url=${encodeURIComponent(url)}&w=${ancho}&q=75`;
  });

  // Mes actual en Chile (1–12), para campañas estacionales.
  eleventyConfig.addFilter("mesActual", () => Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }).slice(5, 7)));

  // Años cumplidos desde una fecha (AAAA-MM-DD) a la fecha del build, en hora de Chile.
  eleventyConfig.addFilter("aniosDesde", (desde) => {
    const [a, m, d] = String(desde).split("-").map(Number);
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }).split("-").map(Number);
    return hoy[0] - a - (hoy[1] < m || (hoy[1] === m && hoy[2] < d) ? 1 : 0);
  });

  // ¿Corresponde este ítem del menú a la página actual?
  eleventyConfig.addFilter("navActivo", (item, url) => {
    if (typeof url !== "string") return false;
    if (item.url === "/") return url === "/";
    if (url === item.url) return true;
    if ((item.match || []).some((m) => url.startsWith(m))) return true;
    return (item.items || []).some((s) => s.url.split("#")[0] === url);
  });

  // Primer elemento de una lista cuyo campo `clave` vale `valor`
  eleventyConfig.addFilter("buscar", (lista, clave, valor) => (lista || []).find((x) => x[clave] === valor));

  // Noticias: archivos Markdown antiguos (content/noticias) + noticias del Portal Funcionarios.
  // Si una noticia del portal usa la misma dirección que un Markdown, gana la del portal.
  const todasLasNoticias = (api) => {
    const portal = (api.getAll()[0]?.data?.noticiasPortal || []).map((n) => ({
      url: n.url,
      date: new Date(n.fecha),
      data: { title: n.titulo, categoria: n.categoria, resumen: n.resumen, imagen: n.imagenUrl, destacada: n.destacada },
    }));
    const usadas = new Set(portal.map((n) => n.url));
    const markdown = api.getFilteredByTag("noticias").filter((n) => n.url && !usadas.has(n.url));
    return [...portal, ...markdown].sort((a, b) => b.date - a.date);
  };
  eleventyConfig.addCollection("noticias", todasLasNoticias);

  // Noticias en Markdown (las del portal llegan en vivo desde /api/sitio-vivo), como JSON
  // para que assets/js/sitio-vivo.js las mezcle con las del portal. "<" escapado para ir dentro de <script>.
  eleventyConfig.addFilter("noticiasEstaticasJSON", (lista) =>
    JSON.stringify(
      (lista || [])
        .filter((n) => n.inputPath)
        .map((n) => ({
          url: n.url,
          titulo: n.data.title,
          categoria: n.data.categoria,
          resumen: n.data.resumen,
          fecha: n.date.toISOString().slice(0, 10),
          destacada: n.data.destacada === true,
          imagen: n.data.imagen || "",
        }))
    ).replace(/</g, "\\u003c")
  );

  // Portada: destacadas primero, luego por fecha; máximo 5
  eleventyConfig.addCollection("noticiasPortada", (api) =>
    todasLasNoticias(api)
      .sort((a, b) => (b.data.destacada === true) - (a.data.destacada === true) || b.date - a.date)
      .slice(0, 5)
  );

  return {
    dir: { input: ".", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
