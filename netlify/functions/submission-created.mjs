// Netlify ejecuta esta función con cada envío verificado (no spam) de Netlify Forms.
// Arma el correo con el diseño del hospital y adjunta la ficha en PDF.
// Usa la sintaxis clásica (handler) porque así se suscribe al evento por el nombre del archivo;
// Netlify firma el evento, así que no se puede invocar desde fuera.
//
// Variables de entorno (Netlify → Project configuration → Environment variables):
//   SMTP_HOST, SMTP_PORT (465), SMTP_USER, SMTP_PASS   servidor de correo (p. ej. Gmail con contraseña de aplicación)
//   CORREO_FORMULARIOS     destinatarios, separados por coma (por defecto pablomerino@ssdr.gob.cl)
//   CORREO_CONTACTO / CORREO_ACTUALIZACION   destinatarios propios de cada formulario (opcional)
//   CORREO_REMITENTE       nombre y correo del remitente (por defecto "Sitio web Hospital de Frutillar" <SMTP_USER>)
import nodemailer from "nodemailer";
import { prepararEnvio, asunto, correoHTML, correoTexto, fichaPDF } from "../lib/fichas.mjs";

const DESTINO_POR_DEFECTO = "pablomerino@ssdr.gob.cl";
const POR_FORMULARIO = { contacto: "CORREO_CONTACTO", "actualizacion-datos": "CORREO_ACTUALIZACION" };
const env = (k) => process.env[k] || "";

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
  const info = await transporte.sendMail({
    from: env("CORREO_REMITENTE") || `"Sitio web Hospital de Frutillar" <${env("SMTP_USER")}>`,
    to: para,
    replyTo: e.correo || undefined,
    subject: asunto(e),
    text: correoTexto(e),
    html: correoHTML(e, { sitio }),
    attachments: [{ filename: `${e.folio}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }],
  });
  return { enviado: info.messageId, para, folio: e.folio };
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
