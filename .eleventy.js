const markdownIt = require("markdown-it");
const md = markdownIt({ html: true, breaks: true, linkify: true });

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

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

  // Markdown de los campos editados en el CMS
  eleventyConfig.addFilter("markdown", (texto) => (texto ? md.render(texto) : ""));

  // Fechas
  eleventyConfig.addFilter("fechaES", (fecha) => {
    const d = new Date(fecha);
    return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter("fechaISO", (fecha) => new Date(fecha).toISOString().slice(0, 10));

  // ¿Corresponde este ítem del menú a la página actual?
  eleventyConfig.addFilter("navActivo", (item, url) => {
    if (item.url === "/") return url === "/";
    if (url === item.url) return true;
    if ((item.match || []).some((m) => url.startsWith(m))) return true;
    return (item.items || []).some((s) => s.url.split("#")[0] === url);
  });

  // Primer elemento de una lista cuyo campo `clave` vale `valor`
  eleventyConfig.addFilter("buscar", (lista, clave, valor) => (lista || []).find((x) => x[clave] === valor));

  // Noticias: más recientes primero
  eleventyConfig.addCollection("noticias", (api) =>
    api.getFilteredByTag("noticias").sort((a, b) => b.date - a.date)
  );

  // Portada: destacadas primero, luego por fecha; máximo 5
  eleventyConfig.addCollection("noticiasPortada", (api) =>
    api
      .getFilteredByTag("noticias")
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
