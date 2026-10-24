// Avisos del hospital publicados desde el Portal Funcionarios (Netlify Blobs, almacén "avisos").
// Igual que las noticias: en el build se leen del almacén o, si no se puede, de la API pública.
module.exports = async function () {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const vigentes = (lista) => (lista || []).filter((a) => a && a.texto && (!a.hasta || a.hasta >= hoy));

  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) {
    try {
      const { getStore } = await import("@netlify/blobs");
      const opciones = { name: "avisos", consistency: "strong" };
      if (process.env.NETLIFY_BLOBS_TOKEN) Object.assign(opciones, { siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      const lista = vigentes(await getStore(opciones).get("lista", { type: "json" }));
      console.log(`[avisos] ${lista.length} aviso(s) vigente(s)`);
      return lista;
    } catch (e) {
      console.warn("[avisos] No se pudo leer Netlify Blobs en el build:", e.message);
    }
  }
  if (process.env.URL) {
    try {
      const r = await fetch(`${process.env.URL}/api/avisos/vigentes`);
      if (r.ok) return vigentes((await r.json()).avisos);
    } catch (e) {
      console.warn("[avisos] No se pudo consultar la API pública:", e.message);
    }
  }
  return [];
};
