/** Formatos de fecha en español, sin depender de la zona horaria del servidor. */

/** Convierte «2026-11-11» en «11/11/2026». Devuelve el texto tal cual si no es una fecha. */
export function formatearFecha(fecha: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!partes) return fecha;
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

/** Convierte una fecha ISO con hora en «11/11/2026, 16:30» (hora local del dispositivo). */
export function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

/** Hora local en formato «16:30». */
export function formatearHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(fecha);
}
