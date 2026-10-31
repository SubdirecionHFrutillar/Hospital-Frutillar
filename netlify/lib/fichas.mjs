// Fichas de los formularios públicos (consultas y actualización de datos):
// correo con el diseño del hospital (HTML + texto) y ficha en PDF para imprimir o archivar.
// La usa la función submission-created, que Netlify ejecuta con cada envío verificado (no spam).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ---------- Definición de cada formulario ----------

const SI = (v) => (v ? "Sí" : "");

export const FORMULARIOS = {
  contacto: {
    prefijo: "CON",
    titulo: "Consulta desde el sitio web",
    unidad: "OIRS",
    nombre: (d) => d.nombre,
    correo: (d) => d.email,
    etiqueta: (d) => d.asunto || "Consulta",
    resumen: (d) => [["Nombre", d.nombre], ["RUT", d.rut], ["Correo", d.email], ["Teléfono", d.telefono]],
    secciones: [
      // En el PDF estos datos ya van en el recuadro de resumen
      { titulo: "Datos de la persona", soloCorreo: true, campos: [["nombre", "Nombre"], ["rut", "RUT"], ["email", "Correo electrónico"], ["telefono", "Teléfono"]] },
    ],
    texto: { campo: "mensaje", titulo: "Mensaje" },
    nota: (d) => (/reclamo/i.test(d.asunto || "") ? "Plazo legal de respuesta a reclamos: 15 días hábiles desde su recepción (Ley N° 20.584)." : ""),
    usoInterno: ["N° de registro OIRS", "Derivado a", "Fecha de respuesta"],
  },
  "actualizacion-datos": {
    prefijo: "ACT",
    titulo: "Actualización de datos del paciente",
    unidad: "Admisión (SOME)",
    nombre: (d) => [d.nombres, d.primer_apellido, d.segundo_apellido].filter(Boolean).join(" "),
    correo: (d) => d.correo,
    etiqueta: (d) => (d.tramite_para && /familiar/i.test(d.tramite_para) ? "Trámite por un familiar" : "Trámite personal"),
    resumen: (d) => [["Paciente", [d.nombres, d.primer_apellido, d.segundo_apellido].filter(Boolean).join(" ")], ["RUT", d.rut], ["Teléfono", d.telefono_celular]],
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
    cambios: (d) => lista(d.datos_que_cambian).join(" · "),
    nota: () => "",
    usoInterno: ["Actualizado en sistema por", "Fecha", "Firma"],
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
      soloCorreo: !!s.soloCorreo,
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
    cambios: def.cambios ? def.cambios(d) : "",
    resumen: def.resumen(d).map(([k, v]) => [k, String(v || "No indicado")]),
    secciones,
    texto: d[def.texto.campo] ? { titulo: def.texto.titulo, valor: String(d[def.texto.campo]) } : null,
    nota: def.nota(d),
    usoInterno: def.usoInterno,
    columnas: def.columnas || 3,
  };
}

/** Color de la etiqueta según el tipo de consulta. */
function tono(etiqueta) {
  const e = etiqueta.toLowerCase();
  if (e.includes("reclamo")) return { fondo: "#FDECEA", texto: "#B42318", borde: "#F5C2BC" };
  if (e.includes("felicita")) return { fondo: "#E8F5EC", texto: "#1E7B3C", borde: "#B9E0C4" };
  if (e.includes("familiar")) return { fondo: "#FFF4E0", texto: "#A15C00", borde: "#F5D7A1" };
  return { fondo: "#EEF4FB", texto: "#0B4F96", borde: "#CCE3F7" };
}

export const asunto = (e) => `${e.titulo}: ${e.etiqueta} — ${e.nombre} [${e.folio}]`;

// ---------- Correo HTML ----------

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const parrafos = (t) => esc(t).replace(/\r?\n/g, "<br>");

export function correoHTML(e, { sitio = "https://hospitalfrutillar.netlify.app" } = {}) {
  const t = tono(e.etiqueta);
  const F = "font-family:'Public Sans',Segoe UI,Helvetica,Arial,sans-serif;";
  const filas = (campos) =>
    campos
      .map(
        (c) => `<tr>
          <td style="${F}padding:7px 0;border-bottom:1px solid #EEF0F3;width:38%;vertical-align:top;font-size:12px;color:#6B7280;">${esc(c.etiqueta)}</td>
          <td style="${F}padding:7px 0;border-bottom:1px solid #EEF0F3;vertical-align:top;font-size:14px;color:#111827;font-weight:600;">${parrafos(c.valor)}</td>
        </tr>`
      )
      .join("");
  const secciones = e.secciones
    .map(
      (s) => `<tr><td style="padding:22px 32px 0;">
        <div style="${F}font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#0F69C4;border-left:3px solid #0F69C4;padding-left:8px;margin-bottom:6px;">${esc(s.titulo)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas(s.campos)}</table>
      </td></tr>`
    )
    .join("");
  const texto = e.texto
    ? `<tr><td style="padding:22px 32px 0;">
        <div style="${F}font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#0F69C4;border-left:3px solid #0F69C4;padding-left:8px;margin-bottom:8px;">${esc(e.texto.titulo)}</div>
        <div style="${F}background:#F6F8FB;border-left:3px solid #0A2A5E;border-radius:4px;padding:14px 16px;font-size:14px;line-height:1.6;color:#1F2937;">${parrafos(e.texto.valor)}</div>
      </td></tr>`
    : "";
  const boton = e.correo
    ? `<a href="mailto:${esc(e.correo)}?subject=${encodeURIComponent("Re: " + e.titulo + " [" + e.folio + "]")}" style="${F}display:inline-block;background:#0F69C4;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:4px;">Responder a ${esc(e.nombre.split(" ")[0])}</a>`
    : `<span style="${F}font-size:13px;color:#6B7280;">No dejó correo electrónico: responder por teléfono.</span>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(asunto(e))}</title></head>
<body style="margin:0;padding:0;background:#EEF1F5;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(e.etiqueta)} · ${esc(e.nombre)} · ${esc(e.fecha.larga)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F5;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(10,42,94,.08);">
  <tr><td style="padding:20px 32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="56" style="vertical-align:middle;"><img src="${esc(sitio)}/img/logo-hospital.png" width="52" height="52" alt="Hospital de Frutillar" style="display:block;border:0;"></td>
      <td style="${F}vertical-align:middle;padding-left:12px;">
        <div style="font-size:17px;font-weight:800;color:#0A2A5E;line-height:1.2;">Hospital de Frutillar</div>
        <div style="font-size:12px;color:#6B7280;">Servicio de Salud del Reloncaví</div>
      </td>
      <td align="right" style="${F}vertical-align:middle;">
        <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:#9CA3AF;text-transform:uppercase;">Folio</div>
        <div style="font-size:15px;font-weight:800;color:#0F69C4;white-space:nowrap;">${esc(e.folio)}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 32px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="56" height="4" style="background:#0F69C4;font-size:0;line-height:0;">&nbsp;</td><td width="56" height="4" style="background:#DA291C;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
  <tr><td style="padding:20px 32px 4px;">
    <span style="${F}display:inline-block;background:${t.fondo};color:${t.texto};border:1px solid ${t.borde};font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;padding:4px 10px;border-radius:999px;">${esc(e.etiqueta)}</span>
    <h1 style="${F}margin:10px 0 4px;font-size:22px;line-height:1.25;color:#0A2A5E;">${esc(e.titulo)}</h1>
    <div style="${F}font-size:13px;color:#6B7280;">De <strong style="color:#111827;">${esc(e.nombre)}</strong> · ${esc(e.fecha.larga)} · para ${esc(e.unidad)}</div>
    ${e.cambios ? `<div style="${F}font-size:13px;color:#111827;margin-top:6px;"><strong>Datos que cambiaron:</strong> ${esc(e.cambios)}</div>` : ""}
  </td></tr>
  ${texto}
  ${secciones}
  ${e.nota ? `<tr><td style="padding:20px 32px 0;"><div style="${F}background:#FFF8E6;border:1px solid #F5D7A1;border-radius:4px;padding:10px 14px;font-size:13px;color:#7A4B00;">${esc(e.nota)}</div></td></tr>` : ""}
  <tr><td style="padding:24px 32px 26px;">${boton}
    <div style="${F}font-size:12px;color:#6B7280;margin-top:12px;">Se adjunta la ficha en PDF (${esc(e.folio)}.pdf) para imprimir o archivar.</div>
  </td></tr>
  <tr><td style="${F}background:#F6F8FB;border-top:1px solid #E5E7EB;padding:14px 32px;font-size:11px;color:#9CA3AF;line-height:1.5;">
    Recibido mediante el formulario del sitio web del Hospital de Frutillar. Contiene datos personales: tratar con reserva (Ley N° 19.628).
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function correoTexto(e) {
  const out = [`${e.titulo.toUpperCase()} — ${e.etiqueta}`, `Folio: ${e.folio}`, `Recibido: ${e.fecha.larga}`];
  if (e.cambios) out.push(`Datos que cambiaron: ${e.cambios}`);
  out.push("");
  if (e.texto) out.push(`${e.texto.titulo}:`, e.texto.valor, "");
  for (const s of e.secciones) {
    out.push(s.titulo.toUpperCase());
    for (const c of s.campos) out.push(`  ${c.etiqueta}: ${c.valor}`);
    out.push("");
  }
  if (e.nota) out.push(e.nota, "");
  out.push("Se adjunta la ficha en PDF.");
  return out.join("\n");
}

// ---------- Ficha PDF ----------

const C = {
  tinta: rgb(0.067, 0.094, 0.153),
  gris: rgb(0.42, 0.45, 0.5),
  grisClaro: rgb(0.9, 0.91, 0.93),
  fondo: rgb(0.965, 0.973, 0.984),
  azul: rgb(0.059, 0.412, 0.769),
  marino: rgb(0.039, 0.165, 0.369),
  rojo: rgb(0.855, 0.161, 0.11),
  blanco: rgb(1, 1, 1),
};
const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/** Ficha en PDF (A4). logo: bytes PNG opcionales. */
export async function fichaPDF(e, { logo } = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${e.titulo} — ${e.folio}`);
  doc.setAuthor("Hospital de Frutillar");
  doc.setSubject(`${e.etiqueta} · ${e.nombre}`);
  doc.setCreator("Sitio web Hospital de Frutillar");
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const neg = await doc.embedFont(StandardFonts.HelveticaBold);
  let img = null;
  try { if (logo) img = await doc.embedPng(logo); } catch { img = null; }

  // Solo caracteres que la fuente puede dibujar (WinAnsi); el resto se reemplaza.
  const juego = new Set(reg.getCharacterSet());
  const seguro = (s) =>
    [...String(s ?? "").normalize("NFC").replace(/\t/g, "  ")]
      .map((ch) => (ch === "\n" || juego.has(ch.codePointAt(0)) ? ch : ch === "≥" ? ">=" : "?"))
      .join("");

  const A4 = [595.28, 841.89];
  const M = 48; // margen
  const ANCHO = A4[0] - 2 * M;
  let pag, y;

  const texto = (t, x, yy, { f = reg, t: tam = 10, c = C.tinta } = {}) => pag.drawText(seguro(t), { x, y: yy, size: tam, font: f, color: c });
  const ancho = (t, f, tam) => f.widthOfTextAtSize(seguro(t), tam);
  const envolver = (t, f, tam, max) => {
    const lineas = [];
    for (const parrafo of seguro(t).split(/\r?\n/)) {
      let linea = "";
      for (const palabra of parrafo.split(/ +/)) {
        const prueba = linea ? linea + " " + palabra : palabra;
        if (f.widthOfTextAtSize(prueba, tam) <= max) linea = prueba;
        else {
          if (linea) lineas.push(linea);
          // palabra más larga que la línea: se corta
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
  const rectRedondo = (x, yy, w, h, r, opts) =>
    pag.drawSvgPath(`M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`, { x, y: yy + h, ...opts });

  function encabezado(primera) {
    pag = doc.addPage(A4);
    const top = A4[1] - M;
    if (primera) {
      if (img) pag.drawImage(img, { x: M, y: top - 54, width: 54, height: 54 });
      const tx = M + (img ? 66 : 0);
      texto("Hospital de Frutillar", tx, top - 22, { f: neg, t: 16, c: C.marino });
      texto("Servicio de Salud del Reloncaví · Región de Los Lagos", tx, top - 37, { t: 9, c: C.gris });
      texto("Av. Las Piedras S/N, Frutillar · (65) 2 421 000", tx, top - 49, { t: 9, c: C.gris });
      const r = A4[0] - M;
      texto("FOLIO", r - ancho("FOLIO", neg, 7.5), top - 14, { f: neg, t: 7.5, c: C.gris });
      texto(e.folio, r - ancho(e.folio, neg, 14), top - 31, { f: neg, t: 14, c: C.azul });
      texto(e.fecha.corta, r - ancho(e.fecha.corta, reg, 9), top - 45, { t: 9, c: C.gris });
      y = top - 66;
    } else {
      texto(`${e.titulo} — ${e.folio} (continuación)`, M, top - 10, { f: neg, t: 9, c: C.gris });
      y = top - 20;
    }
    // Franja gob.cl
    pag.drawRectangle({ x: M, y, width: 44, height: 3.5, color: C.azul });
    pag.drawRectangle({ x: M + 44, y, width: 44, height: 3.5, color: C.rojo });
    pag.drawRectangle({ x: M + 88, y: y + 1.25, width: ANCHO - 88, height: 0.75, color: C.grisClaro });
    y -= 22;
  }
  // El pie ocupa hasta M + 14; el contenido no baja de M + 16.
  const asegurar = (alto) => { if (y - alto < M + 16) encabezado(false); };

  encabezado(true);

  // Etiqueta + título
  const t = tono(e.etiqueta);
  const et = seguro(e.etiqueta.toUpperCase());
  const anchoEt = ancho(et, neg, 8) + 16;
  rectRedondo(M, y - 12, anchoEt, 16, 8, { color: hex(t.fondo), borderColor: hex(t.borde), borderWidth: 0.75 });
  texto(et, M + 8, y - 7, { f: neg, t: 8, c: hex(t.texto) });
  y -= 36;
  for (const l of envolver(e.titulo, neg, 20, ANCHO)) { texto(l, M, y, { f: neg, t: 20, c: C.marino }); y -= 24; }
  texto(`Recibido el ${e.fecha.larga} a través del sitio web · Para ${e.unidad}`, M, y + 6, { t: 9.5, c: C.gris });
  if (e.cambios) {
    y -= 10;
    texto("Datos que cambiaron:", M, y, { f: neg, t: 9.5, c: C.tinta });
    texto(e.cambios, M + ancho("Datos que cambiaron: ", neg, 9.5), y, { t: 9.5, c: C.tinta });
  }
  y -= 22;

  // Resumen (2 líneas como máximo por dato)
  // Ancho de cada columna proporcional a su contenido (un correo largo no se corta si hay espacio)
  const natural = e.resumen.map(([k, v]) => Math.max(ancho(v, neg, 10), ancho(k.toUpperCase(), neg, 7), 50) + 24);
  const escala = ANCHO / natural.reduce((a, b) => a + b, 0);
  const colsR = natural.map((n) => n * escala);
  const xsR = colsR.map((_, i) => M + 14 + colsR.slice(0, i).reduce((a, b) => a + b, 0));
  const valores = e.resumen.map(([, v], i) => envolver(v, neg, 10, colsR[i] - 22).slice(0, 2));
  const altoR = 30 + Math.max(...valores.map((v) => v.length)) * 13;
  rectRedondo(M, y - altoR + 6, ANCHO, altoR, 4, { color: C.fondo, borderColor: C.grisClaro, borderWidth: 0.75 });
  e.resumen.forEach(([et2], i) => {
    const x = xsR[i];
    texto(et2.toUpperCase(), x, y - 12, { f: neg, t: 7, c: C.gris });
    valores[i].forEach((l, j) => texto(l, x, y - 27 - j * 13, { f: neg, t: 10, c: C.tinta }));
  });
  y -= altoR + 14;

  const tituloSeccion = (s) => {
    asegurar(46);
    pag.drawRectangle({ x: M, y: y - 2, width: 3, height: 11, color: C.azul });
    texto(s.toUpperCase(), M + 9, y, { f: neg, t: 8.5, c: C.azul });
    y -= 18;
  };

  // Texto libre (mensaje / observaciones): bloque con fondo y barra lateral; puede seguir en otra página
  if (e.texto) {
    tituloSeccion(e.texto.titulo);
    const lineas = envolver(e.texto.valor, reg, 10.5, ANCHO - 30);
    const LH = 15, PAD = 9;
    const franja = (alto) => {
      pag.drawRectangle({ x: M, y: y - alto, width: ANCHO, height: alto, color: C.fondo });
      pag.drawRectangle({ x: M, y: y - alto, width: 3, height: alto, color: C.marino });
      y -= alto;
    };
    asegurar(LH + 2 * PAD);
    franja(PAD);
    for (const l of lineas) {
      if (y - LH < M + 16) { encabezado(false); franja(PAD); }
      franja(LH);
      texto(l, M + 16, y + 4, { t: 10.5, c: C.tinta });
    }
    franja(PAD);
    y -= 22;
  }

  // Secciones en columnas (3 o 4 según el formulario; los campos largos ocupan todo el ancho)
  const N = e.columnas, GAP = 14;
  const COL = (ANCHO - GAP * (N - 1)) / N;
  for (const s of e.secciones.filter((x) => !x.soloCorreo)) {
    tituloSeccion(s.titulo);
    const campos = [...s.campos];
    while (campos.length) {
      const fila = [];
      if (campos[0].ancho) fila.push(campos.shift());
      else while (fila.length < N && campos.length && !campos[0].ancho) fila.push(campos.shift());
      const w = fila[0].ancho ? ANCHO : COL;
      const bloques = fila.map((c) => envolver(c.valor, neg, 10, w));
      const alto = 11 + Math.max(...bloques.map((b) => b.length)) * 13 + 3;
      asegurar(alto + 6);
      fila.forEach((c, i) => {
        const x = M + i * (COL + GAP);
        texto(c.etiqueta.toUpperCase(), x, y, { f: neg, t: 6.8, c: C.gris });
        bloques[i].forEach((l, j) => texto(l, x, y - 12.5 - j * 13, { f: neg, t: 10, c: C.tinta }));
      });
      y -= alto;
      pag.drawRectangle({ x: M, y: y + 3, width: ANCHO, height: 0.6, color: C.grisClaro });
      y -= 6;
    }
    y -= 6;
  }

  // Nota
  if (e.nota) {
    const lineas = envolver(e.nota, reg, 9.5, ANCHO - 24);
    const alto = lineas.length * 13 + 14;
    asegurar(alto + 10);
    rectRedondo(M, y - alto + 10, ANCHO, alto, 4, { color: hex("#FFF8E6"), borderColor: hex("#F5D7A1"), borderWidth: 0.75 });
    lineas.forEach((l, i) => texto(l, M + 12, y - 4 - i * 13, { t: 9.5, c: hex("#7A4B00") }));
    y -= alto + 16;
  }

  // Uso interno (para completar a mano)
  asegurar(42);
  pag.drawRectangle({ x: M, y: y - 42, width: ANCHO, height: 48, borderColor: C.grisClaro, borderWidth: 0.9, borderDashArray: [3, 2] });
  texto(`USO INTERNO — ${e.unidad.toUpperCase()}`, M + 12, y - 7, { f: neg, t: 7, c: C.gris });
  const colI = (ANCHO - 24) / e.usoInterno.length;
  e.usoInterno.forEach((c, i) => {
    const x = M + 12 + i * colI;
    pag.drawRectangle({ x, y: y - 28, width: colI - 16, height: 0.6, color: C.gris });
    texto(c, x, y - 38, { t: 7.5, c: C.gris });
  });

  // Pie en todas las páginas
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    pag = p;
    pag.drawRectangle({ x: M, y: M + 14, width: ANCHO, height: 0.6, color: C.grisClaro });
    texto("Recibido mediante el formulario del sitio web del Hospital de Frutillar. Contiene datos personales (Ley N° 19.628).", M, M, { t: 7.5, c: C.gris });
    const der = `${e.folio} · Página ${i + 1} de ${paginas.length}`;
    texto(der, A4[0] - M - ancho(der, reg, 7.5), M, { t: 7.5, c: C.gris });
  });

  return doc.save();
}
