const markdownIt = require("markdown-it");
const md = new markdownIt({ html: true, breaks: true });

module.exports = function (eleventyConfig) {
  // Static assets
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("admin");

  eleventyConfig.addPassthroughCopy("404.html");
  eleventyConfig.addPassthroughCopy("robots.txt");

  // Markdown filter for rendering data fields
  eleventyConfig.addFilter("markdown", content => content ? md.render(content) : "");

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
