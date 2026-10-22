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
async function usuarioActual() {
  try {
    return (await api("/api/auth/yo")).usuario;
  } catch (e) {
    if (e.status === 401) irAlIngreso();
    throw e;
  }
}

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }) : "—";

const TZ = { timeZone: "America/Santiago" };
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
async function subirArchivo(url, f) {
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
    const u = await usuarioActual();
    if (u.debeCambiarClave) return (location.href = "/funcionarios/cambiar-clave.html");
    $('[data-campo="nombre"]').textContent = u.nombre;
    $('[data-campo="rut"]').textContent = formatearRut(u.rut);
    const cargo = $('[data-campo="cargo"]');
    if (u.cargo) cargo.textContent = u.cargo; else cargo.remove();
    if (u.rol === "admin") $$("[data-solo-admin]").forEach((el) => el.classList.remove("hidden"));
    if (PUBLICA_INTRANET.includes(u.rol)) $$("[data-solo-editor]").forEach((el) => el.classList.remove("hidden"));
    if (PUBLICA_SITIO.includes(u.rol)) $$("[data-solo-comunicaciones]").forEach((el) => el.classList.remove("hidden"));

    // Muro de publicaciones
    const muro = $("#muro");
    const filtros = $("#filtros");
    const verMas = $("#ver-mas");
    let categoria = new URLSearchParams(location.search).get("categoria") || "";
    let desde = 0;

    const tarjeta = (p) => {
      const a = el("a", "news-card bg-white rounded-custom shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow");
      a.href = `/funcionarios/publicacion.html?id=${p.id}`;
      if (p.imagen) {
        const img = el("img", "w-full h-48 object-cover object-top bg-gray-100");
        img.src = `/api/intranet/archivos/${p.imagen}`;
        img.alt = "";
        img.loading = "lazy";
        a.append(img);
      }
      const cuerpo = el("div", "p-4 flex flex-col gap-1.5 flex-1");
      const meta = el("div", "flex flex-wrap items-center gap-2 text-[11px]");
      meta.append(el("span", "px-2 py-0.5 bg-primary-bg text-primary font-bold uppercase tracking-wide rounded", p.categoria));
      meta.append(el("span", "text-gray-400", fechaCorta(p.fecha)));
      cuerpo.append(meta, el("h3", "font-bold text-gray-800 text-sm leading-snug", p.titulo));
      if (p.extracto) cuerpo.append(el("p", "text-xs text-gray-500 leading-relaxed line-clamp-3", p.extracto));
      const pie = el("div", "mt-auto pt-2 flex items-center justify-between text-xs text-gray-400");
      pie.append(el("span", "", [p.area, p.autor].filter(Boolean).join(" · ")));
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

    const pintarFiltros = (categorias) => {
      filtros.replaceChildren();
      for (const c of ["", ...categorias]) {
        const b = el("button", `px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${c === categoria ? "bg-primary text-white border-primary" : "bg-white text-primary border-primary-pale hover:bg-primary-bg"}`, c || "Todas");
        b.type = "button";
        b.setAttribute("aria-pressed", String(c === categoria));
        b.addEventListener("click", () => {
          categoria = c;
          history.replaceState(null, "", c ? `?categoria=${encodeURIComponent(c)}` : location.pathname);
          cargar(true);
        });
        filtros.append(b);
      }
    };

    const cargar = async (reiniciar) => {
      if (reiniciar) { desde = 0; muro.replaceChildren(); }
      verMas.disabled = true;
      try {
        const q = new URLSearchParams({ desde: String(desde) });
        if (categoria) q.set("categoria", categoria);
        const r = await api(`/api/intranet/publicaciones?${q}`);
        if (reiniciar) pintarFiltros(r.categorias);
        r.publicaciones.forEach((p) => muro.append(tarjeta(p)));
        desde += r.publicaciones.length;
        if (!r.total) muro.replaceChildren(el("p", "text-gray-400 text-sm col-span-full py-8 text-center", categoria ? "No hay publicaciones en esta categoría." : "Aún no hay publicaciones."));
        verMas.classList.toggle("hidden", desde >= r.total);
      } catch (e) {
        muro.replaceChildren(el("p", "text-red-600 text-sm col-span-full", e.message));
      } finally {
        verMas.disabled = false;
      }
    };
    verMas.addEventListener("click", () => cargar(false));
    await cargar(true);
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
    meta.append(el("span", "", "· " + [p.area, p.autor?.nombre].filter(Boolean).join(" · ")));
    caja.append(meta, el("h2", "text-2xl md:text-3xl font-bold text-gray-900 leading-snug", p.titulo));
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
        if (destino === "sitio") location.href = `/funcionarios/noticias-sitio.html?guardada=${encodeURIComponent(r.noticia.slug)}&regenerando=${r.regenerando ? 1 : 0}`;
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
        el("span", "", q.get("regenerando") === "1"
          ? "Noticia guardada. El sitio se está actualizando: estará visible en uno o dos minutos en "
          : "Noticia guardada. Aparecerá en el sitio en la próxima publicación del sitio: "),
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
      info.append(meta, el("p", "font-bold text-gray-800 text-sm", n.titulo), el("p", "text-xs text-gray-500 line-clamp-1", n.resumen));
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

  async "cambiar-clave"() {
    const u = await usuarioActual();
    if (u.debeCambiarClave) {
      $("#aviso-temporal").classList.remove("hidden");
      $("#volver-portal").classList.add("hidden");
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

    const mostrarClave = (u, clave) => {
      $('[data-campo="para"]', caja).textContent = `${u.nombre} (${formatearRut(u.rut)})`;
      $('[data-campo="clave"]', caja).textContent = clave;
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
    const celdaRol = (u) => {
      if (u.rut === yo.rut) return celda(NOMBRES_ROL[u.rol]);
      const td = document.createElement("td");
      td.className = "px-5 py-3";
      const s = document.createElement("select");
      s.className = "border-gray-300 rounded-custom py-1 pl-2 pr-8 text-sm";
      s.setAttribute("aria-label", `Rol de ${u.nombre}`);
      for (const [v, t] of Object.entries(NOMBRES_ROL)) s.append(new Option(t, v, false, v === u.rol));
      s.addEventListener("change", async () => {
        if (!confirm(`¿Cambiar el rol de ${u.nombre} a "${NOMBRES_ROL[s.value]}"?`)) return (s.value = u.rol);
        s.disabled = true;
        try {
          await api("/api/admin/usuarios", { metodo: "PATCH", datos: { rut: u.rut, accion: "editar", rol: s.value } });
          msg.classList.add("hidden");
          await cargar();
        } catch (err) {
          mensaje(msg, err.message);
          s.value = u.rol;
          s.disabled = false;
        }
      });
      td.append(s);
      return td;
    };

    const pintar = () => {
      const q = $("#filtro").value.trim().toLowerCase();
      const lista = usuarios.filter((u) =>
        !q || [u.nombre, u.rut, formatearRut(u.rut), u.cargo].some((x) => (x || "").toLowerCase().includes(q))
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
        acciones.append(boton("Restablecer clave", "restablecer", u.rut));
        if (u.rut !== yo.rut) {
          acciones.append(u.activo ? boton("Desactivar", "desactivar", u.rut, true) : boton("Activar", "activar", u.rut));
        }
        tr.append(
          celda(u.nombre, "font-semibold text-gray-800"),
          celda(formatearRut(u.rut), "whitespace-nowrap"),
          celda(u.cargo || "—"),
          celdaRol(u),
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
      $("#modo-clave").textContent = r.claveComunConfigurada
        ? `Las cuentas nuevas parten con la clave inicial común. Vence a las ${r.vigenciaHoras} horas si el funcionario no ingresa y la cambia.`
        : `Las cuentas nuevas reciben una clave temporal individual que se muestra una sola vez. Vence a las ${r.vigenciaHoras} horas si no se cambia.`;
      pintar();
    };

    $("#filtro").addEventListener("input", pintar);

    tabla.addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-accion]");
      if (!b) return;
      const u = usuarios.find((x) => x.rut === b.dataset.rut);
      const preguntas = {
        restablecer: `¿Generar una nueva contraseña temporal para ${u.nombre}? Su sesión actual se cerrará.`,
        desactivar: `¿Desactivar la cuenta de ${u.nombre}? No podrá ingresar hasta que se reactive.`,
      };
      if (preguntas[b.dataset.accion] && !confirm(preguntas[b.dataset.accion])) return;
      const datos = { rut: u.rut, accion: b.dataset.accion };
      b.disabled = true;
      try {
        const r = await api("/api/admin/usuarios", { metodo: "PATCH", datos });
        if (r.claveTemporal) mostrarClave(r.usuario, r.claveTemporal);
        msg.classList.add("hidden");
        await cargar();
      } catch (err) {
        mensaje(msg, err.message);
        b.disabled = false;
      }
    });

    const form = $("#form-nuevo");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rut = normalizarRut(form.rut.value);
      if (!rut) return mensaje(msg, "RUT inválido."), form.rut.focus();
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      try {
        const r = await api("/api/admin/usuarios", {
          metodo: "POST",
          datos: { rut, nombre: form.nombre.value, cargo: form.cargo.value, rol: form.rol.value },
        });
        form.reset();
        if (r.claveComun) {
          caja.classList.add("hidden");
          mensaje(msg, `Cuenta creada para ${r.usuario.nombre}. Debe ingresar con la clave inicial común antes del ${fecha(r.usuario.claveTemporalVence)} y cambiarla.`, "ok");
        } else {
          msg.classList.add("hidden");
          mostrarClave(r.usuario, r.claveTemporal);
        }
        await cargar();
      } catch (err) {
        mensaje(msg, err.message);
      } finally {
        btn.disabled = false;
      }
    });

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
