(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;
  var ok = document.getElementById("form-success");
  var error = document.getElementById("form-error");
  var boton = form.querySelector('button[type="submit"]');

  // Si el navegador envió el formulario sin JavaScript, Netlify redirige con ?enviado=1
  if (/[?&]enviado=1/.test(location.search)) ok.classList.remove("hidden");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ok.classList.add("hidden");
    error.classList.add("hidden");

    var valido = true;
    ["nombre", "email", "asunto", "mensaje", "privacidad"].forEach(function (id) {
      var el = document.getElementById(id);
      var bien = el.checkValidity();
      el.classList.toggle("border-red-400", !bien);
      el.setAttribute("aria-invalid", String(!bien));
      if (!bien && valido) el.focus();
      valido = valido && bien;
    });
    if (!valido) return;

    boton.disabled = true;
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(new FormData(form)).toString(),
    })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        ok.classList.remove("hidden");
        form.reset();
      })
      .catch(function () { error.classList.remove("hidden"); })
      .finally(function () { boton.disabled = false; });
  });
})();
