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
        const estado = celda(u.activo ? (u.debeCambiarClave ? "Clave temporal" : "Activa") : "Desactivada");
        const acciones = document.createElement("td");
        acciones.className = "px-5 py-3 text-right whitespace-nowrap space-x-3";
        acciones.append(boton("Restablecer clave", "restablecer", u.rut));
        if (u.rut !== yo.rut) {
          acciones.append(
            boton(u.rol === "admin" ? "Quitar admin" : "Hacer admin", "rol", u.rut),
            u.activo ? boton("Desactivar", "desactivar", u.rut, true) : boton("Activar", "activar", u.rut)
          );
        }
        tr.append(
          celda(u.nombre, "font-semibold text-gray-800"),
          celda(formatearRut(u.rut), "whitespace-nowrap"),
          celda(u.cargo || "—"),
          celda(u.rol === "admin" ? "Administrador" : "Funcionario"),
          estado,
          celda(fecha(u.ultimoAcceso), "whitespace-nowrap"),
          acciones
        );
        tabla.append(tr);
      }
    };

    const cargar = async () => {
      usuarios = (await api("/api/admin/usuarios")).usuarios;
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
        rol: u.rol === "admin" ? `¿Quitar el rol de administrador a ${u.nombre}?` : `¿Dar rol de administrador a ${u.nombre}?`,
      };
      if (preguntas[b.dataset.accion] && !confirm(preguntas[b.dataset.accion])) return;
      const datos = b.dataset.accion === "rol"
        ? { rut: u.rut, accion: "editar", rol: u.rol === "admin" ? "funcionario" : "admin" }
        : { rut: u.rut, accion: b.dataset.accion };
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
        msg.classList.add("hidden");
        mostrarClave(r.usuario, r.claveTemporal);
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
