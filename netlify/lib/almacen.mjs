// Acceso a Netlify Blobs. Con FUNCIONARIOS_STORE=memoria usa un almacén en memoria (pruebas locales).
const memorias = new Map();

function almacenMemoria() {
  const datos = new Map(); // clave → { valor: string | Uint8Array, metadata }
  const leer = (v, tipo) => {
    if (tipo === "json") return JSON.parse(v);
    if (tipo === "arrayBuffer") return (typeof v === "string" ? new TextEncoder().encode(v) : v).buffer;
    if (tipo === "stream") return new Response(v).body;
    return v;
  };
  return {
    async get(k, o) {
      const e = datos.get(k);
      return e === undefined ? null : leer(e.valor, o?.type);
    },
    async getWithMetadata(k, o) {
      const e = datos.get(k);
      return e === undefined ? null : { data: leer(e.valor, o?.type), metadata: e.metadata || {} };
    },
    async getMetadata(k) {
      const e = datos.get(k);
      return e === undefined ? null : { metadata: e.metadata || {} };
    },
    async set(k, v, o) {
      const valor = typeof v === "string" ? v : new Uint8Array(v instanceof ArrayBuffer ? v : v.buffer ?? v);
      datos.set(k, { valor: typeof v === "string" ? v : valor.slice(), metadata: o?.metadata });
    },
    async setJSON(k, v, o) { datos.set(k, { valor: JSON.stringify(v), metadata: o?.metadata }); },
    async delete(k) { datos.delete(k); },
    async list({ prefix = "" } = {}) {
      return { blobs: [...datos.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
  };
}

export async function abrirAlmacen(nombre) {
  if (process.env.FUNCIONARIOS_STORE === "memoria") {
    if (!memorias.has(nombre)) memorias.set(nombre, almacenMemoria());
    return memorias.get(nombre);
  }
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: nombre, consistency: "strong" });
}

/** Solo pruebas: vacía los almacenes en memoria. */
export function _reiniciarAlmacenesPrueba() {
  memorias.clear();
}
