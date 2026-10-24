(function () {
  // Menú móvil
  var boton = document.getElementById("menu-toggle");
  var menu = document.getElementById("mobile-menu");
  var icono = document.getElementById("menu-icon");
  if (boton && menu) {
    boton.addEventListener("click", function () {
      var abierto = menu.classList.toggle("hidden") === false;
      boton.setAttribute("aria-expanded", String(abierto));
      icono.textContent = abierto ? "close" : "menu";
    });
  }

  // Submenús del menú móvil
  document.querySelectorAll(".mobile-submenu-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      var sub = document.getElementById(b.getAttribute("aria-controls"));
      var abierto = sub.classList.toggle("hidden") === false;
      b.setAttribute("aria-expanded", String(abierto));
      b.querySelector(".expand-icon").textContent = abierto ? "expand_less" : "expand_more";
    });
  });

  // Avisos con fecha de término: se ocultan apenas vencen, aunque el sitio aún no se haya regenerado
  var hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  document.querySelectorAll(".aviso[data-hasta]").forEach(function (a) {
    if (a.getAttribute("data-hasta") < hoy) a.remove();
  });

  // Banner rotativo de campañas: filtra por mes, rota cada 8 s, pausa al pasar el mouse o al enfocar
  document.querySelectorAll("[data-rotativo]").forEach(function (rot) {
    var mes = Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }).slice(5, 7));
    var laminas = [].slice.call(rot.querySelectorAll(".lamina"));
    var puntos = [].slice.call(rot.querySelectorAll("[data-ir]"));
    laminas.forEach(function (l, i) {
      var meses = (l.getAttribute("data-meses") || "").split(",").filter(Boolean).map(Number);
      if (meses.length && meses.indexOf(mes) < 0) { l.remove(); if (puntos[i]) puntos[i].remove(); l.fuera = true; }
    });
    laminas = laminas.filter(function (l) { return !l.fuera; });
    puntos = puntos.filter(function (p) { return p.isConnected; });
    if (!laminas.length) { rot.remove(); return; }
    var controles = rot.querySelector(".rotativo__controles");
    if (laminas.length < 2 && controles) controles.remove();
    var actual = 0, timer = null, pausado = false, sobre = false;
    var reducir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var pausa = rot.querySelector("[data-pausa]");
    function mostrar(i) {
      actual = (i + laminas.length) % laminas.length;
      laminas.forEach(function (l, j) {
        var activa = j === actual;
        l.classList.toggle("activa", activa);
        if (activa) { l.removeAttribute("aria-hidden"); l.removeAttribute("inert"); }
        else { l.setAttribute("aria-hidden", "true"); l.setAttribute("inert", ""); }
      });
      puntos.forEach(function (p, j) { p.setAttribute("aria-current", String(j === actual)); });
      rot.style.setProperty("--rot-tinta", getComputedStyle(laminas[actual]).color);
    }
    function programar() {
      clearInterval(timer);
      if (!pausado && !sobre && !reducir && laminas.length > 1) timer = setInterval(function () { mostrar(actual + 1); }, 8000);
    }
    mostrar(0);
    if (laminas.length < 2) return;
    rot.querySelector("[data-anterior]").addEventListener("click", function () { mostrar(actual - 1); programar(); });
    rot.querySelector("[data-siguiente]").addEventListener("click", function () { mostrar(actual + 1); programar(); });
    puntos.forEach(function (p, j) { p.addEventListener("click", function () { mostrar(j); programar(); }); });
    pausa.addEventListener("click", function () {
      pausado = !pausado;
      pausa.setAttribute("aria-label", pausado ? "Reanudar rotación" : "Pausar rotación");
      pausa.querySelector("span").textContent = pausado ? "play_arrow" : "pause";
      programar();
    });
    if (reducir) { pausado = true; pausa.querySelector("span").textContent = "play_arrow"; pausa.setAttribute("aria-label", "Reanudar rotación"); }
    rot.addEventListener("mouseenter", function () { sobre = true; programar(); });
    rot.addEventListener("mouseleave", function () { sobre = false; programar(); });
    rot.addEventListener("focusin", function () { sobre = true; programar(); });
    rot.addEventListener("focusout", function () { sobre = false; programar(); });
    programar();
  });

  // Enlaces de invitación/recuperación de Netlify Identity (usuarios del CMS):
  // el widget solo se carga cuando la URL trae uno de esos tokens.
  if (/(invite|recovery|confirmation|email_change)_token=/.test(location.hash)) {
    var s = document.createElement("script");
    s.src = "https://identity.netlify.com/v1/netlify-identity-widget.js";
    s.onload = function () {
      window.netlifyIdentity.on("login", function () { location.href = "/admin/"; });
    };
    document.head.appendChild(s);
  }
})();
