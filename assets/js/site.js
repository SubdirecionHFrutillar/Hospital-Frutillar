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
