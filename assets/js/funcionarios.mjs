// Portal Funcionarios — lógica del navegador.
// rut.mjs es el mismo archivo que usan las funciones del servidor (se copia en el build).
import { limpiarRut, normalizarRut, formatearRut } from "/assets/js/rut.mjs";

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

async function api(ruta, { metodo = "GET", datos } = {}) {
  const r = await fetch(ruta, {
    method: metodo,
    credentials: "same-origin",
    headers: datos ? { "content-type": "application/json" } : {},
    body: datos ? JSON.stringify(datos) : undefined,
  });
  let cuerpo = {};
  try { cuerpo = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error(cuerpo.error || "No fue posible completar la acción."), { status: r.status });
  return cuerpo;
}

function mensaje(el, texto, tipo = "error") {
  el.textContent = texto;
  el.classList.remove("hidden", "bg-red-50", "text-red-700", "border-red-200", "bg-green-50", "text-green-700", "border-green-200");
  el.classList.add("border", ...(tipo === "ok" ? ["bg-green-50", "text-green-700", "border-green-200"] : ["bg-red-50", "text-red-700", "border-red-200"]));
}

function irAlIngreso() {
  location.href = "/funcionarios/ingresar.html?volver=" + encodeURIComponent(location.pathname);
}

/** Usuario con sesión; si la sesión ya no es válida, vuelve al ingreso. */
// Encabezado del portal: nombre, cargo y opciones según el rol
function pintarCabecera(u) {
  const nombre = $('[data-cab="nombre"]');
  if (nombre) nombre.textContent = u.nombre;
  const cargo = $('[data-cab="cargo"]');
  if (cargo) cargo.textContent = u.cargo || formatearRut(u.rut);
  const foto = $('[data-cab="foto"]');
  if (foto) foto.replaceChildren(avatar(u, "w-9 h-9 text-xs ring-2 ring-white/25", "bg-white/15 text-white"));
  $$("[data-sesion]").forEach((x) => { x.classList.remove("hidden"); if (x.tagName === "DIV") x.classList.add("flex"); });
  if (u.rol === "admin") $$("[data-solo-admin]").forEach((x) => x.classList.remove("hidden"));
  if (PUBLICA_INTRANET.includes(u.rol)) $$("[data-solo-editor]").forEach((x) => x.classList.remove("hidden"));
  if (PUBLICA_SITIO.includes(u.rol)) $$("[data-solo-comunicaciones]").forEach((x) => x.classList.remove("hidden"));
}

// Franja de avisos de la intranet (bajo el encabezado del portal). El texto va siempre como texto.
async function pintarAvisosIntranet() {
  const caja = $("[data-avisos-intranet]");
  if (!caja) return;
  try {
    const { avisos } = await api("/api/avisos/intranet");
    caja.replaceChildren(
      ...avisos.map((a) => {
        const imp = a.tipo === "importante";
        const fila = el("div", `aviso aviso--${imp ? "importante" : "info"}`);
        const cont = el("div", "container mx-auto px-4 py-2.5 flex items-center gap-3 text-sm");
        const p = el("p", "flex-1 leading-snug");
        p.append(el("strong", "font-bold", imp ? "Importante: " : "Aviso: "), document.createTextNode(a.texto));
        cont.append(icono(imp ? "campaign" : "info", "text-xl flex-shrink-0"), p);
        if (a.url) {
          const ver = el("a", "font-bold underline underline-offset-2 whitespace-nowrap", "Ver más");
          ver.href = a.url;
          if (/^https?:/.test(a.url)) { ver.target = "_blank"; ver.rel = "noopener"; }
          cont.append(ver);
        }
        fila.append(cont);
        return fila;
      }),
    );
    caja.hidden = !avisos.length;
  } catch {}
}

async function usuarioActual() {
  try {
    const u = (await api("/api/auth/yo")).usuario;
    if (!u.debeCambiarClave) { pintarCabecera(u); pintarAvisosIntranet(); }
    return u;
  } catch (e) {
    if (e.status === 401) irAlIngreso();
    throw e;
  }
}

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }) : "—";

const TZ = { timeZone: "America/Santiago" };
// "Área · Autor" sin repetir cuando son iguales (p. ej. "Bienestar · Bienestar")
const firma = (...partes) => [...new Map(partes.filter(Boolean).map((x) => [x.trim().toLowerCase(), x.trim()])).values()].join(" · ");
const PUBLICA_INTRANET = ["editor", "comunicaciones", "admin"];
const PUBLICA_SITIO = ["comunicaciones", "admin"];
const DESTINOS = {
  intranet: { api: "/api/intranet/publicaciones", archivos: "/api/intranet/archivos" },
  sitio: { api: "/api/noticias", archivos: "/api/noticias-archivos" },
};
const fechaCorta = (iso) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric", ...TZ });
const fechaLarga = (iso) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", ...TZ });
const tamano = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Crea un elemento con clases y texto (siempre como texto, nunca HTML). */
function el(tag, clase = "", texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}
const icono = (nombre, clase = "") => {
  const s = el("span", `material-symbols-outlined ${clase}`, nombre);
  s.setAttribute("aria-hidden", "true");
  return s;
};

// ── Foto de perfil ─────────────────────────────────────────────────────────
const iniciales = (n) => (n || "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";
const urlFoto = (u) => (u.foto ? `/api/perfil/foto/${encodeURIComponent(u.rut)}?v=${u.foto}` : "");
/** Círculo con la foto del funcionario o, si no tiene, sus iniciales. */
function avatar(u, tam = "w-9 h-9 text-xs", color = "bg-primary-bg text-primary") {
  const conIniciales = () => {
    const s = el("span", `${tam} ${color} rounded-full inline-flex items-center justify-center font-bold flex-shrink-0 select-none`, iniciales(u.nombre));
    s.setAttribute("aria-hidden", "true");
    return s;
  };
  if (!u.foto) return conIniciales();
  const img = el("img", `${tam} rounded-full object-cover bg-gray-100 flex-shrink-0`);
  img.src = urlFoto(u);
  img.alt = "";
  img.onerror = () => img.replaceWith(conIniciales());
  return img;
}
/** Recorta al centro y deja la foto en 256 × 256 (WebP o JPEG, ~20–40 KB). */
async function fotoCuadrada(f) {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new Error("La foto debe ser JPG, PNG o WebP.");
  const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
  const lado = Math.min(bmp.width, bmp.height);
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = 256;
  lienzo.getContext("2d").drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, 256, 256);
  bmp.close?.();
  let blob = await new Promise((r) => lienzo.toBlob(r, "image/webp", 0.82));
  if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => lienzo.toBlob(r, "image/jpeg", 0.85));
  return blob;
}
/** Sube (o, con f = null, quita) la foto propia o, siendo administrador, la de otra cuenta. */
async function cambiarFoto(rut, f) {
  const url = "/api/perfil/foto" + (rut ? `/${encodeURIComponent(rut)}` : "");
  if (!f) return (await api(url, { metodo: "DELETE" })).usuario;
  const blob = await fotoCuadrada(f);
  const r = await fetch(url, { method: "PUT", credentials: "same-origin", headers: { "content-type": blob.type }, body: blob });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "No se pudo guardar la foto.");
  return j.usuario;
}

/**
 * Texto de una publicación → nodos seguros: párrafos, saltos de línea, **negrita** y enlaces https.
 * No interpreta HTML: todo se inserta como texto.
 */
function textoEnriquecido(texto) {
  const frag = document.createDocumentFragment();
  for (const parrafo of texto.split(/\n\s*\n/)) {
    const p = el("p");
    parrafo.split("\n").forEach((linea, i) => {
      if (i) p.append(document.createElement("br"));
      for (const trozo of linea.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s<>"]+)/g)) {
        if (!trozo) continue;
        if (/^\*\*[^*]+\*\*$/.test(trozo)) p.append(el("strong", "", trozo.slice(2, -2)));
        else if (/^https?:\/\//.test(trozo)) {
          const a = el("a", "", trozo);
          a.href = trozo;
          a.target = "_blank";
          a.rel = "noopener";
          p.append(a);
        } else p.append(document.createTextNode(trozo));
      }
    });
    frag.append(p);
  }
  return frag;
}

/**
 * Sube un archivo. Los de más de 4 MB se envían en partes de 4 MB (las funciones de Netlify
 * aceptan ~6 MB por petición). Devuelve { id, nombre, tipo, tamano }.
 */
// Achica las fotos antes de subirlas (máx. 1600 px, JPEG/WebP ~80 %): una foto de celular
// de 4–8 MB queda en 200–400 KB y el muro carga mucho más rápido.
const MAX_LADO = 1600;
async function optimizarImagen(f) {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size < 300 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
    const escala = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bmp.width * escala);
    lienzo.height = Math.round(bmp.height * escala);
    lienzo.getContext("2d").drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    bmp.close?.();
    const tipo = f.type === "image/png" ? "image/webp" : "image/jpeg";
    const blob = await new Promise((r) => lienzo.toBlob(r, tipo, 0.82));
    if (!blob || blob.size >= f.size || (tipo === "image/webp" && blob.type !== "image/webp")) return f;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], f.name.replace(/\.[^.]+$/, "") + "." + ext, { type: blob.type });
  } catch {
    return f;
  }
}

// Miniatura liviana (640 px) para los listados del muro.
async function miniatura(f) {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return null;
  try {
    const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
    const escala = Math.min(1, 640 / bmp.width);
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bmp.width * escala);
    lienzo.height = Math.round(bmp.height * escala);
    lienzo.getContext("2d").drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    bmp.close?.();
    let blob = await new Promise((r) => lienzo.toBlob(r, "image/webp", 0.72));
    if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => lienzo.toBlob(r, "image/jpeg", 0.75));
    return blob && blob.size <= 290 * 1024 ? blob : null;
  } catch {
    return null;
  }
}

async function subirArchivo(url, f) {
  f = await optimizarImagen(f);
  const archivo = await subirOriginal(url, f);
  if (url === "/api/intranet/archivos") {
    const mini = await miniatura(f);
    if (mini) await fetch(`${url}/${archivo.id}/miniatura`, { method: "POST", credentials: "same-origin", headers: { "content-type": mini.type }, body: mini }).catch(() => {});
  }
  return archivo;
}

async function subirOriginal(url, f) {
  const PARTE = 4 * 1024 * 1024;
  const base = { "content-type": f.type || "application/octet-stream", "x-nombre": encodeURIComponent(f.name) };
  const enviar = async (cuerpo, extra = {}) => {
    const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { ...base, ...extra }, body: cuerpo });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo subir el archivo.");
    return j;
  };
  if (f.size <= PARTE) return (await enviar(f)).archivo;
  const subida = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const partes = Math.ceil(f.size / PARTE);
  let ultimo;
  for (let i = 0; i < partes; i++) {
    ultimo = await enviar(f.slice(i * PARTE, (i + 1) * PARTE), { "x-subida": subida, "x-parte": String(i), "x-partes": String(partes) });
  }
  return ultimo.archivo;
}

// ── Comunes ────────────────────────────────────────────────────────────────
// Formatea el RUT al salir del campo (12345678k → 12.345.678-K)
$$("[data-rut]").forEach((input) => {
  input.addEventListener("blur", () => {
    const n = normalizarRut(input.value);
    if (n) input.value = formatearRut(n);
    else if (limpiarRut(input.value)) input.setAttribute("aria-invalid", "true");
  });
  input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
});

// Mostrar/ocultar contraseña
$$("[data-ver-clave]").forEach((b) => {
  b.addEventListener("click", () => {
    const input = document.getElementById(b.dataset.verClave);
    const ver = input.type === "password";
    input.type = ver ? "text" : "password";
    b.setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
    $(".material-symbols-outlined", b).textContent = ver ? "visibility_off" : "visibility";
  });
});

// ── Páginas ────────────────────────────────────────────────────────────────
const paginas = {
  ingresar() {
    const form = $("#form-ingreso");
    const msg = $("#mensaje");
    const volver = new URLSearchParams(location.search).get("volver");
    const destino = volver && /^\/funcionarios(\/|$)/.test(volver) ? volver : "/funcionarios/";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.classList.add("hidden");
      const rut = normalizarRut(form.rut.value);
      if (!rut) return mensaje(msg, "Ingrese un RUT válido (ej.: 12.345.678-9)."), form.rut.focus();
      if (!form.clave.value) return mensaje(msg, "Ingrese su contraseña."), form.clave.focus();

      const boton = $("button[type=submit]", form);
      boton.disabled = true;
      try {
        const r = await api("/api/auth/ingresar", { metodo: "POST", datos: { rut, clave: form.clave.value } });
        location.href = r.debeCambiarClave ? "/funcionarios/cambiar-clave.html" : destino;
      } catch (err) {
        mensaje(msg, err.message);
        form.clave.value = "";
        form.clave.focus();
        boton.disabled = false;
      }
    });
  },

  async portal() {
    // La sesión y el listado se piden en paralelo (el listado también exige sesión)
    const sesion = usuarioActual().then((u) => {
      if (u.debeCambiarClave) location.href = "/funcionarios/cambiar-clave.html";
    });

    // Muro de publicaciones (paginado: POR_PAGINA por página, con la página en la URL)
    const POR_PAGINA = 12;
    const muro = $("#muro");
    const filtros = $("#filtros");
    const paginas = $("#paginas");
    const params = new URLSearchParams(location.search);
    let categoria = params.get("categoria") || "";
    let pagina = Math.max(1, Number(params.get("pagina")) || 1);

    const tarjeta = (p) => {
      const a = el("a", "news-card bg-white rounded-custom shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow");
      a.href = `/funcionarios/publicacion.html?id=${p.id}`;
      if (p.imagen) {
        // Vista previa: ocupa todo el ancho de la tarjeta con alto fijo, mostrando la parte de arriba (afiches y boletines). Completa, al abrir la publicación.
        const img = el("img", "block w-full h-56 object-cover object-top bg-gray-100");
        img.src = `/api/intranet/archivos/${p.imagen}?tam=min`;
        img.decoding = "async";
        img.alt = "";
        img.loading = "lazy";
        a.append(img);
      }
      const cuerpo = el("div", "p-4 flex flex-col gap-1.5 flex-1");
      const meta = el("div", "flex flex-wrap items-center gap-2 text-[11px]");
      meta.append(el("span", "px-2 py-0.5 bg-primary-bg text-primary font-bold uppercase tracking-wide rounded", p.categoria));
      meta.append(el("span", "text-gray-500", fechaCorta(p.fecha)));
      cuerpo.append(meta, el("h3", "font-bold text-primary-deep text-[15px] leading-snug", p.titulo));
      if (p.extracto) cuerpo.append(el("p", "text-[13px] text-gray-600 leading-relaxed line-clamp-3", p.extracto));
      const pie = el("div", "mt-auto pt-2 flex items-center justify-between text-xs text-gray-500");
      pie.append(el("span", "", firma(p.area, p.autor)));
      if (p.adjuntos) {
        const adj = el("span", "inline-flex items-center gap-1");
        adj.append(icono("attach_file", "text-sm"), document.createTextNode(String(p.adjuntos)));
        adj.setAttribute("aria-label", `${p.adjuntos} adjunto(s)`);
        pie.append(adj);
      }
      cuerpo.append(pie);
      a.append(cuerpo);
      return a;
    };

    const actualizarUrl = () => {
      const q = new URLSearchParams();
      if (categoria) q.set("categoria", categoria);
      if (pagina > 1) q.set("pagina", String(pagina));
      history.replaceState(null, "", q.size ? `?${q}` : location.pathname);
    };

    const pintarFiltros = (categorias) => {
      filtros.replaceChildren();
      for (const c of ["", ...categorias]) {
        const b = el("button", `px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${c === categoria ? "bg-primary text-white border-primary" : "bg-white text-primary border-primary-pale hover:bg-primary-bg"}`, c || "Todas");
        b.type = "button";
        b.setAttribute("aria-pressed", String(c === categoria));
        b.addEventListener("click", () => { categoria = c; pagina = 1; cargar(); });
        filtros.append(b);
      }
    };

    // Números de página con elipsis: 1 … 4 5 [6] 7 8 … 20
    const numerosPagina = (actual, total) => {
      const set = new Set([1, total, actual - 1, actual, actual + 1].filter((n) => n >= 1 && n <= total));
      const orden = [...set].sort((x, y) => x - y);
      const out = [];
      orden.forEach((n, i) => { if (i && n - orden[i - 1] > 1) out.push("…"); out.push(n); });
      return out;
    };

    const pintarPaginas = (total) => {
      const totalPaginas = Math.ceil(total / POR_PAGINA);
      paginas.replaceChildren();
      paginas.classList.toggle("hidden", totalPaginas <= 1);
      if (totalPaginas <= 1) return;
      const boton = (contenido, destino, { actual = false, etiqueta } = {}) => {
        const b = el("button", `min-w-[2.25rem] h-9 px-2 inline-flex items-center justify-center rounded-custom text-sm font-bold border transition-colors ${actual ? "bg-primary text-white border-primary" : "bg-white text-primary border-gray-200 hover:bg-primary-bg"} disabled:opacity-40 disabled:pointer-events-none`);
        b.type = "button";
        if (typeof contenido === "string") b.textContent = contenido; else b.append(contenido);
        if (etiqueta) b.setAttribute("aria-label", etiqueta);
        if (actual) b.setAttribute("aria-current", "page");
        b.disabled = destino < 1 || destino > totalPaginas;
        b.addEventListener("click", () => {
          if (actual) return;
          pagina = destino;
          cargar().then(() => $("#titulo-muro").scrollIntoView({ behavior: "smooth", block: "start" }));
        });
        return b;
      };
      paginas.append(boton(icono("chevron_left", "text-lg"), pagina - 1, { etiqueta: "Página anterior" }));
      for (const n of numerosPagina(pagina, totalPaginas)) {
        paginas.append(n === "…" ? el("span", "px-1 text-gray-400", "…") : boton(String(n), n, { actual: n === pagina, etiqueta: `Página ${n}` }));
      }
      paginas.append(boton(icono("chevron_right", "text-lg"), pagina + 1, { etiqueta: "Página siguiente" }));
      paginas.append(el("span", "w-full text-center text-xs text-gray-400 mt-1", `Página ${pagina} de ${totalPaginas} · ${total} publicaciones`));
    };

    const cargar = async () => {
      muro.setAttribute("aria-busy", "true");
      try {
        const q = new URLSearchParams({ desde: String((pagina - 1) * POR_PAGINA), limite: String(POR_PAGINA) });
        if (categoria) q.set("categoria", categoria);
        let r = await api(`/api/intranet/publicaciones?${q}`);
        // Página fuera de rango (p. ej. enlace antiguo): volver a la última que exista
        if (!r.publicaciones.length && r.total && pagina > 1) {
          pagina = Math.ceil(r.total / POR_PAGINA);
          return cargar();
        }
        pintarFiltros(r.categorias);
        muro.replaceChildren(...r.publicaciones.map(tarjeta));
        if (!r.total) muro.replaceChildren(el("p", "text-gray-400 text-sm col-span-full py-8 text-center", categoria ? "No hay publicaciones en esta categoría." : "Aún no hay publicaciones."));
        pintarPaginas(r.total);
        actualizarUrl();
      } catch (e) {
        muro.replaceChildren(el("p", "text-red-600 text-sm col-span-full", e.message));
      } finally {
        muro.removeAttribute("aria-busy");
      }
    };
    await Promise.all([sesion, cargar()]);
  },

  async publicacion() {
    const u = await usuarioActual();
    if (u.debeCambiarClave) return (location.href = "/funcionarios/cambiar-clave.html");
    const id = new URLSearchParams(location.search).get("id");
    const art = $("#articulo");
    let r;
    try {
      r = await api(`/api/intranet/publicaciones/${encodeURIComponent(id || "")}`);
    } catch (e) {
      art.replaceChildren(el("div", "p-8 text-sm text-gray-600", e.status === 404 ? "La publicación no existe o fue eliminada." : e.message));
      return;
    }
    const p = r.publicacion;
    document.title = `${p.titulo} - Intranet Hospital de Frutillar`;
    $('[data-campo="miga"]').textContent = p.titulo;

    const caja = el("div", "p-6 md:p-8 flex flex-col gap-4");
    const meta = el("div", "flex flex-wrap items-center gap-2 text-xs text-gray-500");
    meta.append(el("span", "px-2.5 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded", p.categoria));
    meta.append(el("span", "", fechaLarga(p.fecha)));
    if (firma(p.area, p.autor?.nombre)) meta.append(el("span", "", "· " + firma(p.area, p.autor?.nombre)));
    caja.append(meta, el("h1", "text-2xl md:text-3xl font-bold text-primary-deep leading-snug", p.titulo));
    if (p.cuerpo) {
      const texto = el("div", "prose max-w-none text-gray-700 leading-relaxed");
      texto.append(textoEnriquecido(p.cuerpo));
      caja.append(texto);
    }

    const imagenes = p.adjuntos.filter((a) => a.tipo.startsWith("image/"));
    const otros = p.adjuntos.filter((a) => !a.tipo.startsWith("image/"));
    for (const a of imagenes) {
      const link = el("a", "block");
      link.href = `/api/intranet/archivos/${a.id}`;
      link.target = "_blank";
      const img = el("img", "w-full rounded-custom border border-gray-200");
      img.src = `/api/intranet/archivos/${a.id}`;
      img.alt = a.nombre;
      img.loading = "lazy";
      link.append(img);
      caja.append(link);
    }
    if (otros.length) {
      const lista = el("ul", "flex flex-col gap-2 border-t border-gray-100 pt-4");
      for (const a of otros) {
        const li = el("li");
        const link = el("a", "flex items-center gap-3 border border-gray-200 rounded-custom px-4 py-3 hover:bg-primary-bg hover:border-primary-pale");
        link.href = `/api/intranet/archivos/${a.id}`;
        link.target = "_blank";
        link.append(icono(a.tipo === "application/pdf" ? "picture_as_pdf" : "description", "text-red-600 text-2xl"));
        const t = el("span", "flex-1 min-w-0");
        t.append(el("span", "block text-sm font-semibold text-gray-800 truncate", a.nombre), el("span", "block text-xs text-gray-400", tamano(a.tamano)));
        link.append(t, icono("open_in_new", "text-primary text-lg"));
        li.append(link);
        lista.append(li);
      }
      caja.append(lista);
    }
    art.replaceChildren(caja);

    if (r.puedeEditar) {
      $("#editar").href = `/funcionarios/publicar.html?id=${p.id}`;
      $("#acciones-autor").classList.remove("hidden");
    }
  },

  async publicar() {
    const u = await usuarioActual();
    if (u.debeCambiarClave) return (location.href = "/funcionarios/cambiar-clave.html");
    const form = $("#form-publicar");
    const msg = $("#mensaje");
    const puedeSitio = PUBLICA_SITIO.includes(u.rol);
    if (!PUBLICA_INTRANET.includes(u.rol)) {
      form.replaceChildren(el("p", "text-sm text-gray-600", "Su cuenta no tiene permiso para publicar. Pida a un administrador el rol de Editor."));
      return;
    }
    if (u.rol === "admin") $("#campo-autor").classList.remove("hidden");

    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    let destino = params.get("destino") === "sitio" && puedeSitio ? "sitio" : "intranet";
    const D = DESTINOS;
    const sel = $("#p-categoria");
    const categoriasDe = {};
    const hoy = new Date().toLocaleDateString("en-CA", TZ);
    $("#p-fecha").value = hoy;
    $("#p-fecha").max = hoy;

    const adjuntos = []; // { id, nombre, tipo, tamano }
    const listaAdj = $("#lista-adjuntos");
    const pintarAdjuntos = () => {
      listaAdj.replaceChildren();
      adjuntos.forEach((a, i) => {
        const li = el("li", "flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-custom px-3 py-2 text-sm");
        li.append(icono(a.tipo?.startsWith("image/") ? "image" : "description", "text-primary"));
        const etiqueta = destino === "sitio" && a.id && a.id === adjuntos.find((x) => x.tipo?.startsWith("image/"))?.id ? " · foto principal" : "";
        li.append(el("span", "flex-1 truncate", a.nombre + etiqueta), el("span", "text-xs text-gray-400", a.subiendo ? "Subiendo…" : tamano(a.tamano)));
        if (!a.subiendo) {
          const b = el("button", "text-xs font-bold text-red-600 hover:underline", "Quitar");
          b.type = "button";
          b.addEventListener("click", () => { adjuntos.splice(i, 1); pintarAdjuntos(); });
          li.append(b);
        }
        listaAdj.append(li);
      });
    };

    const aplicarDestino = async () => {
      const esSitio = destino === "sitio";
      $("#campos-sitio").classList.toggle("hidden", !esSitio);
      $("#campo-area").classList.toggle("hidden", esSitio);
      $("button[type=submit]", form).textContent = id ? "Guardar cambios" : esSitio ? "Publicar en el sitio" : "Publicar en la intranet";
      if (!categoriasDe[destino]) {
        const r = await api(esSitio ? "/api/noticias" : "/api/intranet/publicaciones?desde=0");
        categoriasDe[destino] = r.categorias;
      }
      const actual = sel.value;
      sel.replaceChildren(...categoriasDe[destino].map((c) => new Option(c, c)));
      if (categoriasDe[destino].includes(actual)) sel.value = actual;
      pintarAdjuntos();
    };

    if (puedeSitio && !id) {
      $("#destino").classList.remove("hidden");
      $$('input[name="destino"]').forEach((r) => {
        r.checked = r.value === destino;
        r.addEventListener("change", async () => {
          if (adjuntos.length && !confirm("Al cambiar el destino se quitarán los adjuntos ya subidos. ¿Continuar?")) {
            $$('input[name="destino"]').forEach((x) => (x.checked = x.value === destino));
            return;
          }
          adjuntos.length = 0;
          destino = r.value;
          history.replaceState(null, "", destino === "sitio" ? "?destino=sitio" : location.pathname);
          await aplicarDestino();
        });
      });
    }
    await aplicarDestino();

    if (id) {
      let p;
      try {
        if (destino === "sitio") p = (await api(`/api/noticias/${encodeURIComponent(id)}`)).noticia;
        else {
          const r = await api(`/api/intranet/publicaciones/${encodeURIComponent(id)}`);
          if (!r.puedeEditar) throw new Error("Solo el autor o un administrador puede editar esta publicación.");
          p = r.publicacion;
        }
      } catch (e) {
        form.replaceChildren(el("p", "text-sm text-gray-600", e.message));
        return;
      }
      $('[data-campo="titulo-form"]').textContent = destino === "sitio" ? "Editar noticia del sitio" : "Editar publicación";
      form.titulo.value = p.titulo;
      sel.value = p.categoria;
      form.area.value = p.area || "";
      form.cuerpo.value = p.cuerpo || "";
      if (destino === "sitio") {
        form.resumen.value = p.resumen || "";
        form.destacada.checked = !!p.destacada;
      }
      $("#p-fecha").value = new Date(p.fecha).toLocaleDateString("en-CA", TZ);
      form.autorNombre.value = p.autor?.nombre || "";
      adjuntos.push(...p.adjuntos);
      pintarAdjuntos();
      const borrar = $("#eliminar");
      borrar.classList.remove("hidden");
      borrar.addEventListener("click", async () => {
        if (!confirm(destino === "sitio" ? "¿Eliminar esta noticia del sitio web? No se puede deshacer." : "¿Eliminar esta publicación y sus adjuntos? No se puede deshacer.")) return;
        try {
          await api(`${D[destino].api}/${p.id}`, { metodo: "DELETE" });
          location.href = destino === "sitio" ? "/funcionarios/noticias-sitio.html" : "/funcionarios/";
        } catch (e) { mensaje(msg, e.message); }
      });
    }

    $("#p-archivos").addEventListener("change", async (e) => {
      const archivos = [...e.target.files];
      e.target.value = "";
      for (const f of archivos) {
        if (f.size > 30 * 1024 * 1024) { mensaje(msg, `"${f.name}" supera los 30 MB.`); continue; }
        const temp = { nombre: f.name, subiendo: true };
        adjuntos.push(temp);
        pintarAdjuntos();
        try {
          const archivo = await subirArchivo(D[destino].archivos, f);
          Object.assign(temp, archivo, { subiendo: false });
        } catch (err) {
          adjuntos.splice(adjuntos.indexOf(temp), 1);
          mensaje(msg, `${f.name}: ${err.message}`);
        }
        pintarAdjuntos();
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (adjuntos.some((a) => a.subiendo)) return mensaje(msg, "Espere a que terminen de subir los archivos.");
      if (form.titulo.value.trim().length < 3) return mensaje(msg, "Ingrese un título."), form.titulo.focus();
      if (destino === "sitio" && form.resumen.value.trim().length < 10) return mensaje(msg, "Escriba un resumen de la noticia."), form.resumen.focus();
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      const fecha = $("#p-fecha").value;
      const datos = {
        titulo: form.titulo.value,
        categoria: sel.value,
        cuerpo: form.cuerpo.value,
        // Si es hoy, se usa la hora actual; si es otra fecha, el mediodía de ese día
        fecha: !fecha || (fecha === hoy && !id) ? undefined : `${fecha}T12:00:00-03:00`,
        adjuntos: adjuntos.map((a) => a.id),
        autorNombre: form.autorNombre.value || undefined,
        ...(destino === "sitio" ? { resumen: form.resumen.value, destacada: form.destacada.checked } : { area: form.area.value }),
      };
      try {
        const r = await api(id ? `${D[destino].api}/${id}` : D[destino].api, { metodo: id ? "PATCH" : "POST", datos });
        if (destino === "sitio") location.href = `/funcionarios/noticias-sitio.html?guardada=${encodeURIComponent(r.noticia.slug)}`;
        else location.href = `/funcionarios/publicacion.html?id=${r.publicacion.id}`;
      } catch (err) {
        mensaje(msg, err.message);
        btn.disabled = false;
      }
    });
  },

  async "noticias-sitio"() {
    const u = await usuarioActual();
    if (u.debeCambiarClave) return (location.href = "/funcionarios/cambiar-clave.html");
    const lista = $("#lista-noticias");
    if (!PUBLICA_SITIO.includes(u.rol)) {
      lista.replaceChildren(el("p", "p-6 text-sm text-gray-600", "Solo Comunicaciones o un administrador puede gestionar las noticias del sitio."));
      return;
    }
    const q = new URLSearchParams(location.search);
    if (q.get("guardada")) {
      const aviso = $("#aviso-guardada");
      const url = `/noticias/${q.get("guardada")}/`;
      aviso.replaceChildren(
        el("span", "", "Noticia guardada y publicada. Ya se ve en el sitio: "),
      );
      const a = el("a", "font-bold underline", url);
      a.href = url;
      a.target = "_blank";
      aviso.append(a);
      aviso.classList.remove("hidden");
    }
    const { noticias } = await api("/api/noticias");
    lista.replaceChildren();
    if (!noticias.length) return lista.append(el("p", "p-6 text-sm text-gray-500", "Aún no hay noticias publicadas desde el portal."));
    for (const n of noticias) {
      const fila = el("div", "flex flex-wrap items-center gap-4 px-5 py-4");
      if (n.imagen) {
        const img = el("img", "w-20 h-14 object-cover rounded-custom bg-gray-100 flex-shrink-0");
        img.src = `/api/noticias-archivos/${n.imagen}`;
        img.alt = "";
        img.loading = "lazy";
        fila.append(img);
      } else fila.append(el("div", "w-20 h-14 rounded-custom bg-noticia flex-shrink-0"));
      const info = el("div", "flex-1 min-w-[200px]");
      const meta = el("div", "flex flex-wrap items-center gap-2 text-[11px] mb-1");
      meta.append(el("span", "px-2 py-0.5 bg-primary-bg text-primary font-bold uppercase tracking-wide rounded", n.categoria), el("span", "text-gray-400", fechaCorta(n.fecha)));
      if (n.destacada) meta.append(el("span", "px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded", "Destacada"));
      info.append(meta, el("p", "font-bold text-primary-deep text-sm", n.titulo), el("p", "text-xs text-gray-500 line-clamp-1", n.resumen));
      const acciones = el("div", "flex gap-3 text-xs font-bold");
      const ver = el("a", "text-primary hover:underline", "Ver en el sitio");
      ver.href = `/noticias/${n.slug}/`;
      ver.target = "_blank";
      const editar = el("a", "text-primary hover:underline", "Editar");
      editar.href = `/funcionarios/publicar.html?destino=sitio&id=${n.id}`;
      acciones.append(ver, editar);
      fila.append(info, acciones);
      lista.append(fila);
    }
  },

  async contenido() {
    const u = await usuarioActual();
    if (u.debeCambiarClave) return (location.href = "/funcionarios/cambiar-clave.html");
    const caja = $("#contenido-grupos");
    const msg = $("#contenido-msg");
    if (!PUBLICA_SITIO.includes(u.rol)) {
      caja.replaceChildren(el("p", "p-6 text-sm text-gray-600 bg-white border border-gray-200 rounded-custom", "Solo Comunicaciones o un administrador puede editar el contenido del sitio."));
      return;
    }
    const VER = {
      Servicios: "/servicios.html", Horarios: "/horarios.html", Autoridades: "/quienes-somos.html#autoridades",
      "Preguntas frecuentes": "/faq.html", Visitas: "/visitas.html", Transparencia: "/transparencia.html", Portada: "/",
    };
    const [campos, inicial] = await Promise.all([
      fetch("/funcionarios/contenido-campos.json", { credentials: "same-origin" }).then((r) => r.json()),
      api("/api/contenido"),
    ]);
    let estado = inicial;
    const etiquetaRuta = Object.fromEntries(campos.map((c) => [c.ruta, `${c.grupo} · ${c.etiqueta}`]));
    const secciones = [...new Set(campos.map((c) => c.seccion))];
    let actual = new URLSearchParams(location.search).get("seccion") || secciones[0];
    const vigente = (c) => (estado.cambios[c.ruta] ? estado.cambios[c.ruta].valor : c.base);

    const pestanas = $("#contenido-pestanas");
    const pintarPestanas = () => {
      pestanas.replaceChildren(
        ...secciones.map((s) => {
          const b = el("button", `px-4 py-2 rounded-custom text-sm font-bold border ${s === actual ? "bg-primary text-white border-primary" : "bg-white text-primary border-gray-200 hover:bg-primary-bg"}`, s);
          b.type = "button";
          b.setAttribute("role", "tab");
          b.setAttribute("aria-selected", String(s === actual));
          b.addEventListener("click", () => { actual = s; history.replaceState(null, "", `?seccion=${encodeURIComponent(s)}`); pintar(); });
          return b;
        }),
      );
      const ver = el("a", "ml-auto text-sm font-bold text-primary hover:underline inline-flex items-center gap-1", "Ver en el sitio");
      ver.href = VER[actual] || "/";
      ver.target = "_blank";
      ver.append(icono("open_in_new", "text-base"));
      pestanas.append(ver);
    };

    const guardar = async (lote, boton) => {
      if (!Object.keys(lote).length) return mensaje(msg, "No hay cambios para guardar.");
      if (boton) boton.disabled = true;
      try {
        estado = await api("/api/contenido", { metodo: "PUT", datos: { cambios: lote } });
        mensaje(msg, "Cambios guardados. Ya se ven en el sitio.", "ok");
        pintar();
        pintarHistorial();
      } catch (err) {
        mensaje(msg, err.message);
        if (boton) boton.disabled = false;
      }
      msg.scrollIntoView({ block: "nearest" });
    };

    const campoFoto = (c, lote, alCambiar) => {
      const v = vigente(c);
      const fila = el("div", "flex flex-wrap items-center gap-4");
      const marco = el("div", "w-24 h-24 rounded-custom border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0");
      const pintarMarco = (url) => {
        if (url) {
          const img = el("img", "w-full h-full object-cover");
          img.src = url;
          img.alt = "";
          marco.replaceChildren(img);
        } else marco.replaceChildren(icono("image", "text-3xl text-gray-300"));
      };
      pintarMarco(v);
      const acciones = el("div", "flex flex-col gap-2");
      const entrada = el("input", "text-xs");
      entrada.type = "file";
      entrada.accept = "image/jpeg,image/png,image/webp";
      entrada.setAttribute("aria-label", `${c.grupo}: ${c.etiqueta}`);
      const estadoSubida = el("span", "text-xs text-gray-500");
      entrada.addEventListener("change", async () => {
        const f = entrada.files[0];
        if (!f) return;
        estadoSubida.textContent = "Subiendo…";
        try {
          const a = await subirArchivo("/api/contenido-archivos", f);
          lote[c.ruta] = `/api/contenido-archivos/${a.id}`;
          pintarMarco(lote[c.ruta]);
          estadoSubida.textContent = "Foto lista: guarde para publicarla.";
          alCambiar();
        } catch (err) {
          estadoSubida.textContent = err.message;
        }
      });
      const quitar = el("button", "self-start text-xs font-bold text-red-600 hover:underline", "Quitar foto");
      quitar.type = "button";
      quitar.addEventListener("click", () => { lote[c.ruta] = ""; pintarMarco(""); estadoSubida.textContent = "Se quitará al guardar."; alCambiar(); });
      acciones.append(entrada, quitar, estadoSubida);
      if (c.ayuda) acciones.append(el("span", "text-xs text-gray-400", c.ayuda));
      fila.append(marco, acciones);
      return fila;
    };

    const pintar = () => {
      pintarPestanas();
      const grupos = new Map();
      for (const c of campos.filter((x) => x.seccion === actual)) {
        if (!grupos.has(c.grupo)) grupos.set(c.grupo, []);
        grupos.get(c.grupo).push(c);
      }
      caja.replaceChildren();
      for (const [nombre, lista] of grupos) {
        const tarjeta = el("section", "bg-white border border-gray-200 rounded-custom shadow-sm");
        const cab = el("div", "px-5 py-3 border-b border-gray-100 flex items-center gap-2");
        cab.append(el("h2", "font-bold text-primary-deep", nombre));
        const editados = lista.filter((c) => estado.cambios[c.ruta]);
        if (editados.length) cab.append(el("span", "text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800", `${editados.length} editado${editados.length > 1 ? "s" : ""}`));
        const cuerpo = el("div", "px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4");
        const lote = {};
        const boton = el("button", "bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold text-sm px-5 py-2 rounded-custom", "Guardar cambios");
        boton.type = "button";
        boton.disabled = true;
        const alCambiar = () => (boton.disabled = !Object.keys(lote).length);
        for (const c of lista) {
          const largo = c.tipo === "largo" || c.tipo === "markdown";
          const ancho = largo || c.tipo === "foto";
          const bloque = el("div", ancho ? "md:col-span-2" : "");
          const id = `c-${c.ruta.replace(/[^a-z0-9]+/gi, "-")}`;
          const lab = el("label", "block text-xs font-bold text-gray-600 mb-1", c.etiqueta);
          lab.htmlFor = id;
          bloque.append(lab);
          if (c.tipo === "foto") bloque.append(campoFoto(c, lote, alCambiar));
          else {
            const entrada = el(largo ? "textarea" : "input", "w-full rounded-custom border-gray-300 text-sm focus:border-primary focus:ring-primary");
            entrada.id = id;
            if (largo) entrada.rows = c.tipo === "markdown" ? 6 : 4;
            if (c.max) entrada.maxLength = c.max;
            entrada.value = vigente(c);
            entrada.addEventListener("input", () => {
              if (entrada.value.trim() === String(vigente(c)).trim()) delete lote[c.ruta];
              else lote[c.ruta] = entrada.value;
              alCambiar();
            });
            bloque.append(entrada);
            if (c.ayuda) bloque.append(el("p", "text-[11px] text-gray-400 mt-1", c.ayuda));
          }
          const pie = el("div", "flex flex-wrap items-center gap-3 mt-1 text-[11px] text-gray-500");
          const cambio = estado.cambios[c.ruta];
          if (cambio) {
            pie.append(el("span", "", `Editado por ${cambio.autor} · ${fecha(cambio.editado)}`));
            const volver = el("button", "font-bold text-primary hover:underline", "Volver al original");
            volver.type = "button";
            volver.addEventListener("click", () => {
              if (confirm(`¿Volver al texto original de "${c.etiqueta}"?\n\n${c.tipo === "foto" ? (c.base ? "(foto original)" : "(sin foto)") : c.base || "(vacío)"}`)) guardar({ [c.ruta]: null });
            });
            pie.append(volver);
          }
          if (pie.childNodes.length) bloque.append(pie);
          cuerpo.append(bloque);
        }
        const pieTarjeta = el("div", "px-5 py-3 border-t border-gray-100 flex justify-end");
        boton.addEventListener("click", () => guardar({ ...lote }, boton));
        pieTarjeta.append(boton);
        tarjeta.append(cab, cuerpo, pieTarjeta);
        caja.append(tarjeta);
      }
    };

    const pintarHistorial = () => {
      const ol = $("#contenido-historial");
      ol.replaceChildren();
      if (!estado.historial.length) return ol.append(el("li", "px-5 py-4 text-gray-500", "Aún no hay cambios."));
      for (const h of estado.historial) {
        const li = el("li", "px-5 py-3 flex flex-wrap gap-x-3 gap-y-1");
        li.append(
          el("span", "font-semibold text-gray-800", etiquetaRuta[h.ruta] || h.ruta),
          el("span", "text-gray-500", h.despues === null ? "volvió al original" : /foto/.test(h.ruta) ? (h.despues ? "nueva foto" : "foto quitada") : `«${h.despues.length > 80 ? h.despues.slice(0, 80) + "…" : h.despues}»`),
          el("span", "text-xs text-gray-400 ml-auto", `${h.autor} · ${fecha(h.fecha)}`),
        );
        ol.append(li);
      }
    };

    pintar();
    pintarHistorial();
  },

  async protocolos() {
    const u = await usuarioActual();
    if (u.debeCambiarClave) return (location.href = "/funcionarios/cambiar-clave.html");
    const sinTildes = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const campo = $("#buscar-protocolo");
    const grilla = $("#areas-protocolos");
    const cuenta = $("#protocolos-cuenta");
    const msg = $("#protocolos-msg");
    const dlg = $("#dlg-protocolo");
    const form = $("#form-protocolo");
    const msgDlg = $("[data-msg-dlg]", dlg);
    let datos = { areas: [], documentos: [], puedeEditar: false, hoy: "" };
    let editando = null;
    let archivoAnteriorQuitado = false;

    const urlArchivo = (a) => `/api/protocolos-archivos/${a.id}`;
    const peso = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
    const enDias = (fecha) => Math.round((Date.parse(fecha) - Date.parse(datos.hoy)) / 86400000);
    const estadoVigencia = (d) => {
      if (!d.vigencia) return null;
      const dias = enDias(d.vigencia);
      if (dias < 0) return ["Vencido", "bg-red-100 text-red-800"];
      if (dias <= 90) return ["Vence pronto", "bg-amber-100 text-amber-900"];
      return null;
    };

    const pintar = () => {
      const q = sinTildes(campo.value.trim());
      grilla.replaceChildren();
      grilla.removeAttribute("aria-busy");
      let visibles = 0;
      for (const a of datos.areas) {
        const docs = datos.documentos
          .filter((d) => d.area === a.id)
          .filter((d) => !q || sinTildes(`${a.nombre} ${d.titulo} ${d.codigo} ${d.archivo?.nombre || ""}`).includes(q))
          .sort((x, y) => x.titulo.localeCompare(y.titulo, "es"));
        if (q && !docs.length) continue;
        visibles += docs.length;
        const art = el("article", "protocolo-area");
        const cab = el("header", "flex items-start gap-3");
        const ic = el("span", "protocolo-area__icono");
        ic.setAttribute("aria-hidden", "true");
        ic.append(icono(a.icono, ""));
        const tx = el("div", "flex-1 min-w-0");
        tx.append(el("h2", "font-bold text-primary-deep leading-tight", a.nombre), el("p", "text-xs text-gray-500 leading-snug mt-1", a.descripcion));
        cab.append(ic, tx);
        if (datos.puedeEditar) {
          const mas = el("button", "text-indigo-700 hover:bg-indigo-50 rounded-full w-8 h-8 inline-flex items-center justify-center flex-shrink-0");
          mas.type = "button";
          mas.title = `Subir protocolo en ${a.nombre}`;
          mas.setAttribute("aria-label", mas.title);
          mas.append(icono("add", "text-xl"));
          mas.addEventListener("click", () => abrir(null, a.id));
          cab.append(mas);
        }
        const ul = el("ul", "mt-3 flex flex-col divide-y divide-gray-100 border-t border-gray-100");
        for (const d of docs) {
          const li = el("li", "flex items-center gap-1");
          const link = el("a", "flex-1 min-w-0 flex items-center gap-2 py-2 text-[13px] text-gray-800 hover:text-indigo-700");
          link.href = d.archivo ? urlArchivo(d.archivo) : d.url;
          link.target = "_blank";
          link.rel = "noopener";
          const tipoIcono = d.archivo ? (d.archivo.tipo === "application/pdf" ? "picture_as_pdf" : "description") : /\/folders\//.test(d.url) ? "folder" : "link";
          const cuerpo = el("span", "flex-1 min-w-0");
          cuerpo.append(el("span", "block", d.titulo));
          const extra = [d.version && `v${d.version}`, d.archivo && peso(d.archivo.tamano), !d.archivo && "Drive"].filter(Boolean).join(" · ");
          if (extra) cuerpo.append(el("span", "block text-[11px] text-gray-500", extra));
          link.append(icono(tipoIcono, `text-base ${d.archivo ? "text-red-700" : "text-indigo-600"}`), cuerpo);
          const est = estadoVigencia(d);
          if (est) link.append(el("span", `text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${est[1]}`, est[0]));
          if (d.codigo) link.append(el("span", "text-[11px] text-gray-500", d.codigo));
          li.append(link);
          if (datos.puedeEditar) {
            const ed = el("button", "text-gray-500 hover:text-indigo-700 w-8 h-8 inline-flex items-center justify-center flex-shrink-0");
            ed.type = "button";
            ed.title = `Editar o reemplazar: ${d.titulo}`;
            ed.setAttribute("aria-label", ed.title);
            ed.append(icono("edit", "text-lg"));
            ed.addEventListener("click", () => abrir(d));
            li.append(ed);
          }
          ul.append(li);
        }
        if (!docs.length) ul.append(el("li", "py-3 text-xs text-gray-500", "Aún no hay protocolos en esta área."));
        art.append(cab, ul);
        if (a.url) {
          const ver = el("a", "mt-auto pt-3 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:underline", "Ver carpeta completa");
          ver.href = a.url;
          ver.target = "_blank";
          ver.rel = "noopener";
          ver.append(icono("open_in_new", "text-sm"));
          art.append(ver);
        }
        grilla.append(art);
      }
      const total = datos.documentos.length;
      cuenta.textContent = q ? `${visibles} de ${total} protocolos` : `${total} protocolos`;
      $("#sin-protocolos").classList.toggle("hidden", visibles > 0 || !q);
    };

    const cargar = async () => {
      datos = await api("/api/protocolos");
      $("#p-area").replaceChildren(...datos.areas.map((a) => { const o = el("option", "", a.nombre); o.value = a.id; return o; }));
      pintar();
    };

    // ── Formulario (subir / editar) ──
    const pintarArchivoActual = () => {
      const caja = $("[data-archivo-actual]", dlg);
      caja.replaceChildren();
      const a = editando?.archivo && !archivoAnteriorQuitado ? editando.archivo : null;
      caja.classList.toggle("hidden", !a);
      $("[data-etiqueta-archivo]", dlg).textContent = a ? "Reemplazar por una versión nueva (PDF o Word, hasta 30 MB)" : "Archivo PDF o Word (hasta 30 MB)";
      if (!a) return;
      const ver = el("a", "flex-1 min-w-0 truncate font-semibold text-indigo-700 hover:underline", a.nombre);
      ver.href = urlArchivo(a);
      ver.target = "_blank";
      ver.rel = "noopener";
      const quitar = el("button", "text-xs font-bold text-red-700 hover:underline", "Quitar archivo");
      quitar.type = "button";
      quitar.addEventListener("click", () => { archivoAnteriorQuitado = true; pintarArchivoActual(); });
      caja.append(icono("picture_as_pdf", "text-red-700"), ver, el("span", "text-xs text-gray-500", peso(a.tamano)), quitar);
    };
    const abrir = (doc, area) => {
      editando = doc;
      archivoAnteriorQuitado = false;
      form.reset();
      msgDlg.classList.add("hidden");
      $("[data-titulo-dlg]", dlg).textContent = doc ? "Editar protocolo" : "Subir protocolo";
      form.titulo.value = doc?.titulo || "";
      form.area.value = doc?.area || area || datos.areas[0]?.id;
      form.codigo.value = doc?.codigo || "";
      form.version.value = doc?.version || "";
      form.vigencia.value = doc?.vigencia || "";
      form.url.value = doc?.url || "";
      $("[data-eliminar]", dlg).classList.toggle("hidden", !doc);
      pintarArchivoActual();
      const ant = $("[data-anteriores]", dlg);
      ant.replaceChildren();
      ant.classList.toggle("hidden", !doc?.anteriores?.length);
      if (doc?.anteriores?.length) {
        ant.append(el("p", "text-xs font-bold text-gray-600 mb-1", "Versiones anteriores"));
        const ul = el("ul", "flex flex-col gap-1");
        for (const v of doc.anteriores) {
          const li = el("li", "flex items-center gap-2 text-xs");
          const a = el("a", "text-indigo-700 hover:underline truncate", v.archivo.nombre);
          a.href = urlArchivo(v.archivo);
          a.target = "_blank";
          a.rel = "noopener";
          li.append(icono("history", "text-sm text-gray-500"), a, el("span", "text-gray-500 whitespace-nowrap", `${v.version ? `v${v.version} · ` : ""}reemplazada el ${fechaCorta(v.reemplazado)}`));
          ul.append(li);
        }
        ant.append(ul);
      }
      dlg.showModal();
      form.titulo.focus();
    };
    $("#nuevo-protocolo").addEventListener("click", () => abrir(null));
    $$("[data-cancelar]", dlg).forEach((b) => b.addEventListener("click", () => dlg.close()));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const boton = $("[data-guardar]", dlg);
      const f = $("#p-archivo").files[0];
      if (f && !/\.(pdf|docx?)$/i.test(f.name)) return mensaje(msgDlg, "El protocolo debe ser PDF o Word.");
      if (f && f.size > 30 * 1048576) return mensaje(msgDlg, "El archivo supera los 30 MB.");
      boton.disabled = true;
      try {
        let archivo = editando?.archivo && !archivoAnteriorQuitado ? editando.archivo.id : null;
        if (f) {
          boton.textContent = "Subiendo…";
          // Algunos equipos no informan el tipo de los .docx: se deduce de la extensión
          const TIPO = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
          const conTipo = f.type ? f : new File([f], f.name, { type: TIPO[f.name.split(".").pop().toLowerCase()] });
          archivo = (await subirArchivo("/api/protocolos-archivos", conTipo)).id;
        }
        boton.textContent = "Guardando…";
        const cuerpo = { titulo: form.titulo.value, area: form.area.value, codigo: form.codigo.value, version: form.version.value, vigencia: form.vigencia.value, url: form.url.value.trim(), archivo };
        if (editando) await api(`/api/protocolos/${editando.id}`, { metodo: "PUT", datos: cuerpo });
        else await api("/api/protocolos", { metodo: "POST", datos: cuerpo });
        dlg.close();
        await cargar();
        mensaje(msg, `Protocolo ${editando ? "actualizado" : "publicado"}: ${cuerpo.titulo}. Ya lo ven todos los funcionarios.`, "ok");
      } catch (err) {
        mensaje(msgDlg, err.message);
      } finally {
        boton.disabled = false;
        boton.textContent = "Guardar";
      }
    });
    $("[data-eliminar]", dlg).addEventListener("click", async () => {
      if (!editando || !confirm(`¿Eliminar "${editando.titulo}" y sus archivos? No se puede deshacer.`)) return;
      try {
        await api(`/api/protocolos/${editando.id}`, { metodo: "DELETE" });
        dlg.close();
        await cargar();
        mensaje(msg, "Protocolo eliminado.", "ok");
      } catch (err) {
        mensaje(msgDlg, err.message);
      }
    });

    campo.addEventListener("input", pintar);
    try { await cargar(); } catch (err) { mensaje(msg, err.message); grilla.replaceChildren(); }
  },

  async calidad() {
    const u = await usuarioActual();
    if (u.debeCambiarClave) return (location.href = "/funcionarios/cambiar-clave.html");
    const caja = $("#novedades-calidad");
    try {
      const r = await api("/api/intranet/publicaciones?categoria=Calidad&limite=3");
      for (const p of r.publicaciones) {
        const a = el("a", "calidad-tarjeta group");
        a.href = `/funcionarios/publicacion.html?id=${p.id}`;
        a.append(
          el("span", "text-[10px] font-bold uppercase tracking-widest text-teal-700", fechaCorta(p.fecha)),
          el("strong", "block text-[15px] text-primary-deep leading-snug group-hover:underline", p.titulo),
        );
        if (p.extracto) a.append(el("span", "block text-[13px] text-gray-600 leading-snug line-clamp-2", p.extracto));
        caja.append(a);
      }
    } catch {}
  },

  async avisos() {
    const u = await usuarioActual();
    if (u.debeCambiarClave) return (location.href = "/funcionarios/cambiar-clave.html");
    const lista = $("#lista-avisos");
    const form = $("#form-aviso");
    const msg = $("#aviso-msg");
    if (!PUBLICA_SITIO.includes(u.rol)) {
      form.closest("div.bg-white")?.remove();
      lista.replaceChildren(el("p", "p-6 text-sm text-gray-600", "Solo Comunicaciones o un administrador puede gestionar los avisos."));
      return;
    }
    const texto = $("#aviso-texto");
    texto.addEventListener("input", () => ($("#aviso-cuenta").textContent = String(texto.value.length)));
    $("#aviso-hasta").min = new Date().toLocaleDateString("en-CA", TZ);
    const DONDE = { publico: "Sitio público", intranet: "Solo intranet", ambos: "Sitio público e intranet" };
    const yaSeVe = (d) => ({ publico: " Ya se ve en el sitio.", intranet: " Ya se ve en la intranet.", ambos: " Ya se ve en el sitio y en la intranet." })[d] || "";

    const cargar = async () => {
      const { avisos } = await api("/api/avisos");
      lista.replaceChildren();
      if (!avisos.length) return lista.append(el("p", "p-6 text-sm text-gray-500", "No hay avisos publicados."));
      for (const a of avisos) {
        const fila = el("div", "flex items-start gap-4 px-5 py-4");
        fila.append(icono(a.tipo === "importante" ? "campaign" : "info", a.tipo === "importante" ? "text-orange-600 mt-0.5" : "text-primary mt-0.5"));
        const info = el("div", "flex-1 min-w-0");
        info.append(el("p", "text-sm text-gray-800", a.texto));
        const meta = [a.tipo === "importante" ? "Importante" : "Aviso", DONDE[a.destino] || DONDE.publico, `por ${a.autor}`, fechaCorta(a.creado)];
        if (a.hasta) meta.push(`hasta ${new Date(a.hasta + "T12:00:00").toLocaleDateString("es-CL", { dateStyle: "medium", ...TZ })}`);
        if (!a.vigente) meta.push("vencido");
        info.append(el("p", "text-xs text-gray-500 mt-1", meta.join(" · ")));
        if (a.url) info.append(el("p", "text-xs text-primary mt-0.5 truncate", a.url));
        const borrar = el("button", "text-xs font-bold text-red-600 hover:underline flex-shrink-0", "Eliminar");
        borrar.type = "button";
        borrar.addEventListener("click", async () => {
          if (!confirm("¿Eliminar este aviso?")) return;
          borrar.disabled = true;
          try {
            const r = await api(`/api/avisos/${a.id}`, { metodo: "DELETE" });
            mensaje(msg, "Aviso eliminado.", "ok");
            await cargar();
            pintarAvisosIntranet();
          } catch (err) {
            mensaje(msg, err.message);
            borrar.disabled = false;
          }
        });
        fila.append(info, borrar);
        lista.append(fila);
      }
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const boton = $("button[type=submit]", form);
      boton.disabled = true;
      try {
        const r = await api("/api/avisos", { metodo: "POST", datos: { texto: texto.value, tipo: form.tipo.value, destino: form.destino.value, hasta: form.hasta.value, url: form.url.value.trim() } });
        form.reset();
        $("#aviso-cuenta").textContent = "0";
        mensaje(msg, "Aviso publicado." + yaSeVe(r.aviso.destino), "ok");
        await cargar();
        pintarAvisosIntranet();
      } catch (err) {
        mensaje(msg, err.message);
      } finally {
        boton.disabled = false;
      }
    });
    await cargar();
  },

  async "cambiar-clave"() {
    const u = await usuarioActual();
    if (u.debeCambiarClave) {
      $("#aviso-temporal").classList.remove("hidden");
      $("#volver-portal").classList.add("hidden");
    }
    if (!u.debeCambiarClave) {
      const caja = $("#mi-foto");
      caja.classList.remove("hidden");
      const fmsg = $("[data-mi-foto-msg]", caja);
      const quitar = $("[data-mi-foto-quitar]", caja);
      const pintarFoto = (yo) => {
        $("[data-mi-foto]", caja).replaceChildren(avatar(yo, "w-20 h-20 text-2xl"));
        quitar.classList.toggle("hidden", !yo.foto);
        $("[data-mi-foto-texto]", caja).textContent = yo.foto ? "Cambiar foto" : "Subir foto";
        pintarCabecera(yo);
      };
      pintarFoto(u);
      const actualizar = async (f) => {
        fmsg.textContent = f ? "Guardando…" : "Quitando…";
        try {
          pintarFoto(await cambiarFoto(null, f));
          fmsg.textContent = f ? "Foto guardada." : "Foto quitada.";
        } catch (err) {
          fmsg.textContent = err.message;
        }
      };
      $("[data-mi-foto-archivo]", caja).addEventListener("change", (e) => { if (e.target.files[0]) actualizar(e.target.files[0]); e.target.value = ""; });
      quitar.addEventListener("click", () => actualizar(null));
    }
    const form = $("#form-clave");
    const msg = $("#mensaje");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const [actual, nueva, repetir] = ["actual", "nueva", "repetir"].map((id) => document.getElementById(id).value);
      if (!actual || !nueva) return mensaje(msg, "Complete todos los campos.");
      if (nueva !== repetir) return mensaje(msg, "Las contraseñas nuevas no coinciden.");
      const boton = $("button[type=submit]", form);
      boton.disabled = true;
      try {
        await api("/api/auth/cambiar-clave", { metodo: "POST", datos: { actual, nueva } });
        form.reset();
        mensaje(msg, "Contraseña actualizada. Redirigiendo al portal…", "ok");
        setTimeout(() => (location.href = "/funcionarios/"), 1200);
      } catch (err) {
        mensaje(msg, err.message);
        boton.disabled = false;
      }
    });
  },

  async "configuracion-inicial"() {
    const { disponible } = await api("/api/configuracion-inicial");
    if (!disponible) return $("#no-disponible").classList.remove("hidden");
    const form = $("#form-config");
    const msg = $("#mensaje");
    form.classList.remove("hidden");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = (id) => document.getElementById(id).value;
      const rut = normalizarRut(v("rut"));
      if (!rut) return mensaje(msg, "RUT inválido.");
      const boton = $("button[type=submit]", form);
      boton.disabled = true;
      try {
        await api("/api/configuracion-inicial", {
          metodo: "POST",
          datos: { claveConfiguracion: v("claveConfiguracion"), rut, nombre: v("nombre"), cargo: v("cargo"), clave: v("clave") },
        });
        form.reset();
        mensaje(msg, "Administrador creado. Ya puede ingresar al portal con su RUT y contraseña.", "ok");
        setTimeout(() => (location.href = "/funcionarios/ingresar.html"), 2000);
      } catch (err) {
        mensaje(msg, err.message);
        boton.disabled = false;
      }
    });
  },

  async administrar() {
    const yo = await usuarioActual();
    if (yo.debeCambiarClave) return (location.href = "/funcionarios/cambiar-clave.html");
    const msg = $("#mensaje");
    const tabla = $("#tabla-usuarios");
    const caja = $("#clave-entregada");
    let usuarios = [];

    const mostrarClave = (u, clave, deRut) => {
      $('[data-campo="para"]', caja).textContent = `${u.nombre} (${formatearRut(u.rut)})`;
      $('[data-campo="clave"]', caja).textContent = clave;
      $('[data-campo="explicacion"]', caja).textContent = deRut
        ? "Son los 4 primeros dígitos de su RUT. Ingresa con su RUT y esta clave; vence en 72 horas y deberá cambiarla en su primer ingreso."
        : "Entréguela personalmente. Se muestra solo esta vez y vence en 72 horas; el funcionario deberá cambiarla al ingresar.";
      caja.classList.remove("hidden");
      caja.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    $("[data-cerrar]", caja).addEventListener("click", () => {
      caja.classList.add("hidden");
      $('[data-campo="clave"]', caja).textContent = "";
    });
    $("[data-copiar]", caja).addEventListener("click", () =>
      navigator.clipboard?.writeText($('[data-campo="clave"]', caja).textContent)
    );

    const celda = (txt, clase = "") => {
      const td = document.createElement("td");
      td.className = `px-5 py-3 ${clase}`;
      td.textContent = txt;
      return td;
    };
    const boton = (txt, accion, rut, peligro = false) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = txt;
      b.dataset.accion = accion;
      b.dataset.rut = rut;
      b.className = `text-xs font-bold hover:underline ${peligro ? "text-red-600" : "text-primary"}`;
      return b;
    };

    const NOMBRES_ROL = { funcionario: "Funcionario", editor: "Editor (intranet)", comunicaciones: "Comunicaciones (intranet y sitio)", admin: "Administrador" };

    // Diálogo de edición
    const dlg = $("#dlg-editar");
    const fe = $("#form-editar");
    const emsg = $("#e-mensaje");
    let editando = null;
    const abrirEdicion = (u) => {
      editando = u;
      $('[data-campo="rut-editar"]', dlg).textContent = formatearRut(u.rut);
      fe.nombre.value = u.nombre;
      fe.cargo.value = u.cargo || "";
      fe.correo.value = u.correo || "";
      fe.rol.value = u.rol;
      fe.rol.disabled = u.rut === yo.rut;
      pintarFotoEdicion(u);
      $("[data-eliminar]", dlg).classList.toggle("hidden", u.rut === yo.rut);
      emsg.classList.add("hidden");
      dlg.showModal();
    };
    const pintarFotoEdicion = (u) => {
      $("[data-e-foto]", dlg).replaceChildren(avatar(u, "w-16 h-16 text-xl"));
      $("[data-e-foto-texto]", dlg).textContent = u.foto ? "Cambiar foto" : "Subir foto";
      $("[data-e-foto-quitar]", dlg).classList.toggle("hidden", !u.foto);
    };
    const fotoEdicion = async (f) => {
      try {
        const nuevo = await cambiarFoto(editando.rut, f);
        Object.assign(editando, { foto: nuevo.foto });
        if (!nuevo.foto) delete editando.foto;
        pintarFotoEdicion(editando);
        if (editando.rut === yo.rut) pintarCabecera(nuevo);
        pintar();
        emsg.classList.add("hidden");
      } catch (err) {
        mensaje(emsg, err.message);
      }
    };
    $("[data-e-foto-archivo]", dlg).addEventListener("change", (e) => { if (e.target.files[0]) fotoEdicion(e.target.files[0]); e.target.value = ""; });
    $("[data-e-foto-quitar]", dlg).addEventListener("click", () => fotoEdicion(null));
    $$("[data-cancelar]", dlg).forEach((b) => b.addEventListener("click", () => dlg.close()));
    fe.addEventListener("submit", async (e) => {
      e.preventDefault();
      const boton = $("button[type=submit]", fe);
      boton.disabled = true;
      try {
        const datos = { rut: editando.rut, accion: "editar", nombre: fe.nombre.value, cargo: fe.cargo.value, correo: fe.correo.value.trim() };
        if (editando.rut !== yo.rut) datos.rol = fe.rol.value;
        if (datos.rol && datos.rol !== editando.rol && !confirm(`¿Cambiar el rol de ${editando.nombre} a "${NOMBRES_ROL[datos.rol]}"? Su sesión actual se cerrará.`)) return;
        await api("/api/admin/usuarios", { metodo: "PATCH", datos });
        dlg.close();
        mensaje(msg, `Cuenta de ${datos.nombre} actualizada.`, "ok");
        await cargar();
      } catch (err) {
        mensaje(emsg, err.message);
      } finally {
        boton.disabled = false;
      }
    });
    $("[data-eliminar]", dlg).addEventListener("click", async () => {
      const u = editando;
      if (!confirm(`¿Eliminar definitivamente la cuenta de ${u.nombre} (${formatearRut(u.rut)})? Esta acción no se puede deshacer. Si solo quiere impedir el acceso, use "Desactivar".`)) return;
      try {
        await api("/api/admin/usuarios", { metodo: "DELETE", datos: { rut: u.rut } });
        dlg.close();
        mensaje(msg, `Cuenta de ${u.nombre} eliminada.`, "ok");
        await cargar();
      } catch (err) {
        mensaje(emsg, err.message);
      }
    });

    const celdaNombre = (u) => {
      const td = celda("", "font-semibold text-gray-800");
      const fila = el("div", "flex items-center gap-3");
      const datos = el("div", "min-w-0", u.nombre);
      if (u.correo) {
        const a = el("a", "block text-xs font-normal text-primary hover:underline", u.correo);
        a.href = `mailto:${u.correo}`;
        datos.append(a);
      }
      fila.append(avatar(u, "w-8 h-8 text-[11px]"), datos);
      td.append(fila);
      return td;
    };

    const pintar = () => {
      const q = $("#filtro").value.trim().toLowerCase();
      const lista = usuarios.filter((u) =>
        !q || [u.nombre, u.rut, formatearRut(u.rut), u.cargo, u.correo].some((x) => (x || "").toLowerCase().includes(q))
      );
      tabla.replaceChildren();
      if (!lista.length) {
        const tr = document.createElement("tr");
        tr.append(celda(usuarios.length ? "Sin resultados." : "Aún no hay cuentas.", "text-center text-gray-400"));
        tr.firstChild.colSpan = 7;
        return tabla.append(tr);
      }
      for (const u of lista) {
        const tr = document.createElement("tr");
        if (!u.activo) tr.className = "bg-gray-50 text-gray-400";
        let estadoTxt = u.activo ? "Activa" : "Desactivada";
        let estadoClase = "";
        if (u.activo && u.debeCambiarClave) {
          const vence = u.claveTemporalVence ? Date.parse(u.claveTemporalVence) : null;
          if (vence && vence < Date.now()) {
            estadoTxt = "Clave inicial vencida";
            estadoClase = "text-red-600 font-semibold";
          } else {
            estadoTxt = vence ? `Clave inicial (vence ${fecha(u.claveTemporalVence)})` : "Clave inicial";
            estadoClase = "text-amber-700";
          }
        }
        const estado = celda(estadoTxt, estadoClase);
        const acciones = document.createElement("td");
        acciones.className = "px-5 py-3 text-right whitespace-nowrap space-x-3";
        acciones.append(boton("Editar", "editar", u.rut), boton("Restablecer clave", "restablecer", u.rut));
        if (u.rut !== yo.rut) {
          acciones.append(u.activo ? boton("Desactivar", "desactivar", u.rut, true) : boton("Activar", "activar", u.rut));
        }
        tr.append(
          celdaNombre(u),
          celda(formatearRut(u.rut), "whitespace-nowrap"),
          celda(u.cargo || "—"),
          celda(NOMBRES_ROL[u.rol] || u.rol),
          estado,
          celda(fecha(u.ultimoAcceso), "whitespace-nowrap"),
          acciones
        );
        tabla.append(tr);
      }
    };

    const cargar = async () => {
      const r = await api("/api/admin/usuarios");
      usuarios = r.usuarios;
      modoClaveActual = r.modoClave || modoClaveActual;
      $("#modo-clave").textContent = {
        comun: `Las cuentas nuevas parten con la clave inicial común. Vence a las ${r.vigenciaHoras} horas si el funcionario no ingresa y la cambia.`,
        aleatoria: `Las cuentas nuevas reciben una clave temporal individual que se muestra una sola vez. Vence a las ${r.vigenciaHoras} horas si no se cambia.`,
        rut: `Las cuentas nuevas parten con los 4 primeros dígitos del RUT como clave (p. ej. 12.345.678-5 → 1234). Vence a las ${r.vigenciaHoras} horas y debe cambiarse en el primer ingreso.`,
      }[r.modoClave || (r.claveComunConfigurada ? "comun" : "aleatoria")];
      pintar();
    };

    $("#filtro").addEventListener("input", pintar);

    tabla.addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-accion]");
      if (!b) return;
      const u = usuarios.find((x) => x.rut === b.dataset.rut);
      if (b.dataset.accion === "editar") return abrirEdicion(u);
      const preguntas = {
        restablecer: `¿Restablecer la contraseña de ${u.nombre}? Volverá a la clave inicial y su sesión actual se cerrará.`,
        desactivar: `¿Desactivar la cuenta de ${u.nombre}? No podrá ingresar hasta que se reactive.`,
      };
      if (preguntas[b.dataset.accion] && !confirm(preguntas[b.dataset.accion])) return;
      const datos = { rut: u.rut, accion: b.dataset.accion };
      b.disabled = true;
      try {
        const r = await api("/api/admin/usuarios", { metodo: "PATCH", datos });
        await cargar();
        if (r.claveTemporal) { msg.classList.add("hidden"); mostrarClave(r.usuario, r.claveTemporal, r.claveDeRut); }
        else if (r.claveComun) mensaje(msg, `Contraseña de ${r.usuario.nombre} restablecida a la clave inicial común. Debe ingresar con ella antes del ${fecha(r.usuario.claveTemporalVence)} y cambiarla.`, "ok");
        else msg.classList.add("hidden");
      } catch (err) {
        mensaje(msg, err.message);
        b.disabled = false;
      }
    });

    const form = $("#form-nuevo");
    const vistaFoto = $("[data-n-foto-vista]", form);
    form.foto.addEventListener("change", () => {
      const f = form.foto.files[0];
      vistaFoto.replaceChildren();
      if (f) {
        const img = el("img", "w-9 h-9 rounded-full object-cover");
        img.src = URL.createObjectURL(f);
        img.alt = "";
        vistaFoto.append(img);
      }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rut = normalizarRut(form.rut.value);
      if (!rut) return mensaje(msg, "RUT inválido."), form.rut.focus();
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      try {
        const r = await api("/api/admin/usuarios", {
          metodo: "POST",
          datos: { rut, nombre: form.nombre.value, cargo: form.cargo.value, correo: form.correo.value.trim(), rol: form.rol.value },
        });
        const foto = form.foto.files[0];
        form.reset();
        vistaFoto.replaceChildren();
        let avisoFoto = "";
        if (foto) {
          try { r.usuario = await cambiarFoto(rut, foto); } catch (err) { avisoFoto = ` La foto no se pudo guardar: ${err.message}`; }
        }
        if (r.claveComun) {
          caja.classList.add("hidden");
          mensaje(msg, `Cuenta creada para ${r.usuario.nombre}. Debe ingresar con la clave inicial común antes del ${fecha(r.usuario.claveTemporalVence)} y cambiarla.${avisoFoto}`, "ok");
        } else {
          if (avisoFoto) mensaje(msg, avisoFoto.trim()); else msg.classList.add("hidden");
          mostrarClave(r.usuario, r.claveTemporal, r.claveDeRut);
        }
        await cargar();
      } catch (err) {
        mensaje(msg, err.message);
      } finally {
        btn.disabled = false;
      }
    });

    // ── Carga masiva ──
    const cm = $("#carga-masiva");
    const cmResumen = $("#cm-resumen");
    const cmMsg = $("#cm-mensaje");
    let modoClaveActual = "rut";
    const sinTilde = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
    // CSV o texto pegado desde Excel (tabulaciones). Admite comillas y ; , o tab como separador.
    const leerTabla = (texto) => {
      const lineas = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
      if (!lineas.length) return [];
      const cuenta = (c) => lineas[0].split(c).length;
      const sep = ["\t", ";", ","].sort((a, b) => cuenta(b) - cuenta(a))[0];
      const celdas = (l) => {
        const out = [];
        let actual = "", comillas = false;
        for (let i = 0; i < l.length; i++) {
          const c = l[i];
          if (comillas) {
            if (c === '"' && l[i + 1] === '"') { actual += '"'; i++; }
            else if (c === '"') comillas = false;
            else actual += c;
          } else if (c === '"') comillas = true;
          else if (c === sep) { out.push(actual.trim()); actual = ""; }
          else actual += c;
        }
        out.push(actual.trim());
        return out;
      };
      let filas = lineas.map(celdas);
      let cols = { rut: 0, nombre: 1, cargo: 2, correo: 3, rol: 4 };
      const cab = filas[0].map(sinTilde);
      if (cab.includes("rut")) {
        const busca = (...n) => cab.findIndex((x) => n.includes(x));
        cols = { rut: busca("rut"), nombre: busca("nombre", "nombre completo"), cargo: busca("cargo", "cargo / unidad", "unidad"), correo: busca("correo", "email", "e-mail"), rol: busca("rol") };
        filas = filas.slice(1);
      }
      return filas.map((f, i) => ({ fila: i + 1, rut: f[cols.rut] || "", nombre: f[cols.nombre] || "", cargo: cols.cargo >= 0 ? f[cols.cargo] || "" : "", correo: cols.correo >= 0 ? f[cols.correo] || "" : "", rol: cols.rol >= 0 ? sinTilde(f[cols.rol]) : "" }));
    };
    const ROL_TEXTO = { funcionario: "funcionario", editor: "editor", comunicaciones: "comunicaciones", admin: "admin", administrador: "admin" };
    const clasificar = (filas) => {
      const existentes = new Set(usuarios.map((u) => u.rut));
      const vistos = new Set();
      const r = { nuevas: [], existentes: [], errores: [] };
      for (const f of filas) {
        const rut = normalizarRut(f.rut);
        const rol = f.rol ? ROL_TEXTO[f.rol] : "funcionario";
        let error = "";
        if (!rut) error = "RUT inválido";
        else if (f.nombre.trim().length < 3) error = "Falta el nombre";
        else if (!rol) error = `Rol desconocido "${f.rol}"`;
        else if (f.correo && !/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(f.correo)) error = "Correo inválido";
        else if (vistos.has(rut)) error = "RUT repetido en la planilla";
        if (error) { r.errores.push({ ...f, error }); continue; }
        vistos.add(rut);
        const cuenta = { rut, nombre: f.nombre.trim(), cargo: f.cargo.trim(), correo: f.correo.trim(), rol };
        (existentes.has(rut) ? r.existentes : r.nuevas).push(cuenta);
      }
      return r;
    };
    const descargarCSV = (nombre, filas) => {
      const txt = "﻿" + filas.map((f) => f.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
      const a = el("a", "font-bold text-primary underline", nombre);
      a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
      a.download = nombre;
      return a;
    };
    const mostrarResumen = (texto) => {
      cmMsg.classList.add("hidden");
      const r = clasificar(leerTabla(texto));
      cmResumen.replaceChildren();
      cmResumen.classList.remove("hidden");
      const chips = el("div", "flex flex-wrap gap-2 text-xs font-bold");
      chips.append(
        el("span", "px-2.5 py-1 rounded bg-green-100 text-green-800", `${r.nuevas.length} cuenta(s) nueva(s)`),
        el("span", "px-2.5 py-1 rounded bg-gray-100 text-gray-600", `${r.existentes.length} ya existen (se omiten)`),
        el("span", `px-2.5 py-1 rounded ${r.errores.length ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`, `${r.errores.length} con errores`),
      );
      cmResumen.append(chips);
      if (r.errores.length) {
        const ul = el("ul", "text-xs text-red-700 list-disc pl-5 max-h-32 overflow-auto");
        r.errores.slice(0, 50).forEach((e) => ul.append(el("li", "", `Fila ${e.fila} (${e.rut || "sin RUT"} ${e.nombre}): ${e.error}`)));
        cmResumen.append(ul);
      }
      if (r.nuevas.length) {
        const vista = el("div", "border border-gray-200 rounded-custom max-h-64 overflow-auto");
        const t = el("table", "w-full text-xs");
        const th = el("tr", "bg-gray-50 text-left text-gray-500");
        ["RUT", "Nombre", "Cargo / unidad", "Rol"].forEach((x) => th.append(el("th", "px-3 py-2 font-bold sticky top-0 bg-gray-50", x)));
        t.append(th);
        r.nuevas.forEach((c) => {
          const tr = el("tr", "border-t border-gray-100");
          [formatearRut(c.rut), c.nombre, c.cargo || "—", NOMBRES_ROL[c.rol]].forEach((x) => tr.append(el("td", "px-3 py-1.5", x)));
          t.append(tr);
        });
        vista.append(t);
        const crear = el("button", "self-start bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-bold text-sm px-5 py-2 rounded-custom shadow", `Crear ${r.nuevas.length} cuenta(s)`);
        crear.type = "button";
        const progreso = el("p", "text-xs text-gray-500");
        crear.addEventListener("click", async () => {
          const vigencia = Number($("#cm-vigencia").value);
          if (!confirm(`¿Crear ${r.nuevas.length} cuentas? La clave inicial vencerá en ${$("#cm-vigencia").selectedOptions[0].textContent}.`)) return;
          crear.disabled = true;
          const hechas = [], fallidas = [], claves = [];
          let i = 0;
          const trabajar = async () => {
            while (i < r.nuevas.length) {
              const c = r.nuevas[i++];
              try {
                const res = await api("/api/admin/usuarios", { metodo: "POST", datos: { ...c, vigenciaHoras: vigencia } });
                hechas.push(res.usuario);
                if (res.claveTemporal && !res.claveDeRut) claves.push([formatearRut(c.rut), c.nombre, res.claveTemporal]);
              } catch (err) {
                fallidas.push([formatearRut(c.rut), c.nombre, err.message]);
              }
              progreso.textContent = `Creando… ${hechas.length + fallidas.length} de ${r.nuevas.length}`;
            }
          };
          await Promise.all([trabajar(), trabajar(), trabajar()]);
          await cargar();
          cmResumen.replaceChildren();
          const vence = hechas[0]?.claveTemporalVence;
          const comoIngresan = {
            rut: "Cada persona ingresa con su RUT y, como clave, los 4 primeros dígitos de su RUT",
            comun: "Cada persona ingresa con su RUT y la clave inicial común",
            aleatoria: "Cada persona ingresa con su RUT y la clave temporal de la lista",
          }[modoClaveActual];
          mensaje(cmMsg, `${hechas.length} cuenta(s) creada(s)${fallidas.length ? `, ${fallidas.length} con error` : ""}. ${comoIngresan}${vence ? `, antes del ${fecha(vence)}` : ""}, y la cambia en su primer ingreso.`, fallidas.length ? "error" : "ok");
          if (claves.length) cmResumen.append(el("p", "text-xs text-amber-800", "Claves temporales (se muestran solo ahora): "), descargarCSV("claves-temporales.csv", [["RUT", "Nombre", "Clave"], ...claves]));
          if (fallidas.length) cmResumen.append(descargarCSV("cuentas-con-error.csv", [["RUT", "Nombre", "Error"], ...fallidas]));
          cmResumen.classList.toggle("hidden", !cmResumen.childNodes.length);
          $("#cm-texto").value = "";
          $("#cm-archivo").value = "";
        });
        cmResumen.append(vista, crear, progreso);
      }
    };
    $("#cm-archivo").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      let texto = await f.text();
      // Excel en Windows suele guardar el CSV en Latin-1: si no es UTF-8 válido, se relee.
      if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(await f.arrayBuffer());
      mostrarResumen(texto);
    });
    let pausa;
    $("#cm-texto").addEventListener("input", (e) => { clearTimeout(pausa); pausa = setTimeout(() => e.target.value.trim() && mostrarResumen(e.target.value), 400); });

    try { await cargar(); } catch (err) { mensaje(msg, err.message); }
  },
};

// Botón "Cerrar sesión"
$$("[data-salir]").forEach((b) =>
  b.addEventListener("click", async () => {
    try { await api("/api/auth/salir", { metodo: "POST" }); } finally { location.href = "/funcionarios/ingresar.html"; }
  })
);

const raiz = $("[data-pagina]");
if (raiz && paginas[raiz.dataset.pagina]) Promise.resolve().then(() => paginas[raiz.dataset.pagina]()).catch((e) => console.error(e));
