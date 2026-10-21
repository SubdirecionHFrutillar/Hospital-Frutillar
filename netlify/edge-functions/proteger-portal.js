// Protege las páginas del Portal de Funcionarios: sin sesión válida → página de ingreso.
// Corre en el borde (antes de servir el HTML estático), así el contenido nunca se entrega sin sesión.
import { verificar, leerCookie } from "../lib/sesion.mjs";

const SOLO_ADMIN = ["/funcionarios/administrar.html", "/funcionarios/administrar"];

export default async (request, context) => {
  const url = new URL(request.url);
  const sesion = await verificar(leerCookie(request), Netlify.env.get("SESSION_SECRET")).catch(() => null);

  if (!sesion) {
    const destino = new URL("/funcionarios/ingresar.html", url);
    destino.searchParams.set("volver", url.pathname + url.search);
    return Response.redirect(destino, 302);
  }
  if (SOLO_ADMIN.includes(url.pathname) && sesion.rol !== "admin") {
    return Response.redirect(new URL("/funcionarios/", url), 302);
  }

  const res = await context.next();
  res.headers.set("cache-control", "private, no-store");
  return res;
};

export const config = {
  path: ["/funcionarios", "/funcionarios/*"],
  excludedPath: ["/funcionarios/ingresar.html", "/funcionarios/configuracion-inicial.html"],
};
