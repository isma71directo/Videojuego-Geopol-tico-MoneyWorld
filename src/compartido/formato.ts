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

/** Dinero con signo: −98381300000 → «−98.381 M$». */
export function dineroConSigno(valor: number): string {
  return `${valor < 0 ? '−' : ''}${dolares(Math.abs(valor))}`;
}

/** 30658.7 → «30.659 $». */
export function dolaresPorPersona(valor: number): string {
  return `${entero.format(valor)} $`;
}

/** 19.86 → «19,9 %». */
export function porcentaje(valor: number): string {
  return `${decimal.format(valor)} %`;
}

/** Puntos con un decimal: 15.34 → «15,3». */
export function puntos(valor: number): string {
  return decimal.format(valor);
}

/** Puntos con signo y un decimal: 6 → «+6,0»; −3.84 → «−3,8»; 0 → «0,0». */
export function puntosConSigno(valor: number): string {
  const texto = decimal.format(Math.abs(valor));
  if (Math.abs(valor) < 0.05) return texto;
  return `${valor > 0 ? '+' : '−'}${texto}`;
}
