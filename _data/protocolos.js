// Título y descripción de la página de protocolos (los documentos se cargan en vivo desde /api/protocolos).
module.exports = async () => (await import("../netlify/lib/protocolos-base.mjs")).default;
