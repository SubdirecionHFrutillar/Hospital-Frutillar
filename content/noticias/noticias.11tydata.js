// Noticias antiguas en Markdown. Si la misma noticia ya existe en el Portal Funcionarios
// (misma dirección), el Markdown no se publica: manda la versión del portal.
module.exports = {
  layout: "noticia.njk",
  tags: "noticias",
  eleventyComputed: {
    permalink: (data) => {
      const usadas = new Set((data.noticiasPortal || []).map((n) => n.slug));
      return usadas.has(data.page.fileSlug) ? false : `noticias/${data.page.fileSlug}/index.html`;
    },
  },
};
