// Utilidades de RUT chileno. Compartido por funciones (Node) y navegador.

/** Deja solo dígitos y K mayúscula: "12.345.678-k" → "12345678K" */
export function limpiarRut(rut) {
  return String(rut ?? "").toUpperCase().replace(/[^0-9K]/g, "");
}

/** Dígito verificador (módulo 11) del cuerpo numérico. */
export function calcularDv(cuerpo) {
  let suma = 0;
  let mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (suma % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}

/** Valida y normaliza. Devuelve "12345678-5" o null si no es válido. */
export function normalizarRut(rut) {
  const limpio = limpiarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return null;
  const cuerpo = limpio.slice(0, -1).replace(/^0+/, "");
  const dv = limpio.slice(-1);
  if (cuerpo.length < 7 || calcularDv(cuerpo) !== dv) return null;
  return `${cuerpo}-${dv}`;
}

/** Formato de lectura: "12.345.678-5" */
export function formatearRut(rutNormalizado) {
  const [cuerpo, dv] = String(rutNormalizado).split("-");
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}
