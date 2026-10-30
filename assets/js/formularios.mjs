// Formularios públicos (Netlify Forms): consultas y actualización de datos.
// Valida en el navegador (incluido el RUT), muestra secciones condicionales y envía sin recargar.
// Sin JavaScript, el formulario se envía igual y Netlify vuelve a la página con ?enviado=1.
import { normalizarRut, formatearRut } from "./rut.mjs";

// Un enlace a #id de un <details> (p. ej. /contacto.html#actualiza-tus-datos) lo abre.
const abrirDesdeEnlace = () => {
  const d = location.hash && document.querySelector(`details#${CSS.escape(location.hash.slice(1))}`);
  if (d) { d.open = true; d.scrollIntoView(); }
};
abrirDesdeEnlace();
addEventListener("hashchange", abrirDesdeEnlace);

for (const form of document.querySelectorAll("form[data-formulario]")) {
  const ok = form.querySelector("[data-ok]");
  const err = form.querySelector("[data-error]");
  const errTexto = form.querySelector("[data-error-texto]");
  const textoErrorBase = errTexto?.textContent;
  const boton = form.querySelector('button[type="submit"]');

  if (/[?&]enviado=1/.test(location.search) && form.action.includes(location.pathname)) ok?.classList.remove("hidden");

  // Secciones que aparecen según una respuesta: data-mostrar-si="campo=valor".
  // Sus campos se deshabilitan mientras están ocultas (no se validan ni se envían).
  const condicionales = [...form.querySelectorAll("[data-mostrar-si]")];
  const actualizar = () => {
    for (const s of condicionales) {
      const [campo, valor] = s.dataset.mostrarSi.split("=");
      const visible = new FormData(form).getAll(campo).includes(valor);
      s.hidden = !visible;
      s.querySelectorAll("input, select, textarea").forEach((el) => (el.disabled = !visible));
    }
  };
  form.addEventListener("change", actualizar);
  actualizar();

  // RUT: se da formato al salir del campo
  for (const el of form.querySelectorAll("[data-rut]")) {
    el.addEventListener("blur", () => {
      const n = normalizarRut(el.value);
      if (n) el.value = formatearRut(n);
    });
  }

  const marcar = (el, bien) => {
    el.classList.toggle("border-red-400", !bien);
    el.toggleAttribute("aria-invalid", !bien);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    ok?.classList.add("hidden");
    err?.classList.add("hidden");

    let primero = null;
    for (const el of form.querySelectorAll("input, select, textarea")) {
      if (el.disabled || el.type === "hidden" || el.name === "bot-field") continue;
      let bien = el.checkValidity();
      if (bien && el.hasAttribute("data-rut") && el.value.trim()) {
        const n = normalizarRut(el.value);
        bien = !!n;
        if (n) el.value = formatearRut(n);
      }
      marcar(el, bien);
      if (!bien && !primero) primero = el;
    }
    if (primero) {
      if (errTexto) errTexto.textContent = "Revise los campos marcados en rojo" + (primero.hasAttribute("data-rut") ? " (el RUT no es válido)." : ".");
      err?.classList.remove("hidden");
      primero.focus();
      return;
    }

    boton.disabled = true;
    try {
      const r = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!r.ok) throw new Error(String(r.status));
      form.reset();
      actualizar();
      ok?.classList.remove("hidden");
      ok?.focus?.();
    } catch {
      if (errTexto) errTexto.textContent = textoErrorBase;
      err?.classList.remove("hidden");
    } finally {
      boton.disabled = false;
    }
  });
}
