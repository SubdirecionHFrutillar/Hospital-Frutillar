// Íconos de Material Symbols que usa el sitio, para pedirle a Google Fonts solo esos (icon_names=…).
// La fuente completa pesa varios cientos de KB; con solo los íconos usados queda en una fracción.
// Se calcula en cada build: busca nombres entre comillas o como texto de una etiqueta en plantillas,
// datos y JavaScript, y se queda con los que existen en Material Symbols
// (scripts/material-symbols-nombres.txt, del paquete npm material-symbols 0.27).
// Un ícono nuevo en una plantilla queda incluido solo; si se usa un nombre que no existe, no se pide.
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const CARPETAS = [".", "_includes", "_data", "funcionarios", "assets/js", "noticias"];
const EXT = /\.(njk|html|md|json|js|mjs)$/;

// Archivos sueltos con íconos fuera de esas carpetas (p. ej. las áreas de los protocolos)
const SUELTOS = ["netlify/lib/protocolos-base.mjs"];

function archivos() {
  const out = SUELTOS.map((f) => path.join(RAIZ, f));
  for (const c of CARPETAS) {
    const dir = path.join(RAIZ, c);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const ruta = path.join(dir, f);
      if (EXT.test(f) && fs.statSync(ruta).isFile()) out.push(ruta);
    }
  }
  return out;
}

module.exports = function () {
  const validos = new Set(fs.readFileSync(path.join(RAIZ, "scripts/material-symbols-nombres.txt"), "utf8").split("\n").filter(Boolean));
  const usados = new Set();
  const candidato = /["'`>]\s*([a-z0-9][a-z0-9_]{1,40})\s*["'`<]/g;
  for (const f of archivos()) {
    const texto = fs.readFileSync(f, "utf8");
    for (const m of texto.matchAll(candidato)) if (validos.has(m[1])) usados.add(m[1]);
  }
  // Google exige la lista en orden alfabético
  const lista = [...usados].sort();
  return { lista, parametro: lista.join(",") };
};
