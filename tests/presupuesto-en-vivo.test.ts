// @vitest-environment happy-dom
/** El presupuesto en vivo: ficha y Gobierno › Presupuesto (tarea f17-t4). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import type { ConjuntoPaises } from '../src/datos/paises';
import { t } from '../src/i18n';
import { avanzarMes, economiaInicial, nivelDe, type EconomiaPais } from '../src/sim/economia';
import {
  avanzarPresupuesto,
  MINISTERIOS,
  presupuestoInicial,
  type PresupuestoPais,
} from '../src/sim/presupuesto';
import {
  bloquePresupuesto,
  contenidoVentanaPresupuesto,
  ICONO_INGRESO,
  ICONO_MINISTERIO,
  ICONO_PARTIDA,
  refrescarPresupuestoEnVivo,
} from '../src/ui/presupuesto-en-vivo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

function paisDe(id: string) {
  const datos = paises.paises[id]!;
  const economia = economiaInicial(datos.datos, datos.nivelRenta)!;
  const presupuesto = presupuestoInicial(datos.datos, nivelDe(datos.nivelRenta), economia)!;
  const estado = { tesoreria: 1e10 };
  let fecha = '2010-01-01';
  return {
    economia,
    presupuesto,
    estado,
    fuente: () => ({ presupuesto, economia, tesoreria: estado.tesoreria, fecha }),
    avanzar(meses: number) {
      for (let m = 0; m < meses; m++) {
        avanzarMes(economia);
        avanzarPresupuesto(presupuesto, economia, estado);
      }
      fecha = '2011-01-01';
    },
  } satisfies {
    economia: EconomiaPais;
    presupuesto: PresupuestoPais;
    estado: { tesoreria: number };
    fuente: unknown;
    avanzar: unknown;
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('el presupuesto en vivo (tarea f17-t4)', () => {
  it('cada ingreso, partida y ministerio tiene su icono y su nombre', () => {
    for (const nombre of [
      ...Object.values(ICONO_INGRESO),
      ...Object.values(ICONO_PARTIDA),
      ...Object.values(ICONO_MINISTERIO),
    ]) {
      expect(NOMBRES_ICONOS).toContain(nombre);
    }
    for (const nuevo of ['renta', 'iva', 'personal', 'mantenimiento', 'programas', 'pensiones']) {
      expect(t(`galeria.iconos.${nuevo}`)).not.toContain('galeria.');
    }
    for (const m of MINISTERIOS) {
      expect(t(`juego.secciones.ministerios.${m}.nombre`)).not.toContain('juego.');
    }
  });

  it('en la ficha: ingresos, gastos, déficit, deuda, intereses y tesorería, con sus barras y su gráfico', () => {
    const espana = paisDe('ESP');
    const bloque = bloquePresupuesto(espana.fuente, { anchoGrafico: 340 });
    document.body.append(bloque.elemento);
    const texto = bloque.elemento.textContent!;
    for (const parte of [
      'Presupuesto del Estado',
      'Ingresos',
      'Gastos',
      'Déficit',
      'Deuda pública',
      'Intereses de la deuda',
      'Tesorería',
      'De dónde salen los ingresos',
      'En qué se gasta',
      'Ingresos y gastos desde enero de 2010',
    ]) {
      expect(texto).toContain(parte);
    }
    // España: déficit del 9,5 % del PIB, en rojo.
    expect(texto).toContain('-9,5 % del PIB');
    expect(bloque.elemento.querySelector('.economia__baja')).not.toBeNull();
    // Dos barras con sus iconos (7 ingresos y 7 grupos de gasto).
    expect(bloque.elemento.querySelectorAll('.grafico__leyenda--partes .icono')).toHaveLength(14);
    // En la ficha, sin la deuda en gráfico ni los ministerios por dentro.
    expect(bloque.elemento.querySelector('.presupuesto__tabla')).toBeNull();
  });

  it('se pone al día cada mes', () => {
    const espana = paisDe('ESP');
    const bloque = bloquePresupuesto(espana.fuente);
    document.body.append(bloque.elemento);
    const deudaAntes = [...bloque.elemento.querySelectorAll('.panel-pais__fila')]
      .find((f) => f.textContent!.includes('Deuda pública'))!
      .querySelector('dd')!.textContent;
    espana.avanzar(12);
    refrescarPresupuestoEnVivo();
    const deudaDespues = [...bloque.elemento.querySelectorAll('.panel-pais__fila')]
      .find((f) => f.textContent!.includes('Deuda pública'))!
      .querySelector('dd')!.textContent;
    expect(deudaDespues).not.toBe(deudaAntes);
    expect(bloque.elemento.textContent).toContain('1 de enero de 2011');
  });

  it('en Gobierno › Presupuesto: también la deuda y los 20 ministerios por dentro', () => {
    const grecia = paisDe('GRC');
    const ventana = contenidoVentanaPresupuesto(grecia.fuente, 'Grecia');
    document.body.append(ventana);
    expect(ventana.textContent).toContain('Grecia');
    expect(ventana.textContent).toContain('Deuda pública desde enero de 2010');
    const ministerios = ventana.querySelectorAll('.presupuesto__ministerio');
    expect(ministerios).toHaveLength(20);
    // Cada uno se despliega con sus cuatro partidas.
    const educacion = ventana.querySelector<HTMLDetailsElement>('[data-ministerio="educacion"]')!;
    expect(educacion.querySelectorAll('.presupuesto__partidas .panel-pais__fila')).toHaveLength(4);
    expect(educacion.textContent).toContain('Personal');
    // Los ministerios sin dato real llevan su asterisco de estimado; sanidad, no.
    expect(
      ventana.querySelector('[data-ministerio="transportes"] .presupuesto__valor')!.textContent,
    ).toContain('*');
    expect(
      ventana.querySelector('[data-ministerio="sanidad"] .presupuesto__valor')!.textContent,
    ).not.toContain('*');
    expect(ventana.textContent).toContain('Fase 19');
  });

  it('sin presupuesto (sin datos), lo dice', () => {
    const bloque = bloquePresupuesto(() => ({
      presupuesto: null,
      economia: null,
      tesoreria: 0,
      fecha: '2010-01-01',
    }));
    expect(bloque.elemento.textContent).toContain('No hay datos');
  });
});
