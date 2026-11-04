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
  // "markdown": varias líneas con formato simple (**negrita**, listas con "- ", enlaces)
  { re: /^faq:categorias#[a-z0-9-]+\.titulo$/, tipo: "texto", max: 80 },
  { re: /^faq:categorias#[a-z0-9-]+\.preguntas#[a-z0-9-]+\.pregunta$/, tipo: "texto", max: 200 },
  { re: /^faq:categorias#[a-z0-9-]+\.preguntas#[a-z0-9-]+\.respuesta$/, tipo: "markdown", max: 2000 },
  { re: /^visitas:intro$/, tipo: "largo", max: 500 },
  { re: /^visitas:(notaHorario|maximoVisitas|informeMedico)$/, tipo: "texto", max: 200 },
  { re: /^visitas:horario\.\d{1,2}\.(dias|horario)$/, tipo: "texto", max: 120 },
  { re: /^visitas:recomendaciones\.\d{1,2}$/, tipo: "texto", max: 300 },
  { re: /^visitas:(informacionClinica|acompanamiento)$/, tipo: "markdown", max: 2000 },
  { re: /^transparencia:intro$/, tipo: "largo", max: 500 },
  { re: /^transparencia:secciones#[a-z0-9-]+\.descripcion$/, tipo: "markdown", max: 2000 },
  { re: /^transparencia:secciones#[a-z0-9-]+\.enlace_texto$/, tipo: "texto", max: 80 },
  { re: /^inicio:cifras#[a-z0-9-]+\.(valor|etiqueta)$/, tipo: "texto", max: 30 },
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

const AYUDA_MD = "Formato: **negrita**, líneas que empiezan con \"- \" para listas, [texto](https://enlace). Deje una línea en blanco entre párrafos.";

/** Campos editables con su valor base (el del repositorio), agrupados para el editor. */
export function listarCampos(datos) {
  const { servicios, horarios, autoridades, faq, visitas, transparencia, inicio } = datos;
  const out = [];
  const add = (seccion, grupo, ruta, etiqueta, ayuda) => {
    const def = campo(ruta);
    if (!def) throw new Error(`Ruta no editable: ${ruta}`);
    out.push({ seccion, grupo, ruta, etiqueta, tipo: def.tipo, max: def.max || null, base: leer(datos, ruta) ?? "", ayuda: ayuda || "" });
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
  if (faq) {
    for (const c of faq.categorias) {
      const r = `faq:categorias#${c.id}`;
      add("Preguntas frecuentes", c.titulo, `${r}.titulo`, "Título de la categoría");
      c.preguntas.forEach((p, i) => {
        add("Preguntas frecuentes", c.titulo, `${r}.preguntas#${p.id}.pregunta`, `Pregunta ${i + 1}`);
        add("Preguntas frecuentes", c.titulo, `${r}.preguntas#${p.id}.respuesta`, `Respuesta ${i + 1}`, AYUDA_MD);
      });
    }
  }
  if (visitas) {
    const g = "Horario de visita";
    add("Visitas", "Introducción", "visitas:intro", "Texto destacado");
    (visitas.horario || []).forEach((_, i) => {
      add("Visitas", g, `visitas:horario.${i}.dias`, `Fila ${i + 1}: días`);
      add("Visitas", g, `visitas:horario.${i}.horario`, `Fila ${i + 1}: horario`);
    });
    add("Visitas", g, "visitas:notaHorario", "Nota bajo el horario");
    add("Visitas", g, "visitas:maximoVisitas", "Visitas por paciente", "Si queda vacío, no se muestra.");
    add("Visitas", g, "visitas:informeMedico", "Información médica a familiares", "Si queda vacío, no se muestra.");
    (visitas.recomendaciones || []).forEach((_, i) => add("Visitas", "Recomendaciones", `visitas:recomendaciones.${i}`, `Recomendación ${i + 1}`, "Si queda vacía, no se muestra."));
    add("Visitas", "Información clínica y acompañamiento", "visitas:informacionClinica", "Información clínica", AYUDA_MD);
    add("Visitas", "Información clínica y acompañamiento", "visitas:acompanamiento", "Compañía y acompañamiento", AYUDA_MD);
  }
  if (transparencia) {
    add("Transparencia", "Introducción", "transparencia:intro", "Texto destacado");
    for (const s of transparencia.secciones) {
      const r = `transparencia:secciones#${s.id}`;
      add("Transparencia", s.titulo, `${r}.descripcion`, "Descripción", AYUDA_MD);
      if (s.enlace) add("Transparencia", s.titulo, `${r}.enlace_texto`, "Texto del botón");
    }
  }
  if (inicio) {
    for (const c of inicio.cifras) {
      const r = `inicio:cifras#${c.id}`;
      add("Portada", "Cifras bajo la imagen principal", `${r}.valor`, `${c.etiqueta}: cifra`, "Ej.: 163 o +24.000. Servicios y años de servicio se calculan solos.");
      add("Portada", "Cifras bajo la imagen principal", `${r}.etiqueta`, `${c.etiqueta}: texto`);
    }
  }
  return out;
}
