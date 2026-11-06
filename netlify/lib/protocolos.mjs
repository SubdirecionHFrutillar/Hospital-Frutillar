// Protocolos clínicos de la intranet, editables en vivo desde el portal.
// Almacén "protocolos": clave "documentos" (lista) y archivos/<id> (PDF o Word subidos).
//   documento: { id, area, titulo, codigo, version, vigencia (AAAA-MM-DD, opcional), url (enlace, opcional),
//                archivo: { id, nombre, tipo, tamano } | null, anteriores: [{ archivo, version, reemplazado }],
//                actualizado, autor }
// Mientras nadie edite, se usan los documentos de protocolos-base.mjs. Las áreas son fijas (en código).
import { abrirAlmacen } from "./almacen.mjs";
import { repoArchivos, nuevoId, esId, texto } from "./archivos.mjs";
import BASE from "./protocolos-base.mjs";

export const archivos = repoArchivos("protocolos");
export const TIPOS_ARCHIVO = {
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
};
export const MAX_ANTERIORES = 5;
const almacen = () => abrirAlmacen("protocolos");

export const AREAS = BASE.areas.map(({ documentos, ...a }) => a);
const DOCS_BASE = BASE.areas.flatMap((a) => a.documentos.map((d) => ({ ...d, area: a.id, archivo: null, anteriores: [] })));

export const hoyChile = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

export async function listar() {
  const guardados = await (await almacen()).get("documentos", { type: "json" });
  return guardados || DOCS_BASE.map((d) => ({ ...d }));
}
const guardarLista = async (lista) => (await almacen()).setJSON("documentos", lista);

const URL_OK = /^https:\/\/[^\s<>"]+$/;
export function validar(d) {
  if (!d || typeof d !== "object") return { error: "Datos inválidos." };
  const titulo = texto(d.titulo, 150).replace(/\s+/g, " ");
  if (titulo.length < 3) return { error: "Escriba el nombre del protocolo." };
  const area = texto(d.area, 60);
  if (!AREAS.some((a) => a.id === area)) return { error: "Elija un área." };
  const codigo = texto(d.codigo, 20);
  const version = texto(d.version, 20);
  const vigencia = texto(d.vigencia, 10);
  if (vigencia && !/^\d{4}-\d{2}-\d{2}$/.test(vigencia)) return { error: "Fecha de vigencia inválida." };
  const url = texto(d.url, 500);
  if (url && !URL_OK.test(url)) return { error: "El enlace debe empezar con https://" };
  const archivo = d.archivo === null || d.archivo === undefined || d.archivo === "" ? null : texto(d.archivo, 16);
  if (archivo && !esId(archivo)) return { error: "Archivo inválido." };
  return { datos: { area, titulo, codigo, version, vigencia, url, archivo } };
}

/** Datos de un archivo subido (debe ser PDF o Word). */
async function describirArchivo(id) {
  const [a] = await archivos.describir([id]);
  if (!a) return { error: "El archivo subido no se encontró. Súbalo de nuevo." };
  if (!TIPOS_ARCHIVO[a.tipo]) return { error: "El protocolo debe ser PDF o Word." };
  return { archivo: { id: a.id, nombre: a.nombre, tipo: a.tipo, tamano: a.tamano } };
}

export async function crear(datos, autor) {
  let archivo = null;
  if (datos.archivo) {
    const r = await describirArchivo(datos.archivo);
    if (r.error) return r;
    archivo = r.archivo;
  }
  if (!archivo && !datos.url) return { error: "Suba el archivo del protocolo o indique un enlace." };
  const lista = await listar();
  const doc = { id: nuevoId(), ...datos, archivo, anteriores: [], actualizado: new Date().toISOString(), autor: autor.nombre };
  lista.push(doc);
  await guardarLista(lista);
  return { documento: doc };
}

/** Actualiza datos y, si viene un archivo nuevo, guarda el anterior como versión previa. */
export async function actualizar(id, datos, autor) {
  const lista = await listar();
  const doc = lista.find((d) => d.id === id);
  if (!doc) return { error: "Protocolo no encontrado.", status: 404 };
  let archivo = doc.archivo;
  if (datos.archivo && datos.archivo !== doc.archivo?.id) {
    const r = await describirArchivo(datos.archivo);
    if (r.error) return r;
    if (doc.archivo) {
      doc.anteriores = [{ archivo: doc.archivo, version: doc.version, reemplazado: new Date().toISOString() }, ...(doc.anteriores || [])];
      for (const viejo of doc.anteriores.splice(MAX_ANTERIORES)) await archivos.borrar(viejo.archivo.id);
    }
    archivo = r.archivo;
  } else if (datos.archivo === null && doc.archivo) {
    // Quitar el archivo (queda solo el enlace): el archivo pasa a versiones anteriores
    doc.anteriores = [{ archivo: doc.archivo, version: doc.version, reemplazado: new Date().toISOString() }, ...(doc.anteriores || [])];
    for (const viejo of doc.anteriores.splice(MAX_ANTERIORES)) await archivos.borrar(viejo.archivo.id);
    archivo = null;
  }
  if (!archivo && !datos.url) return { error: "Suba el archivo del protocolo o indique un enlace." };
  Object.assign(doc, { ...datos, archivo, actualizado: new Date().toISOString(), autor: autor.nombre });
  await guardarLista(lista);
  return { documento: doc };
}

export async function eliminar(id) {
  const lista = await listar();
  const doc = lista.find((d) => d.id === id);
  if (!doc) return false;
  for (const a of [doc.archivo, ...(doc.anteriores || []).map((x) => x.archivo)]) if (a) await archivos.borrar(a.id);
  await guardarLista(lista.filter((d) => d.id !== id));
  return true;
}

/** ¿El archivo pertenece a algún protocolo (vigente o anterior)? Solo esos se entregan. */
export async function archivoRegistrado(id) {
  return (await listar()).some((d) => d.archivo?.id === id || (d.anteriores || []).some((x) => x.archivo.id === id));
}
