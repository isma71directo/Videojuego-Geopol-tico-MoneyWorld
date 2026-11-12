/** Formato de cifras en español para la interfaz. */

const entero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' });
const decimal = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 3273049 → «3.273.049». */
export function enteros(valor: number): string {
  return entero.format(valor);
}

/** 46576897 → «46,6 millones»; 31248 → «31.248». */
export function personas(valor: number): string {
  if (valor >= 1e9) return `${decimal.format(valor / 1e9)} mil millones`;
  if (valor >= 1e6) return `${decimal.format(valor / 1e6)} millones`;
  return entero.format(valor);
}

/** 1427990000000 → «1,43 billones $»; 98381300000 → «98.381 M$». */
export function dolares(valor: number): string {
  if (valor >= 1e12) {
    return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(valor / 1e12)} billones $`;
  }
  if (valor >= 1e6) return `${entero.format(valor / 1e6)} M$`;
  return `${entero.format(valor)} $`;
}

/** 30658.7 → «30.659 $». */
export function dolaresPorPersona(valor: number): string {
  return `${entero.format(valor)} $`;
}

/** 19.86 → «19,9 %». */
export function porcentaje(valor: number): string {
  return `${decimal.format(valor)} %`;
}
