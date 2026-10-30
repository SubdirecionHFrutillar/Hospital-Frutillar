// Página pública de una noticia publicada desde el portal: /noticias/<dirección>/
// Se arma al momento con la plantilla del sitio (noticias/plantilla.html), así una noticia nueva o
// editada se ve de inmediato sin regenerar el sitio. Las noticias antiguas en Markdown siguen siendo
// archivos estáticos y tienen prioridad (preferStatic). La respuesta queda en la caché del CDN y se
// purga cada vez que se publica, edita o elimina una noticia.
import { porSlug } from "../lib/noticias.mjs";
import { paginaNoticia, CACHE_PUBLICA } from "../lib/vivo.mjs";

// La plantilla cambia solo con cada publicación del sitio: se guarda mientras la función esté activa.
const plantillas = new Map();
async function estatico(origen, ruta) {
  const clave = origen + ruta;
  if (!plantillas.has(clave)) {
    const r = await fetch(origen + ruta);
    if (!r.ok) throw new Error(`${ruta} respondió ${r.status}`);
    plantillas.set(clave, await r.text());
  }
  return plantillas.get(clave);
}

const html = (cuerpo, status, extra = {}) =>
  new Response(cuerpo, { status, headers: { "content-type": "text/html; charset=utf-8", ...extra } });

export default async (req, ctx) => {
  const origen = new URL(req.url).origin;
  const slug = ctx?.params?.slug;
  try {
    const n = await porSlug(slug);
    if (!n) {
      const r = await fetch(origen + "/404.html");
      return html(r.ok ? await r.text() : "Noticia no encontrada", 404, { "cache-control": "public, max-age=60" });
    }
    if (!new URL(req.url).pathname.endsWith("/")) {
      return new Response(null, { status: 301, headers: { location: `/noticias/${n.slug}/` } });
    }
    return html(paginaNoticia(await estatico(origen, "/noticias/plantilla.html"), n), 200, CACHE_PUBLICA);
  } catch (e) {
    console.error(e);
    return html("No se pudo cargar la noticia. Intente nuevamente en unos minutos.", 500, { "cache-control": "no-store" });
  }
};

export const config = {
  path: ["/noticias/:slug", "/noticias/:slug/"],
  preferStatic: true,
};
