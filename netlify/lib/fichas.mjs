// Fichas de los formularios públicos (consultas y actualización de datos):
// correo con el diseño del hospital (HTML + texto) y ficha en PDF para imprimir o archivar.
// La usa la función submission-created, que Netlify ejecuta con cada envío verificado (no spam).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ---------- Definición de cada formulario ----------

const SI = (v) => (v ? "Sí" : "");

const porOtra = (d) => /otra persona/i.test(d.consulta_sobre || "");

export const FORMULARIOS = {
  contacto: {
    prefijo: "CON",
    titulo: "Consulta desde el sitio web",
    unidad: "OIRS",
    nombre: (d) => d.nombre,
    correo: (d) => d.email,
    etiqueta: (d) => d.asunto || "Consulta",
    linea: (d) => (porOtra(d) ? ["En nombre de", `${d.paciente_nombre || "otra persona"}${d.paciente_relacion ? ` · quien escribe es: ${d.paciente_relacion.toLowerCase()}` : ""}`] : null),
    secciones: [
      {
        titulo: "Paciente",
        soloSi: porOtra,
        campos: [["paciente_nombre", "Nombre"], ["paciente_rut", "RUT"], ["paciente_relacion", "Quien escribe es"]],
      },
      { titulo: "Quien escribe", campos: [["nombre", "Nombre"], ["rut", "RUT"], ["email", "Correo electrónico"], ["telefono", "Teléfono"]] },
    ],
    texto: { campo: "mensaje", titulo: "Mensaje" },
    nota: (d) => (/reclamo/i.test(d.asunto || "") ? "Plazo legal de respuesta a reclamos: 15 días hábiles desde su recepción (Ley N° 20.584)." : ""),
    usoInterno: ["N° de registro OIRS", "Derivado a", "Fecha de respuesta"],
    copia: {
      titulo: "Recibimos su consulta",
      intro: (e) =>
        `Gracias por escribirnos. Su solicitud (${e.etiqueta.toLowerCase()}) quedó registrada con el folio ${e.folio}. ` +
        "La Oficina de Informaciones, Reclamos y Sugerencias (OIRS) del Hospital de Frutillar la revisará y le responderá a este correo o por teléfono.",
    },
  },
  "actualizacion-datos": {
    prefijo: "ACT",
    titulo: "Actualización de datos del paciente",
    unidad: "Admisión (SOME)",
    nombre: (d) => [d.nombres, d.primer_apellido, d.segundo_apellido].filter(Boolean).join(" "),
    correo: (d) => d.correo,
    etiqueta: (d) => (d.tramite_para && /familiar/i.test(d.tramite_para) ? "Trámite por un familiar" : "Trámite personal"),
    secciones: [
      {
        titulo: "Quién realiza el trámite",
        soloSi: (d) => /familiar/i.test(d.tramite_para || ""),
        campos: [["solicitante_nombre", "Nombre"], ["solicitante_rut", "RUT"], ["solicitante_parentesco", "Parentesco"], ["solicitante_telefono", "Teléfono"]],
      },
      {
        titulo: "Identificación del paciente",
        campos: [
          ["rut", "RUT"], ["nombres", "Nombres"], ["primer_apellido", "Primer apellido"], ["segundo_apellido", "Segundo apellido"],
          ["nombre_social", "Nombre social"], ["fecha_nacimiento", "Fecha de nacimiento", fechaNacimiento], ["sexo", "Sexo registral"],
          ["nacionalidad", "Nacionalidad"], ["pueblo_originario", "Pueblo originario"],
        ],
      },
      {
        titulo: "Domicilio",
        campos: [["direccion", "Calle y número"], ["depto_block", "Depto., block o casa"], ["sector", "Villa, población o sector"], ["comuna", "Comuna"], ["zona", "Zona"], ["referencia_domicilio", "Referencia", null, true]],
      },
      { titulo: "Contacto y previsión", campos: [["telefono_celular", "Teléfono celular"], ["telefono_alternativo", "Otro teléfono"], ["prevision", "Previsión"], ["prais", "PRAIS", SI], ["correo", "Correo electrónico"]] },
      { titulo: "Contacto de emergencia", campos: [["emergencia_nombre", "Nombre"], ["emergencia_parentesco", "Parentesco"], ["emergencia_telefono", "Teléfono"]] },
    ],
    texto: { campo: "observaciones", titulo: "Observaciones" },
    linea: (d) => (lista(d.datos_que_cambian).length ? ["Datos que cambiaron", lista(d.datos_que_cambian).join(" · ")] : null),
    nota: () => "",
    usoInterno: ["Actualizado en sistema por", "Fecha", "Firma"],
    copia: {
      titulo: "Recibimos su actualización de datos",
      intro: (e) =>
        `Gracias. Su solicitud quedó registrada con el folio ${e.folio}. Admisión (SOME) revisará los datos y actualizará la ficha del paciente; si falta algo, le llamaremos.`,
      nota: "Si el paciente cambió de comuna, recuerde inscribirlo también en el CESFAM o CECOSF de su nuevo domicilio.",
    },
    columnas: 4,
  },
};

// ---------- Utilidades ----------

const lista = (v) => (Array.isArray(v) ? v : String(v ?? "").split(/\s*,\s*/)).map((x) => String(x).trim()).filter(Boolean);

function fechaNacimiento(v) {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  const [a, me, d] = m.slice(1).map(Number);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }).split("-").map(Number);
  const edad = hoy[0] - a - (hoy[1] < me || (hoy[1] === me && hoy[2] < d) ? 1 : 0);
  return `${m[3]}-${m[2]}-${m[1]} (${edad} años)`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fechaRecepcion(iso) {
  const f = new Date(iso || Date.now());
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(f)
      .map((x) => [x.type, x.value])
  );
  return { larga: `${Number(p.day)} de ${MESES[Number(p.month) - 1]} de ${p.year}, ${p.hour}:${p.minute} hrs`, corta: `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`, anio: p.year };
}

/** Toma el payload de Netlify (submission-created) y lo deja listo para el correo y el PDF. */
export function prepararEnvio(payload) {
  const def = FORMULARIOS[payload?.form_name];
  if (!def) return null;
  const crudo = payload.data || {};
  // Netlify puede entregar "datos_que_cambian[]" o "datos_que_cambian", como texto o lista
  const d = {};
  for (const [k, v] of Object.entries(crudo)) d[k.replace(/\[\]$/, "")] = Array.isArray(v) ? v : typeof v === "string" ? v.trim() : v;
  const fecha = fechaRecepcion(payload.created_at);
  const numero = payload.number ? String(payload.number).padStart(5, "0") : String(payload.id || "").slice(-6).toUpperCase() || "—";
  const secciones = def.secciones
    .filter((s) => !s.soloSi || s.soloSi(d))
    .map((s) => ({
      titulo: s.titulo,
      campos: s.campos
        .map(([k, etiqueta, fmt, ancho]) => ({ etiqueta, valor: String((fmt ? fmt(d[k]) : Array.isArray(d[k]) ? d[k].join(", ") : d[k]) ?? "").trim(), ancho: !!ancho }))
        .filter((c) => c.valor),
    }))
    .filter((s) => s.campos.length);
  return {
    formulario: payload.form_name,
    titulo: def.titulo,
    unidad: def.unidad,
    folio: `${def.prefijo}-${fecha.anio}-${numero}`,
    fecha,
    nombre: def.nombre(d) || "Sin nombre",
    correo: def.correo(d) || "",
    etiqueta: def.etiqueta(d),
    linea: def.linea ? def.linea(d) : null,
    secciones,
    texto: d[def.texto.campo] ? { titulo: def.texto.titulo, valor: String(d[def.texto.campo]) } : null,
    nota: def.nota(d),
    usoInterno: def.usoInterno,
    copia: def.copia,
    columnas: def.columnas || 3,
  };
}

export const asunto = (e) => `${e.titulo}: ${e.etiqueta} — ${e.nombre} [${e.folio}]`;
export const asuntoCopia = (e) => `${e.copia.titulo} — Hospital de Frutillar [${e.folio}]`;

// ---------- Correo HTML ----------

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const parrafos = (t) => esc(t).replace(/\r?\n/g, "<br>");

/** Correo interno (copia=false) o confirmación para quien envió el formulario (copia=true). Diseño sobrio, tipo memo. */
export function correoHTML(e, { sitio = "https://hospitalfrutillar.netlify.app", copia = false } = {}) {
  const F = "font-family:Helvetica,Arial,sans-serif;";
  const p = (html, extra = "") => `<p style="${F}margin:0 0 12px;font-size:15px;line-height:1.55;color:#1a1a1a;${extra}">${html}</p>`;
  const h2 = (t) => `<p style="${F}margin:26px 0 8px;font-size:13px;font-weight:bold;color:#1a1a1a;">${esc(t)}</p>`;
  const tabla = (campos) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">${campos
      .map(
        (c) => `<tr>
        <td style="${F}padding:3px 16px 3px 0;width:32%;vertical-align:top;font-size:14px;color:#6b6b6b;">${esc(c.etiqueta)}</td>
        <td style="${F}padding:3px 0;vertical-align:top;font-size:14px;color:#1a1a1a;">${parrafos(c.valor)}</td>
      </tr>`
      )
      .join("")}</table>`;
  const nota = copia ? e.copia.nota || e.nota : e.nota;
  const datos = [["Folio", e.folio], ["Recibido", e.fecha.larga], ...(e.linea ? [e.linea] : [])];

  const cuerpo = [
    copia ? p(esc(e.copia.intro(e))) : p(`${esc(e.etiqueta)}, de <strong>${esc(e.nombre)}</strong>.`),
    tabla(datos.map(([etiqueta, valor]) => ({ etiqueta, valor }))),
    e.texto ? h2(e.texto.titulo) + p(parrafos(e.texto.valor)) : "",
    ...e.secciones.map((s) => h2(s.titulo) + tabla(s.campos)),
    nota ? `<p style="${F}margin:24px 0 0;font-size:14px;line-height:1.5;color:#4a4a4a;">${esc(nota)}</p>` : "",
    copia
      ? `<p style="${F}margin:24px 0 0;font-size:14px;line-height:1.5;color:#4a4a4a;">Si necesita agregar información, responda este correo indicando su folio. Ante una emergencia vital llame al 131 o acuda a la Urgencia del hospital (24 horas). Se adjunta su comprobante en PDF.</p>`
      : `<p style="${F}margin:24px 0 0;font-size:14px;line-height:1.5;color:#4a4a4a;">${
          e.correo ? `Para responder, conteste este correo: le llega a ${esc(e.correo)}.` : "No dejó correo electrónico: responder por teléfono."
        } Se adjunta la ficha en PDF.</p>`,
  ].join("\n");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(copia ? asuntoCopia(e) : asunto(e))}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
  <tr><td>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;padding-right:12px;"><img src="${esc(sitio)}/img/logo-hospital.png" width="40" height="40" alt="" style="display:block;border:0;"></td>
      <td style="${F}vertical-align:middle;font-size:15px;line-height:1.3;color:#1a1a1a;"><strong>Hospital de Frutillar</strong><br><span style="font-size:13px;color:#6b6b6b;">Servicio de Salud del Reloncaví</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:20px 0 24px;"><div style="border-top:1px solid #e3e3e3;font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr><td>
    <h1 style="${F}margin:0 0 16px;font-size:20px;font-weight:bold;color:#1a1a1a;">${esc(copia ? e.copia.titulo : e.titulo)}</h1>
    ${cuerpo}
  </td></tr>
  <tr><td style="padding:28px 0 0;"><div style="border-top:1px solid #e3e3e3;font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr><td style="${F}padding-top:12px;font-size:12px;line-height:1.5;color:#8a8a8a;">
    Hospital de Frutillar · Av. Las Piedras S/N, Frutillar · (65) 2 421 000<br>
    ${copia ? "Mensaje automático enviado porque se ingresó este correo en un formulario del sitio web. Si usted no lo hizo, puede ignorarlo." : "Recibido mediante el formulario del sitio web. Contiene datos personales (Ley N° 19.628)."}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function correoTexto(e, { copia = false } = {}) {
  const out = copia
    ? [e.copia.titulo.toUpperCase(), "", e.copia.intro(e), "", `Folio: ${e.folio}`, `Recibido: ${e.fecha.larga}`, "", "COPIA DE LO QUE NOS ENVIÓ"]
    : [`${e.titulo.toUpperCase()} — ${e.etiqueta}`, `Folio: ${e.folio}`, `Recibido: ${e.fecha.larga}`];
  if (e.linea) out.push(`${e.linea[0]}: ${e.linea[1]}`);
  out.push("");
  if (e.texto) out.push(`${e.texto.titulo}:`, e.texto.valor, "");
  for (const s of e.secciones) {
    out.push(s.titulo.toUpperCase());
    for (const c of s.campos) out.push(`  ${c.etiqueta}: ${c.valor}`);
    out.push("");
  }
  const nota = copia ? e.copia.nota || e.nota : e.nota;
  if (nota) out.push(nota, "");
  out.push(copia ? "Se adjunta su comprobante en PDF. Si necesita agregar información, responda este correo indicando su folio." : "Se adjunta la ficha en PDF.");
  return out.join("\n");
}

// ---------- Ficha PDF ----------

const NEGRO = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.42, 0.42, 0.42);
const LINEA = rgb(0.85, 0.85, 0.85);

/** Ficha en PDF (A4), sobria. comprobante=true: versión para quien envió el formulario (sin uso interno). */
export async function fichaPDF(e, { logo, comprobante = false } = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${comprobante ? "Comprobante — " : ""}${e.titulo} — ${e.folio}`);
  doc.setAuthor("Hospital de Frutillar");
  doc.setSubject(`${e.etiqueta} · ${e.nombre}`);
  doc.setCreator("Sitio web Hospital de Frutillar");
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const neg = await doc.embedFont(StandardFonts.HelveticaBold);
  let img = null;
  try { if (logo) img = await doc.embedPng(logo); } catch { img = null; }

  // Solo caracteres que la fuente puede dibujar (WinAnsi); el resto se reemplaza.
  const juego = new Set(reg.getCharacterSet());
  const seguro = (t) =>
    [...String(t ?? "").normalize("NFC").replace(/\t/g, "  ")]
      .map((ch) => (ch === "\n" || juego.has(ch.codePointAt(0)) ? ch : "?"))
      .join("");

  const A4 = [595.28, 841.89];
  const M = 56;
  const ANCHO = A4[0] - 2 * M;
  const FONDO = M + 18; // el contenido no baja de aquí (el pie va debajo)
  let pag, y;

  const texto = (t, x, yy, { f = reg, t: tam = 10, c = NEGRO } = {}) => pag.drawText(seguro(t), { x, y: yy, size: tam, font: f, color: c });
  const ancho = (t, f, tam) => f.widthOfTextAtSize(seguro(t), tam);
  const regla = (yy) => pag.drawLine({ start: { x: M, y: yy }, end: { x: M + ANCHO, y: yy }, thickness: 0.5, color: LINEA });
  const envolver = (t, f, tam, max) => {
    const lineas = [];
    for (const parrafo of seguro(t).split(/\r?\n/)) {
      let linea = "";
      for (const palabra of parrafo.split(/ +/)) {
        const prueba = linea ? linea + " " + palabra : palabra;
        if (f.widthOfTextAtSize(prueba, tam) <= max) linea = prueba;
        else {
          if (linea) lineas.push(linea);
          let resto = palabra;
          while (f.widthOfTextAtSize(resto, tam) > max) {
            let n = resto.length;
            while (n > 1 && f.widthOfTextAtSize(resto.slice(0, n), tam) > max) n--;
            lineas.push(resto.slice(0, n));
            resto = resto.slice(n);
          }
          linea = resto;
        }
      }
      lineas.push(linea);
    }
    return lineas;
  };

  const nuevaPagina = (primera) => {
    pag = doc.addPage(A4);
    const top = A4[1] - M;
    if (primera) {
      if (img) pag.drawImage(img, { x: M, y: top - 36, width: 36, height: 36 });
      const tx = M + (img ? 46 : 0);
      texto("Hospital de Frutillar", tx, top - 15, { f: neg, t: 12 });
      texto("Servicio de Salud del Reloncaví", tx, top - 29, { t: 9, c: GRIS });
      const der = [`Folio ${e.folio}`, e.fecha.corta];
      der.forEach((l, i) => texto(l, M + ANCHO - ancho(l, reg, 9), top - 15 - i * 14, { t: 9, c: i ? GRIS : NEGRO }));
      y = top - 50;
    } else {
      texto(`${e.titulo} · Folio ${e.folio} (continuación)`, M, top - 10, { t: 9, c: GRIS });
      y = top - 20;
    }
    regla(y);
    y -= 28;
  };
  const asegurar = (alto) => { if (y - alto < FONDO) nuevaPagina(false); };

  nuevaPagina(true);

  // Título y datos de recepción
  for (const l of envolver(comprobante ? `Comprobante: ${e.titulo.toLowerCase()}` : e.titulo, neg, 15, ANCHO)) { texto(l, M, y, { f: neg, t: 15 }); y -= 20; }
  y -= 6;
  const meta = [["Recibido", `${e.fecha.larga}, sitio web`], ["Tipo", e.etiqueta], ["Para", e.unidad], ...(e.linea ? [e.linea] : [])];
  for (const [k, v] of meta) {
    const lineas = envolver(v, reg, 10, ANCHO - 110);
    texto(k, M, y, { t: 10, c: GRIS });
    lineas.forEach((l, i) => texto(l, M + 110, y - i * 14, { t: 10 }));
    y -= 14 * lineas.length + 2;
  }
  y -= 14;

  const titulo = (t) => {
    asegurar(40);
    texto(t, M, y, { f: neg, t: 10.5 });
    y -= 7;
    regla(y);
    y -= 16;
  };

  // Mensaje u observaciones, en texto corrido
  if (e.texto) {
    titulo(e.texto.titulo);
    for (const l of envolver(e.texto.valor, reg, 10.5, ANCHO)) {
      asegurar(15);
      texto(l, M, y, { t: 10.5 });
      y -= 15;
    }
    y -= 14;
  }

  // Secciones: etiqueta arriba, valor abajo, en columnas
  const N = e.columnas, GAP = 18;
  const COL = (ANCHO - GAP * (N - 1)) / N;
  for (const s of e.secciones) {
    titulo(s.titulo);
    const campos = [...s.campos];
    while (campos.length) {
      const fila = [];
      if (campos[0].ancho) fila.push(campos.shift());
      else while (fila.length < N && campos.length && !campos[0].ancho) fila.push(campos.shift());
      const w = fila[0].ancho ? ANCHO : COL;
      const bloques = fila.map((c) => envolver(c.valor, reg, 10, w));
      const alto = 12 + Math.max(...bloques.map((b) => b.length)) * 13;
      asegurar(alto);
      fila.forEach((c, i) => {
        const x = M + i * (COL + GAP);
        texto(c.etiqueta, x, y, { t: 8, c: GRIS });
        bloques[i].forEach((l, j) => texto(l, x, y - 12 - j * 13, { t: 10 }));
      });
      y -= alto + 8;
    }
    y -= 8;
  }

  const nota = comprobante ? e.copia?.nota || e.nota : e.nota;
  if (nota) {
    const lineas = envolver(nota, reg, 9, ANCHO);
    asegurar(lineas.length * 12 + 8);
    lineas.forEach((l) => { texto(l, M, y, { t: 9, c: GRIS }); y -= 12; });
    y -= 14;
  }

  // Uso interno: líneas para completar a mano (el comprobante no lo lleva)
  if (!comprobante) {
    asegurar(56);
    texto(`Uso interno ${e.unidad}`, M, y, { f: neg, t: 9, c: GRIS });
    y -= 30;
    const colI = (ANCHO - GAP * (e.usoInterno.length - 1)) / e.usoInterno.length;
    e.usoInterno.forEach((c, i) => {
      const x = M + i * (colI + GAP);
      pag.drawLine({ start: { x, y }, end: { x: x + colI, y }, thickness: 0.5, color: GRIS });
      texto(c, x, y - 11, { t: 8, c: GRIS });
    });
  }

  // Pie
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    pag = p;
    texto("Hospital de Frutillar · Av. Las Piedras S/N, Frutillar · (65) 2 421 000", M, M, { t: 7.5, c: GRIS });
    const der = `Página ${i + 1} de ${paginas.length}`;
    texto(der, M + ANCHO - ancho(der, reg, 7.5), M, { t: 7.5, c: GRIS });
  });

  return doc.save();
}
