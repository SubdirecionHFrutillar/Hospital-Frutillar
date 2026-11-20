// Sitio con clave: el sitio público solo se entrega con la clave de revisión (SITIO_CLAVE) o con una
// sesión del Portal de Funcionarios. El portal, las API y los archivos de estilo quedan fuera para que el
// ingreso de funcionarios siga funcionando. Para lanzar el sitio, se borra este archivo (un deploy).
import { verificar, leerCookie } from "../lib/sesion.mjs";
import {
  COOKIE_ACCESO, RUTA_ACCESO, cookieValida, claveCorrecta, cookieAcceso, valorAcceso, destinoSeguro, paginaAcceso,
} from "../lib/acceso-sitio.mjs";

const SIN_CACHE = { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };

export default async (request, context) => {
  const url = new URL(request.url);
  const claveSitio = Netlify.env.get("SITIO_CLAVE");
  const secreto = Netlify.env.get("SESSION_SECRET");

  // Envío del formulario de la clave
  if (url.pathname === RUTA_ACCESO) {
    if (request.method !== "POST") return Response.redirect(new URL("/", url), 302);
    const datos = await request.formData().catch(() => null);
    const volver = destinoSeguro(datos?.get("volver"));
    if (datos && (await claveCorrecta(String(datos.get("clave") || ""), claveSitio, secreto))) {
      return new Response(null, {
        status: 303,
        headers: { location: new URL(volver, url).toString(), "set-cookie": cookieAcceso(await valorAcceso(claveSitio, secreto)), "cache-control": "no-store" },
      });
    }
    await new Promise((r) => setTimeout(r, 800)); // frena los intentos repetidos
    return new Response(paginaAcceso({ volver, error: true }), { status: 401, headers: SIN_CACHE });
  }

  const conClave = await cookieValida(leerCookie(request, COOKIE_ACCESO), claveSitio, secreto).catch(() => false);
  const conSesion = !conClave && !!(await verificar(leerCookie(request), secreto).catch(() => null));
  if (!conClave && !conSesion) {
    const metodoLectura = request.method === "GET" || request.method === "HEAD";
    return new Response(metodoLectura ? paginaAcceso({ volver: url.pathname + url.search }) : "", { status: 401, headers: SIN_CACHE });
  }

  const res = await context.next();
  res.headers.set("x-robots-tag", "noindex, nofollow");
  // Que la CDN o el navegador no entreguen después una copia a quien no tiene la clave
  if ((res.headers.get("content-type") || "").includes("text/html")) res.headers.set("cache-control", "private, no-store");
  return res;
};

export const config = {
  path: "/*",
  excludedPath: [
    "/funcionarios", "/funcionarios/*", // el portal tiene su propio ingreso
    "/api/*", "/.netlify/*",            // funciones y CDN de imágenes
    "/assets/*",                        // estilos, scripts y fuentes (los usa también el portal)
    "/img/logo-hospital.png", "/img/favicon-32.png", "/img/apple-touch-icon.png",
    "/robots.txt",
  ],
};
