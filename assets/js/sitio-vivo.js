// Noticias y avisos "en vivo": se publican desde el Portal Funcionarios y se ven al instante,
// sin regenerar el sitio. La página trae una copia del último build (sirve sin JavaScript y para
// buscadores); este script la reemplaza con lo vigente de /api/sitio-vivo (en caché del CDN).
// Las noticias antiguas en Markdown vienen en <script id="noticias-estaticas"> y se mezclan con las del portal.
(function () {
  var avisos = document.querySelector("[data-avisos]");
  var portada = document.querySelector("[data-noticias-portada]");
  var lista = document.querySelector("[data-noticias-lista]");
  if (!avisos && !portada && !lista) return;

  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var TZ = { timeZone: "America/Santiago" };
  var hoy = new Date().toLocaleDateString("en-CA", TZ);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // AAAA-MM-DD (Markdown) se toma tal cual; una fecha con hora se pasa a la hora de Chile.
  function diaISO(f) {
    var s = String(f || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var d = new Date(s);
    return isNaN(d) ? "" : d.toLocaleDateString("en-CA", TZ);
  }
  function fechaES(f) {
    var p = diaISO(f).split("-").map(Number);
    return p.length === 3 ? p[2] + " de " + MESES[p[1] - 1] + " de " + p[0] : "";
  }
  function cdn(url, ancho) {
    return url && url.charAt(0) === "/" ? "/.netlify/images?url=" + encodeURIComponent(url) + "&w=" + ancho + "&q=75" : url;
  }
  function imagen(n, ancho, clases, extra) {
    return '<img src="' + esc(cdn(n.imagen, ancho)) + '" onerror="this.onerror=null;this.src=\'' + esc(n.imagen) + '\'" alt="" ' + (extra || "") + ' class="' + clases + '">';
  }
  function fecha(n, clases) {
    return '<time datetime="' + esc(diaISO(n.fecha)) + '"' + (clases ? ' class="' + clases + '"' : "") + ">" + esc(fechaES(n.fecha)) + "</time>";
  }
  var SIN_FOTO = function (tam) {
    return '<div class="absolute inset-0 flex items-center justify-center" aria-hidden="true"><span class="material-symbols-outlined text-white/10 text-[' + tam + 'px] leading-none">article</span></div>';
  };

  // ---------- Avisos ----------
  function pintarAvisos(lista) {
    var vigentes = (lista || []).filter(function (a) { return a && a.texto && (!a.hasta || a.hasta >= hoy); });
    avisos.innerHTML = vigentes
      .map(function (a) {
        var imp = a.tipo === "importante";
        var enlace = a.url
          ? '<a href="' + esc(a.url) + '"' + (/^https?:/.test(a.url) ? ' target="_blank" rel="noopener"' : "") + ' class="font-bold underline underline-offset-2 whitespace-nowrap">Ver más</a>'
          : "";
        return (
          '<div class="aviso aviso--' + (imp ? "importante" : "info") + '"><div class="container mx-auto px-4 py-2.5 flex items-center gap-3 text-sm">' +
          '<span aria-hidden="true" class="material-symbols-outlined text-xl flex-shrink-0">' + (imp ? "campaign" : "info") + "</span>" +
          '<p class="flex-1 leading-snug"><strong class="font-bold">' + (imp ? "Importante" : "Aviso") + ":</strong> " + esc(a.texto) + "</p>" + enlace +
          "</div></div>"
        );
      })
      .join("");
    avisos.hidden = !vigentes.length;
  }

  // ---------- Noticias ----------
  function estaticas() {
    var s = document.getElementById("noticias-estaticas");
    try { return s ? JSON.parse(s.textContent) : []; } catch (e) { return []; }
  }
  function mezclar(delPortal) {
    var usadas = {};
    delPortal.forEach(function (n) { usadas[n.url] = true; });
    return delPortal
      .concat(estaticas().filter(function (n) { return !usadas[n.url]; }))
      .sort(function (a, b) { return diaYHora(b) - diaYHora(a); });
  }
  function diaYHora(n) {
    var s = String(n.fecha || "");
    return new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T12:00:00-03:00" : s).getTime() || 0;
  }

  function tarjeta(n) {
    return (
      '<article class="news-card bg-white rounded-custom shadow-sm overflow-hidden flex flex-col"><div class="bg-noticia relative h-36 overflow-hidden">' +
      (n.imagen ? imagen(n, 640, "w-full h-full object-cover", 'loading="lazy" decoding="async"') + '<div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>' : SIN_FOTO(80)) +
      '<span class="absolute top-2 left-2 px-2 py-0.5 bg-primary text-white text-[9px] font-bold uppercase tracking-wider rounded">' + esc(n.categoria) + "</span></div>" +
      '<div class="p-4 flex flex-col flex-1"><p class="text-xs text-gray-400 mb-1">' + fecha(n) + "</p>" +
      '<h3 class="font-bold text-gray-800 text-sm leading-snug mb-2 flex-1">' + esc(n.titulo) + "</h3>" +
      '<p class="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-3">' + esc(n.resumen) + "</p>" +
      '<a href="' + esc(n.url) + '" class="inline-flex items-center gap-1.5 text-primary text-xs font-bold hover:underline mt-auto">Leer más<span class="sr-only">: ' + esc(n.titulo) +
      '</span><span aria-hidden="true" class="material-symbols-outlined text-sm">arrow_forward</span></a></div></article>'
    );
  }

  function principal(n) {
    return (
      '<article class="news-card bg-white rounded-custom shadow-md overflow-hidden"><div class="bg-noticia relative h-52 md:h-60 overflow-hidden">' +
      (n.imagen ? imagen(n, 1000, "w-full h-full object-cover", 'decoding="async"') : SIN_FOTO(160)) +
      '<div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>' +
      '<span class="absolute top-3 left-3 px-2.5 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded shadow-md">' + esc(n.categoria) + "</span>" +
      '<div class="absolute bottom-3 left-4 flex items-center gap-1.5 text-white/80 text-xs"><span aria-hidden="true" class="material-symbols-outlined text-sm">calendar_today</span>' + fecha(n) + "</div></div>" +
      '<div class="p-5"><h3 class="text-xl md:text-2xl font-bold text-gray-900 leading-snug mb-2">' + esc(n.titulo) + "</h3>" +
      '<p class="text-sm text-gray-500 leading-relaxed mb-4">' + esc(n.resumen) + "</p>" +
      '<a href="' + esc(n.url) + '" class="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold px-4 py-2 rounded-custom transition-colors">Leer noticia <span aria-hidden="true" class="material-symbols-outlined text-base">arrow_forward</span></a></div></article>'
    );
  }

  function secundaria(n) {
    return (
      '<article class="news-card bg-white rounded-custom shadow-sm p-4 flex gap-4"><div class="w-11 h-11 rounded-custom bg-primary-bg flex items-center justify-center flex-shrink-0">' +
      '<span aria-hidden="true" class="material-symbols-outlined text-primary text-2xl">article</span></div><div class="flex flex-col justify-center gap-1">' +
      '<span class="px-2 py-0.5 bg-primary-bg text-primary text-[10px] font-bold uppercase tracking-wide rounded w-fit">' + esc(n.categoria) + "</span>" +
      '<h3 class="font-bold text-gray-800 text-sm leading-snug">' + esc(n.titulo) + "</h3>" +
      '<div class="flex items-center gap-3">' + fecha(n, "text-xs text-gray-400") +
      '<a href="' + esc(n.url) + '" class="text-xs font-bold text-primary hover:underline">Leer más<span class="sr-only">: ' + esc(n.titulo) + "</span> →</a></div></div></article>"
    );
  }

  function pintarPortada(todas) {
    // Destacadas primero, luego por fecha; máximo 5 (igual que la colección noticiasPortada)
    var lista5 = todas
      .slice()
      .sort(function (a, b) { return (b.destacada === true) - (a.destacada === true) || diaYHora(b) - diaYHora(a); })
      .slice(0, 5);
    portada.innerHTML = lista5.length
      ? lista5.map(function (n, i) { return i === 0 ? principal(n) : secundaria(n); }).join("")
      : '<p class="text-gray-500 text-center py-10">No hay noticias publicadas aún.</p>';
  }

  function pintarLista(todas) {
    lista.innerHTML = todas.length
      ? '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">' + todas.map(tarjeta).join("") + "</div>"
      : '<p class="text-gray-500 text-center py-16">No hay noticias publicadas aún.</p>';
  }

  // Sin respuesta, se queda la copia del build (solo se ocultan los avisos vencidos).
  if (avisos) pintarAvisosVencidos();
  function pintarAvisosVencidos() {
    [].forEach.call(avisos.querySelectorAll(".aviso[data-hasta]"), function (a) {
      if (a.getAttribute("data-hasta") < hoy) a.remove();
    });
    avisos.hidden = !avisos.querySelector(".aviso");
  }

  fetch("/api/sitio-vivo", { headers: { accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      if (avisos) pintarAvisos(d.avisos);
      if (portada || lista) {
        var todas = mezclar(d.noticias || []);
        if (portada) pintarPortada(todas);
        if (lista) pintarLista(todas);
      }
    })
    .catch(function () {});
})();
