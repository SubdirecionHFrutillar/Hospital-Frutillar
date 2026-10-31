// Pruebas del correo y la ficha PDF de los formularios públicos.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PDFDocument } from "pdf-lib";
import nodemailer from "nodemailer";
import { prepararEnvio, correoHTML, correoTexto, fichaPDF, asunto } from "../netlify/lib/fichas.mjs";
import { enviarFicha } from "../netlify/functions/submission-created.mjs";

const logo = fs.readFileSync(new URL("../img/logo-hospital.png", import.meta.url));
const consulta = {
  form_name: "contacto", number: 12, created_at: "2026-10-30T23:47:00Z",
  data: { nombre: "Patricia <b>Vargas</b>", rut: "8.635.166-8", email: "paty@example.com", asunto: "Reclamo o sugerencia", mensaje: "Línea 1\nLínea 2 con emoji 😀 y “comillas”", ip: "1.2.3.4" },
};
const datos = {
  form_name: "actualizacion-datos", id: "6720abcdef123456", created_at: "2026-10-30T12:00:00Z",
  data: { tramite_para: "Para mí", rut: "12.345.678-5", nombres: "Juan", primer_apellido: "Soto", fecha_nacimiento: "1948-03-02", comuna: "Frutillar", "datos_que_cambian[]": ["Dirección", "Teléfono"], prais: "Sí" },
};

test("Preparar envío: folio, hora de Chile, secciones y campos vacíos fuera", () => {
  const e = prepararEnvio(consulta);
  assert.equal(e.folio, "CON-2026-00012");
  assert.match(e.fecha.larga, /30 de octubre de 2026, 20:47 hrs/);
  assert.match(e.nota, /15 días hábiles/);
  assert.equal(e.correo, "paty@example.com");

  const d = prepararEnvio(datos);
  assert.equal(d.folio, "ACT-2026-123456", "sin número usa el id");
  assert.equal(d.cambios, "Dirección · Teléfono");
  assert.equal(d.secciones.find((s) => s.titulo === "Quién realiza el trámite"), undefined, "trámite personal no muestra solicitante");
  const ident = d.secciones.find((s) => s.titulo === "Identificación del paciente");
  assert.match(ident.campos.find((c) => c.etiqueta === "Fecha de nacimiento").valor, /^02-03-1948 \(\d+ años\)$/);
  assert.equal(ident.campos.some((c) => c.etiqueta === "Segundo apellido"), false);
  assert.equal(prepararEnvio({ form_name: "otro", data: {} }), null);
});

test("Correo: HTML escapado, botón de respuesta y texto plano", () => {
  const e = prepararEnvio(consulta);
  const html = correoHTML(e, { sitio: "https://sitio.test" });
  assert.match(html, /Patricia &lt;b&gt;Vargas&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Vargas/);
  assert.match(html, /mailto:paty@example.com/);
  assert.match(html, /https:\/\/sitio.test\/img\/logo-hospital.png/);
  assert.match(html, /Línea 1<br>Línea 2/);
  assert.match(correoTexto(e), /Folio: CON-2026-00012/);
  assert.match(asunto(e), /^Consulta desde el sitio web: Reclamo o sugerencia — .* \[CON-2026-00012\]$/);
});

test("Ficha PDF: válida, con metadatos y sin fallar por caracteres fuera de la fuente", async () => {
  for (const p of [consulta, datos]) {
    const bytes = await fichaPDF(prepararEnvio(p), { logo });
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 1);
    assert.match(doc.getTitle(), /CON-|ACT-/);
  }
  // Mensaje muy largo → varias páginas
  const largo = { ...consulta, data: { ...consulta.data, mensaje: "Texto largo de prueba. ".repeat(600) } };
  const doc = await PDFDocument.load(await fichaPDF(prepararEnvio(largo), { logo: null }));
  assert.ok(doc.getPageCount() >= 2);
});

test("Envío: destinatario por defecto, responder-a y PDF adjunto; sin SMTP no envía", async () => {
  const transporte = nodemailer.createTransport({ jsonTransport: true });
  const r = await enviarFicha(consulta, { transporte, logo, sitio: "https://sitio.test" });
  assert.equal(r.para, "pablomerino@ssdr.gob.cl");
  assert.equal(r.folio, "CON-2026-00012");

  let enviado;
  const espia = { sendMail: async (m) => ((enviado = m), { messageId: "x" }) };
  process.env.CORREO_ACTUALIZACION = "some@hospital.test";
  await enviarFicha(datos, { transporte: espia, logo });
  delete process.env.CORREO_ACTUALIZACION;
  assert.equal(enviado.to, "some@hospital.test", "destinatario propio del formulario");
  assert.equal(enviado.replyTo, undefined);
  assert.equal(enviado.attachments[0].filename, "ACT-2026-123456.pdf");
  assert.equal(enviado.attachments[0].content.subarray(0, 4).toString(), "%PDF");

  const sinSmtp = await enviarFicha(consulta, { logo });
  assert.match(sinSmtp.omitido, /SMTP no configurado/);
});
