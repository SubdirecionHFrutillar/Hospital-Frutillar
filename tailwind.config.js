/** Tailwind compilado en el build (reemplaza el CDN de desarrollo). */
module.exports = {
  content: [
    "./*.njk",
    "./_includes/**/*.njk",
    "./_data/**/*.json",
    "./content/**/*.md",
    "./funcionarios/**/*.njk",
    "./assets/js/**/*.{js,mjs}",
  ],
  // Variantes armadas desde _data/links.json (link-min--abajo, --arriba, --ambas, --linea)
  safelist: [{ pattern: /^link-min/ }, { pattern: /^aviso/ }, { pattern: /^consulta/ }, { pattern: /^triage/ }, { pattern: /^calidad/ }, { pattern: /^lamina/ }, { pattern: /^rotativo/ }, { pattern: /^sistema-ssr/ }],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Public Sans", "sans-serif"],
        cartel: ["Barlow Condensed", "Public Sans", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#0F69C4",
          light: "#6AADEB",
          pale: "#CCE3F7",
          bg: "#EEF4FB",
          dark: "#0B4F96",
          deep: "#0A2A5E",
        },
        gob: {
          rojo: "#DA291C",
          gris: "#27272a",
        },
      },
      borderRadius: { custom: "4px" },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
