// Archivos binarios en un almacén de Netlify Blobs (claves archivos/<id>, con metadata).
import { randomUUID } from "node:crypto";
import { abrirAlmacen } from "./almacen.mjs";

/** Tamaño máximo de un envío simple (las funciones de Netlify aceptan ~6 MB por petición). */
export const MAX_ARCHIVO_MB = 5;
/** Archivos más grandes se suben por partes de hasta 4 MB, con este máximo total. */
export const MAX_ARCHIVO_PARTES_MB = 30;
export const MAX_PARTE_MB = 4.5;
export const TIPOS_PERMITIDOS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

export const nuevoId = () => randomUUID().replace(/-/g, "").slice(0, 16);
export const esId = (id) => typeof id === "string" && /^[a-f0-9]{16}$/.test(id);
export const texto = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Operaciones de archivos sobre el almacén indicado. */
export function repoArchivos(nombreAlmacen) {
  const almacen = () => abrirAlmacen(nombreAlmacen);
  return {
    async guardar({ datos, nombre, tipo, subidoPor }) {
      const id = nuevoId();
      const metadata = {
        nombre: texto(nombre, 200).replace(/[\\/\r\n"]/g, "_") || "archivo",
        tipo,
        tamano: datos.byteLength,
        subidoPor,
        subido: new Date().toISOString(),
      };
      await (await almacen()).set(`archivos/${id}`, datos, { metadata });
      return { id, ...metadata };
    },
    async leer(id) {
      if (!esId(id)) return null;
      const st = await almacen();
      const r = await st.getWithMetadata(`archivos/${id}`, { type: "arrayBuffer" });
      if (!r || !r.metadata.partes) return r;
      // Archivo subido por partes: se entrega concatenando las partes en orden
      const { partes, subida } = r.metadata;
      let i = 0;
      const data = new ReadableStream({
        async pull(ctrl) {
          if (i >= partes) return ctrl.close();
          const parte = await st.get(`partes/${subida}/${i++}`, { type: "arrayBuffer" });
          if (!parte) return ctrl.error(new Error("Parte faltante"));
          ctrl.enqueue(new Uint8Array(parte));
        },
      });
      return { data, metadata: r.metadata };
    },
    async borrar(id) {
      if (!esId(id)) return;
      const st = await almacen();
      const m = (await st.getMetadata(`archivos/${id}`))?.metadata;
      if (m?.partes) for (let i = 0; i < m.partes; i++) await st.delete(`partes/${m.subida}/${i}`);
      await st.delete(`archivos/${id}`);
    },
    /** Guarda una parte de una subida grande. */
    async guardarParte({ subida, parte, datos }) {
      await (await almacen()).set(`partes/${subida}/${parte}`, datos, { metadata: { tamano: datos.byteLength } });
    },
    /** Registra el archivo cuando llegaron todas sus partes. Devuelve null si falta alguna. */
    async finalizar({ subida, total, nombre, tipo, subidoPor }) {
      const st = await almacen();
      let tamano = 0;
      for (let i = 0; i < total; i++) {
        const m = await st.getMetadata(`partes/${subida}/${i}`);
        if (!m) return null;
        tamano += m.metadata.tamano || 0;
      }
      if (tamano > MAX_ARCHIVO_PARTES_MB * 1024 * 1024) return null;
      const id = nuevoId();
      const metadata = {
        nombre: texto(nombre, 200).replace(/[\\/\r\n"]/g, "_") || "archivo",
        tipo, tamano, subidoPor, subido: new Date().toISOString(), partes: total, subida,
      };
      await st.set(`archivos/${id}`, "", { metadata });
      return { id, nombre: metadata.nombre, tipo, tamano, subidoPor, subido: metadata.subido };
    },
    /** [{ id, nombre, tipo, tamano }] de los ids que existen, en el mismo orden. */
    async describir(ids) {
      const st = await almacen();
      const out = [];
      for (const id of ids) {
        const r = await st.getMetadata(`archivos/${id}`);
        if (r) out.push({ id, nombre: r.metadata.nombre, tipo: r.metadata.tipo, tamano: r.metadata.tamano });
      }
      return out;
    },
  };
}

/**
 * Maneja POST de subida de archivos (simple o por partes) para un repositorio.
 * Por partes: cabeceras x-subida (16 hex), x-parte (0..n-1), x-partes (n). Las partes se envían en orden;
 * la última responde con el archivo registrado.
 */
export async function recibirArchivo(req, repo, subidoPor) {
  const tipo = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!TIPOS_PERMITIDOS[tipo]) return { status: 415, cuerpo: { error: "Tipo de archivo no permitido. Use PDF, imágenes u Office." } };
  let nombre = "archivo";
  try { nombre = decodeURIComponent(req.headers.get("x-nombre") || "archivo"); } catch {}
  const datos = await req.arrayBuffer();
  if (!datos.byteLength) return { status: 400, cuerpo: { error: "El archivo está vacío." } };

  const subida = req.headers.get("x-subida");
  if (!subida) {
    if (datos.byteLength > MAX_ARCHIVO_MB * 1024 * 1024) return { status: 413, cuerpo: { error: `El archivo supera los ${MAX_ARCHIVO_MB} MB.` } };
    return { status: 201, cuerpo: { archivo: await repo.guardar({ datos, nombre, tipo, subidoPor }) } };
  }
  const parte = Number(req.headers.get("x-parte"));
  const total = Number(req.headers.get("x-partes"));
  const maxPartes = Math.ceil(MAX_ARCHIVO_PARTES_MB / 4);
  if (!esId(subida) || !Number.isInteger(parte) || !Number.isInteger(total) || total < 1 || total > maxPartes || parte < 0 || parte >= total) {
    return { status: 400, cuerpo: { error: "Subida por partes inválida." } };
  }
  if (datos.byteLength > MAX_PARTE_MB * 1024 * 1024) return { status: 413, cuerpo: { error: "Parte demasiado grande." } };
  await repo.guardarParte({ subida, parte, datos });
  if (parte < total - 1) return { status: 202, cuerpo: { parte } };
  const archivo = await repo.finalizar({ subida, total, nombre, tipo, subidoPor });
  if (!archivo) return { status: 400, cuerpo: { error: `Faltan partes o el archivo supera los ${MAX_ARCHIVO_PARTES_MB} MB.` } };
  return { status: 201, cuerpo: { archivo } };
}

/** Respuesta HTTP para entregar un archivo guardado. */
export function respuestaArchivo(r, cache) {
  const { nombre, tipo } = r.metadata;
  const enLinea = tipo === "application/pdf" || tipo.startsWith("image/");
  return new Response(r.data, {
    headers: {
      "content-type": tipo,
      "content-disposition": `${enLinea ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "x-content-type-options": "nosniff",
      ...cache,
    },
  });
}
