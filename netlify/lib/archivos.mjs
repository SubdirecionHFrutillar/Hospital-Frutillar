// Archivos binarios en un almacén de Netlify Blobs (claves archivos/<id>, con metadata).
import { randomUUID } from "node:crypto";
import { abrirAlmacen } from "./almacen.mjs";

export const MAX_ARCHIVO_MB = 5;
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
      return (await almacen()).getWithMetadata(`archivos/${id}`, { type: "arrayBuffer" });
    },
    async borrar(id) {
      if (esId(id)) await (await almacen()).delete(`archivos/${id}`);
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
