// Noticias publicadas desde el Portal Funcionarios (Netlify Blobs).
// En el build de Netlify se leen directo del almacén; si no se puede, se piden a la API pública
// del sitio ya publicado. En local (sin Netlify) devuelve una lista vacía.
module.exports = async function () {
  const normalizar = (lista) =>
    lista
      .filter((n) => n && n.slug && n.titulo)
      .map((n) => ({ ...n, url: `/noticias/${n.slug}/`, imagenUrl: n.imagen ? `/api/noticias-archivos/${n.imagen}` : "" }))
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    try {
      const { getStore } = await import("@netlify/blobs");
      const opciones = { name: "noticias", consistency: "strong" };
      if (process.env.NETLIFY_BLOBS_TOKEN) Object.assign(opciones, { siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      const st = getStore(opciones);
      const indice = (await st.get("indice", { type: "json" })) || [];
      const out = [];
      for (const r of indice) out.push(await st.get(`noticias/${r.id}`, { type: "json" }));
      console.log(`[noticias] ${out.length} noticia(s) leídas desde Netlify Blobs`);
      return normalizar(out);
    } catch (e) {
      console.warn("[noticias] No se pudo leer Netlify Blobs en el build:", e.message);
    }
  }

  const sitio = process.env.URL;
  if (sitio) {
    try {
      const r = await fetch(`${sitio}/api/noticias/publicas`);
      if (r.ok) {
        const { noticias } = await r.json();
        console.log(`[noticias] ${noticias.length} noticia(s) leídas desde ${sitio}`);
        return normalizar(noticias);
      }
      console.warn(`[noticias] ${sitio}/api/noticias/publicas respondió ${r.status}`);
    } catch (e) {
      console.warn("[noticias] No se pudo consultar la API pública:", e.message);
    }
  }
  return [];
};
