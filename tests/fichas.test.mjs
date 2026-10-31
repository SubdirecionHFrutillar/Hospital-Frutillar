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
  assert.deepEqual(d.linea, ["Datos que cambiaron", "Dirección · Teléfono"]);
  assert.equal(d.secciones.find((s) => s.titulo === "Quién realiza el trámite"), undefined, "trámite personal no muestra solicitante");
  const ident = d.secciones.find((s) => s.titulo === "Identificación del paciente");
  assert.match(ident.campos.find((c) => c.etiqueta === "Fecha de nacimiento").valor, /^02-03-1948 \(\d+ años\)$/);
  assert.equal(ident.campos.some((c) => c.etiqueta === "Segundo apellido"), false);
  assert.equal(prepararEnvio({ form_name: "otro", data: {} }), null);
});

test("Correo: HTML escapado, cómo responder y texto plano", () => {
  const e = prepararEnvio(consulta);
  const html = correoHTML(e, { sitio: "https://sitio.test" });
  assert.match(html, /Patricia &lt;b&gt;Vargas&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Vargas/);
  assert.match(html, /le llega a paty@example.com/);
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
  assert.equal(r.para, "pablo.merino@ssdr.gob.cl");
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

test("Consulta en nombre de otra persona: sección Paciente y línea destacada", async () => {
  const p = { ...consulta, data: { ...consulta.data, nombre: "Ana Soto", consulta_sobre: "Sobre otra persona", paciente_nombre: "Juan Soto", paciente_rut: "4.567.890-3", paciente_relacion: "Hija o hijo" } };
  const e = prepararEnvio(p);
  assert.deepEqual(e.linea, ["En nombre de", "Juan Soto · quien escribe es: hija o hijo"]);
  assert.deepEqual(e.secciones.map((s) => s.titulo), ["Paciente", "Quien escribe"]);
  assert.match(correoHTML(e), /En nombre de<\/td>\s*<td[^>]*>Juan Soto/);
  const doc = await PDFDocument.load(await fichaPDF(e, { logo }));
  assert.equal(doc.getPageCount(), 1);
  // Sobre sí mismo: sin sección Paciente
  const propia = prepararEnvio(consulta);
  assert.equal(propia.linea, null);
  assert.deepEqual(propia.secciones.map((s) => s.titulo), ["Quien escribe"]);
});

test("Copia a quien envió: confirmación con folio, comprobante sin uso interno y respuestas al hospital", async () => {
  const enviados = [];
  const espia = { sendMail: async (m) => (enviados.push(m), { messageId: `id-${enviados.length}` }) };
  const r = await enviarFicha(consulta, { transporte: espia, logo });
  assert.equal(enviados.length, 2);
  const [interno, copia] = enviados;
  assert.equal(interno.to, "pablo.merino@ssdr.gob.cl");
  assert.equal(copia.to, "paty@example.com");
  assert.equal(copia.replyTo, "pablo.merino@ssdr.gob.cl");
  assert.equal(copia.subject, "Recibimos su consulta — Hospital de Frutillar [CON-2026-00012]");
  assert.match(copia.html, /Recibimos su consulta/);
  assert.doesNotMatch(copia.html, /le llega a/);
  assert.match(copia.text, /quedó registrada con el folio CON-2026-00012/);
  assert.equal(r.copia, "id-2");
  const comp = await PDFDocument.load(copia.attachments[0].content);
  assert.match(comp.getTitle(), /^Comprobante/);

  // Sin correo válido o con la copia desactivada: solo el correo interno
  enviados.length = 0;
  await enviarFicha({ ...consulta, data: { ...consulta.data, email: "no-es-correo" } }, { transporte: espia, logo });
  assert.equal(enviados.length, 1);
  enviados.length = 0;
  process.env.COPIA_AL_REMITENTE = "no";
  await enviarFicha(consulta, { transporte: espia, logo });
  delete process.env.COPIA_AL_REMITENTE;
  assert.equal(enviados.length, 1);

  // Si falla la copia, el correo interno ya salió y no se cae
  let n = 0;
  const fallaSegundo = { sendMail: async () => { if (++n === 2) throw new Error("buzón inexistente"); return { messageId: "ok" }; } };
  const r2 = await enviarFicha(consulta, { transporte: fallaSegundo, logo });
  assert.equal(r2.enviado, "ok");
  assert.match(r2.copia, /^error: buzón inexistente/);
});

test("Confirmación desde buzón 'no responder': sin Reply-To e indica a dónde escribir", async () => {
  const enviados = [];
  const espia = { sendMail: async (m) => (enviados.push(m), { messageId: "x" }) };
  process.env.COPIA_NO_RESPONDER = "si";
  process.env.CORREO_PARA_SEGUIMIENTO = "oirs.hfrutillar@ssdr.gob.cl";
  try {
    await enviarFicha(consulta, { transporte: espia, logo });
  } finally {
    delete process.env.COPIA_NO_RESPONDER;
    delete process.env.CORREO_PARA_SEGUIMIENTO;
  }
  const copia = enviados[1];
  assert.equal(copia.replyTo, undefined);
  assert.match(copia.html, /no recibe respuestas\. Si necesita agregar información, escriba a oirs\.hfrutillar@ssdr\.gob\.cl/);
  assert.match(copia.text, /no recibe respuestas/);
  assert.equal(enviados[0].replyTo, "paty@example.com", "el correo interno sigue respondiendo a quien escribió");
});
