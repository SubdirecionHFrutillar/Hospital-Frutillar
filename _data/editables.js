// Campos del sitio editables desde la intranet, con su valor del repositorio.
// Se publica como /funcionarios/contenido-campos.json para el editor del portal.
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function () {
  const { listarCampos } = await import("../netlify/lib/contenido-campos.mjs");
  const leer = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, `${n}.json`), "utf8"));
  const archivos = ["servicios", "horarios", "autoridades", "faq", "visitas", "transparencia", "inicio"];
  return listarCampos(Object.fromEntries(archivos.map((n) => [n, leer(n)])));
};
