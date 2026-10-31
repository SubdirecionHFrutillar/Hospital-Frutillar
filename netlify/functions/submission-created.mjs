// Netlify ejecuta esta función con cada envío verificado (no spam) de Netlify Forms.
// Arma el correo con el diseño del hospital y adjunta la ficha en PDF.
// Usa la sintaxis clásica (handler) porque así se suscribe al evento por el nombre del archivo;
// Netlify firma el evento, así que no se puede invocar desde fuera.
//
// Variables de entorno (Netlify → Project configuration → Environment variables):
//   SMTP_HOST, SMTP_PORT (465), SMTP_USER, SMTP_PASS   servidor de correo (p. ej. Gmail con contraseña de aplicación)
//   CORREO_FORMULARIOS     destinatarios, separados por coma (por defecto pablo.merino@ssdr.gob.cl)
//   CORREO_CONTACTO / CORREO_ACTUALIZACION   destinatarios propios de cada formulario (opcional)
//   CORREO_REMITENTE       nombre y correo del remitente (por defecto "Hospital de Frutillar" <SMTP_USER>)
//   COPIA_AL_REMITENTE     "no" para no enviar la confirmación a quien completó el formulario (por defecto se envía)
//   CORREO_RESPONDER_A     a dónde llegan las respuestas a esa confirmación (por defecto, los mismos destinatarios)
//   COPIA_NO_RESPONDER     "si": la confirmación sale como correo automático que no recibe respuestas
//                          (sin Reply-To; usar como SMTP_USER un buzón "no responder")
//   CORREO_PARA_SEGUIMIENTO  correo que se indica en esa confirmación para agregar información (p. ej. el de la OIRS)
import nodemailer from "nodemailer";
import { prepararEnvio, asunto, asuntoCopia, correoHTML, correoTexto, fichaPDF } from "../lib/fichas.mjs";

const DESTINO_POR_DEFECTO = "pablo.merino@ssdr.gob.cl";
const POR_FORMULARIO = { contacto: "CORREO_CONTACTO", "actualizacion-datos": "CORREO_ACTUALIZACION" };
const env = (k) => process.env[k] || "";
const correoValido = (c) => /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(c || "");

export async function enviarFicha(payload, { transporte, sitio = env("URL") || "https://hospitalfrutillar.netlify.app", logo } = {}) {
  const e = prepararEnvio(payload);
  if (!e) return { omitido: `formulario desconocido: ${payload?.form_name}` };

  if (logo === undefined) {
    try {
      const r = await fetch(`${sitio}/img/logo-hospital.png`);
      logo = r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
    } catch {
      logo = null;
    }
  }
  const pdf = await fichaPDF(e, { logo });

  transporte ??= env("SMTP_HOST")
    ? nodemailer.createTransport({
        host: env("SMTP_HOST"),
        port: Number(env("SMTP_PORT") || 465),
        secure: Number(env("SMTP_PORT") || 465) === 465,
        auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
      })
    : null;
  if (!transporte) return { omitido: "SMTP no configurado (SMTP_HOST, SMTP_USER, SMTP_PASS)" };

  const para = env(POR_FORMULARIO[e.formulario]) || env("CORREO_FORMULARIOS") || DESTINO_POR_DEFECTO;
  const remitente = env("CORREO_REMITENTE") || `"Hospital de Frutillar" <${env("SMTP_USER")}>`;
  const info = await transporte.sendMail({
    from: remitente,
    to: para,
    replyTo: e.correo || undefined,
    subject: asunto(e),
    text: correoTexto(e),
    html: correoHTML(e, { sitio }),
    attachments: [{ filename: `${e.folio}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
  });
  const resultado = { enviado: info.messageId, para, folio: e.folio };

  // Confirmación a quien completó el formulario, con su comprobante (sin recuadro de uso interno)
  if (correoValido(e.correo) && env("COPIA_AL_REMITENTE").toLowerCase() !== "no") {
    try {
      const comprobante = await fichaPDF(e, { logo, comprobante: true });
      const noResponder = /^(si|sí|true|1)$/i.test(env("COPIA_NO_RESPONDER"));
      const opciones = { copia: true, noResponder, contacto: env("CORREO_PARA_SEGUIMIENTO") };
      const copia = await transporte.sendMail({
        from: remitente,
        to: e.correo,
        replyTo: noResponder ? undefined : env("CORREO_RESPONDER_A") || para,
        subject: asuntoCopia(e),
        text: correoTexto(e, opciones),
        html: correoHTML(e, { sitio, ...opciones }),
        attachments: [{ filename: `${e.folio}.pdf`, content: Buffer.from(comprobante), contentType: "application/pdf" }],
      });
      resultado.copia = copia.messageId;
    } catch (err) {
      resultado.copia = `error: ${err.message}`;
    }
  }
  return resultado;
}

export const handler = async (event) => {
  try {
    const { payload } = JSON.parse(event.body || "{}");
    const r = await enviarFicha(payload);
    console.log("[formularios]", JSON.stringify(r));
  } catch (e) {
    // El envío ya quedó guardado en Netlify → Forms; aquí solo falló el correo.
    console.error("[formularios] No se pudo enviar el correo:", e);
  }
  return { statusCode: 200, body: "ok" };
};
