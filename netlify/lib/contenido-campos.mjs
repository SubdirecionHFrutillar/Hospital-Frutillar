// Campos del sitio público que se editan desde la intranet ("Contenido del sitio").
// Una ruta identifica un dato de los archivos de _data, con identificadores estables (no posiciones):
//   "servicios:servicios#farmacia.descripcion"      → _data/servicios.json, servicio con id "farmacia"
//   "horarios:servicios#some.horarios.0.horario"     → primera fila de horario del SOME
//   "horarios:intro"                                 → campo de primer nivel
//   "autoridades:lista#director.foto"
// Lo usan el build (para publicar los cambios en el HTML), el editor del portal y la API (para validar).

export const PATRONES = [
  { re: /^servicios:servicios#[a-z0-9-]+\.descripcion$/, tipo: "largo", max: 1200 },
  { re: /^servicios:servicios#[a-z0-9-]+\.(horario|ubicacion)$/, tipo: "texto", max: 200 },
  { re: /^servicios:servicios#[a-z0-9-]+\.foto_equipo$/, tipo: "foto" },
  { re: /^horarios:intro$/, tipo: "largo", max: 500 },
  { re: /^horarios:servicios#[a-z0-9-]+\.(descripcion|notas)$/, tipo: "texto", max: 300 },
  { re: /^horarios:servicios#[a-z0-9-]+\.horarios\.\d{1,2}\.(dias|horario)$/, tipo: "texto", max: 120 },
  { re: /^autoridades:lista#[a-z0-9-]+\.(cargo|nombre|unidad)$/, tipo: "texto", max: 120 },
  { re: /^autoridades:lista#[a-z0-9-]+\.foto$/, tipo: "foto" },
];

/** Definición del campo (tipo y largo máximo) o null si la ruta no es editable. */
export const campo = (ruta) => (typeof ruta === "string" && PATRONES.find((p) => p.re.test(ruta))) || null;

/** Las fotos solo pueden ser archivos subidos desde el portal (o vacío para quitarla). */
export const fotoValida = (v) => v === "" || /^\/api\/contenido-archivos\/[a-f0-9]{16}$/.test(v);

/** Lee el valor de una ruta en los datos ({ servicios: {...}, horarios: {...}, ... }). undefined si no existe. */
export function leer(datos, ruta) {
  const [archivo, resto] = String(ruta).split(":");
  let x = datos?.[archivo];
  for (const parte of (resto || "").split(".")) {
    if (x == null) return undefined;
    const [clave, id] = parte.split("#");
    x = x[clave];
    if (id !== undefined) x = Array.isArray(x) ? x.find((e) => e && e.id === id) : undefined;
  }
  return x;
}

/** Campos editables con su valor base (el del repositorio), agrupados para el editor. */
export function listarCampos({ servicios, horarios, autoridades }) {
  const out = [];
  const add = (seccion, grupo, ruta, etiqueta, ayuda) => {
    const def = campo(ruta);
    if (!def) throw new Error(`Ruta no editable: ${ruta}`);
    out.push({ seccion, grupo, ruta, etiqueta, tipo: def.tipo, max: def.max || null, base: leer({ servicios, horarios, autoridades }, ruta) ?? "", ayuda: ayuda || "" });
  };
  for (const s of servicios.servicios.filter((x) => !x.oculto)) {
    const r = `servicios:servicios#${s.id}`;
    add("Servicios", s.nombre, `${r}.descripcion`, "Descripción");
    // La página muestra el horario o, si no hay, la ubicación
    if (s.ubicacion && !s.horario) add("Servicios", s.nombre, `${r}.ubicacion`, "Ubicación o cobertura");
    else add("Servicios", s.nombre, `${r}.horario`, "Horario o dato destacado");
    add("Servicios", s.nombre, `${r}.foto_equipo`, "Foto del equipo", "Cuadrada o apaisada; se recorta al centro.");
  }
  add("Horarios", "Nota de la página", "horarios:intro", "Texto introductorio");
  for (const s of horarios.servicios) {
    const r = `horarios:servicios#${s.id}`;
    if (s.descripcion !== undefined) add("Horarios", s.nombre, `${r}.descripcion`, "Descripción");
    (s.horarios || []).forEach((_, i) => {
      add("Horarios", s.nombre, `${r}.horarios.${i}.dias`, `Fila ${i + 1}: días`);
      add("Horarios", s.nombre, `${r}.horarios.${i}.horario`, `Fila ${i + 1}: horario`);
    });
    add("Horarios", s.nombre, `${r}.notas`, "Nota");
  }
  for (const a of autoridades.lista) {
    const r = `autoridades:lista#${a.id}`;
    const g = a.cargo;
    add("Autoridades", g, `${r}.cargo`, "Cargo");
    add("Autoridades", g, `${r}.nombre`, "Nombre");
    add("Autoridades", g, `${r}.unidad`, "Unidad");
    add("Autoridades", g, `${r}.foto`, "Foto", "Idealmente cuadrada, con la cara centrada.");
  }
  return out;
}
