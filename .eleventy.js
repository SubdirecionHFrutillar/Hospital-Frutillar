module.exports = function (eleventyConfig) {
  // Static assets
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("admin");

  // Passthrough all HTML files that are NOT replaced by .njk templates
  const staticPages = [
    "servicios.html", "horarios.html", "contacto.html", "quienes-somos.html",
    "aranceles.html", "carta-derechos.html", "copago-cero.html", "faq.html",
    "ley-ricarte-soto.html", "transparencia.html", "trabaja-con-nosotros.html",
    "404.html"
  ];
  staticPages.forEach(f => eleventyConfig.addPassthroughCopy(f));

  // Date filter in Spanish
  const MESES = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"
  ];
  eleventyConfig.addFilter("fechaES", function (date) {
    const d = new Date(date);
    return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  });

  // Noticias collection, ordered newest first
  eleventyConfig.addCollection("noticias", function (api) {
    return api.getFilteredByTag("noticias").sort((a, b) => b.date - a.date);
  });

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
