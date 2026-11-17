// @vitest-environment happy-dom
/** El rating y la prima en pantalla: distintivo, filas, gráfico y alertas (tarea f18-t4). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import type { ConjuntoPaises } from '../src/datos/paises';
import { t } from '../src/i18n';
import { RATINGS, sistemaMercado, UMBRAL_CIERRE } from '../src/sim/deuda';
import { sistemaEconomia } from '../src/sim/economia';
import { crearMotor } from '../src/sim/motor';
import { crearPartida } from '../src/sim/partida';
import { sistemaPresupuesto } from '../src/sim/presupuesto';
import type { Suceso } from '../src/sim/sucesos';
import { graficoLineas } from '../src/ui/componentes/graficos';
import { traducirSuceso } from '../src/ui/alerta-economica';
import { bloquePresupuesto } from '../src/ui/presupuesto-en-vivo';
import {
  cambioRating,
  distintivoRating,
  NIVELES_RATING,
  nivelRating,
  textoRating,
} from '../src/ui/rating';
import { paisCompleto } from './ayudas/pais-completo';

const paises = JSON.parse(
  readFileSync(resolve('public/data/paises-2010.json'), 'utf8'),
) as ConjuntoPaises;

describe('el distintivo del rating (tarea f18-t4)', () => {
  it('cada nota tiene el color de su escalón, de AAA a D', () => {
    expect(nivelRating('AAA')).toBe('excelente');
    expect(nivelRating('AA-')).toBe('excelente');
    expect(nivelRating('A')).toBe('alto');
    expect(nivelRating('BBB-')).toBe('medio');
    expect(nivelRating('BB+')).toBe('especulativo');
    expect(nivelRating('B-')).toBe('especulativo');
    expect(nivelRating('CCC')).toBe('riesgo');
    expect(nivelRating('C')).toBe('riesgo');
    expect(nivelRating('D')).toBe('impago');
    for (const nivel of NIVELES_RATING) {
      expect(t(`juego.rating.niveles.${nivel}`)).not.toContain('juego.');
    }
    expect(textoRating('BBB-')).toBe('BBB−');
  });

  it('salta con su flecha cuando la nota cambia, y no si sigue igual', () => {
    expect(cambioRating('BBB', 'BB+')).toBe(-1);
    expect(cambioRating('D', 'B')).toBe(1);
    expect(cambioRating('A', 'A')).toBe(0);
    const quieto = distintivoRating('A');
    expect(quieto.dataset.nivel).toBe('alto');
    expect(quieto.dataset.cambio).toBeUndefined();
    expect(quieto.querySelector('.rating__flecha')).toBeNull();
    expect(quieto.getAttribute('aria-label')).toBe('Rating A: calidad alta');
    const baja = distintivoRating('BB+', 'BBB-');
    expect(baja.dataset.cambio).toBe('baja');
    expect(baja.querySelector('.rating__flecha')!.textContent).toBe('▼');
    const sube = distintivoRating('A+', 'A-');
    expect(sube.dataset.cambio).toBe('sube');
    expect(sube.querySelector('.rating__flecha')!.textContent).toBe('▲');
  });

  it('los iconos nuevos (rating y prima) están en la galería', () => {
    for (const nombre of ['rating', 'prima'] as const) {
      expect(NOMBRES_ICONOS).toContain(nombre);
      expect(t(`galeria.iconos.${nombre}`)).not.toContain('galeria.');
    }
  });
});

describe('el rating y la prima en el presupuesto (tarea f18-t4)', () => {
  const fuenteDe = (pais: ReturnType<typeof paisCompleto>) => () => ({
    presupuesto: pais.presupuesto,
    economia: pais.economia,
    tesoreria: pais.estado.tesoreria,
    fecha: '2010-01-01',
    mercado: pais.mercado,
  });

  it('enseña el rating, la prima y, si la hay, la crisis de deuda', () => {
    const grecia = paisCompleto(paises, 'GRC');
    const bloque = bloquePresupuesto(fuenteDe(grecia));
    const texto = () => bloque.elemento.textContent!;
    expect(texto()).toContain('Rating de la deuda');
    expect(bloque.elemento.querySelector('.rating')!.textContent).toBe('BB+');
    expect(texto()).toContain('Prima de riesgo');
    expect(texto()).toMatch(/5,\d puntos \(bono a 10 años al 9,\d %\)/);
    expect(texto()).not.toContain('Crisis de deuda');
    // Al bajar la nota, el distintivo salta hacia abajo.
    grecia.avanzar(6);
    bloque.actualizar();
    expect(bloque.elemento.querySelector<HTMLElement>('.rating')!.dataset.cambio).toBe('baja');
    // Con los mercados cerrados, la crisis y lo que queda de ella.
    grecia.avanzar(18);
    bloque.actualizar();
    expect(texto()).toContain('Crisis de deuda');
    expect(texto()).toMatch(/Impago: quedan \d+ meses/);
    expect(bloque.elemento.querySelector('.rating__nota')!.textContent).toBe('D');
  });

  it('en la ventana, el gráfico de la prima con la línea del cierre de los mercados', () => {
    const espana = paisCompleto(paises, 'ESP');
    espana.avanzar(12);
    const ficha = bloquePresupuesto(fuenteDe(espana));
    expect(ficha.elemento.textContent).not.toContain('Prima de riesgo desde enero de 2010');
    const ventana = bloquePresupuesto(fuenteDe(espana), { completo: true });
    expect(ventana.elemento.textContent).toContain('Prima de riesgo desde enero de 2010');
    expect(ventana.elemento.textContent).toContain('Cierre de los mercados');
    expect(ventana.elemento.querySelector('.grafico__referencia-linea')).not.toBeNull();
  });

  it('las líneas de referencia del gráfico se ven aunque los datos no lleguen a ellas', () => {
    const grafico = graficoLineas({
      titulo: 'Prima',
      series: [
        {
          nombre: 'Prima',
          puntos: [
            [0, 1],
            [1, 2],
          ],
        },
      ],
      referencias: [{ valor: UMBRAL_CIERRE, etiqueta: 'Cierre' }],
    });
    const linea = grafico.querySelector('.grafico__referencia-linea')!;
    // Dentro del dibujo (el eje llega hasta 15).
    expect(Number(linea.getAttribute('y1'))).toBeGreaterThanOrEqual(0);
    expect(grafico.querySelector('.grafico__referencia-texto')!.textContent).toBe('Cierre');
  });
});

describe('las alertas del rating (tarea f18-t4)', () => {
  it('avisan al jugador cuando le bajan la nota (y no por los demás países)', () => {
    const motor = crearMotor({ sistemas: [sistemaEconomia, sistemaPresupuesto, sistemaMercado] });
    const partida = crearPartida(
      { paisId: 'GRC', dificultad: 'realista', eventosHistoricos: true, semilla: 2 },
      paises.paises,
    );
    const antes = partida.paises.GRC!.mercado!.rating;
    motor.atender({ tipo: 'empezar', partida, pausaAutomatica: true });
    motor.atender({ tipo: 'velocidad', velocidad: 64 });
    const alertas: Suceso[] = [];
    while (motor.partida!.fecha < '2010-10-01') {
      for (const mensaje of motor.avanzar(250)) {
        if (mensaje.tipo === 'suceso' && mensaje.suceso.alerta?.tipo.startsWith('rating')) {
          alertas.push(mensaje.suceso);
          // No paran la partida.
          expect(mensaje.pausado).toBe(false);
        }
      }
    }
    expect(alertas.length).toBeGreaterThan(0);
    const [primera] = alertas;
    expect(primera!.alerta!.tipo).toBe('ratingBaja');
    expect(RATINGS.indexOf(primera!.alerta!.rating as (typeof RATINGS)[number])).toBeGreaterThan(
      RATINGS.indexOf(antes as (typeof RATINGS)[number]),
    );
    expect(primera!.importante).toBe(false);
    expect(alertas.every((s) => s.id.endsWith('-GRC'))).toBe(true);
    // El texto lleva la nota nueva y la prima, en puntos.
    const traducida = traducirSuceso(primera!);
    expect(traducida.titulo).toBe('Bajan el rating');
    expect(traducida.texto).toContain(textoRating(primera!.alerta!.rating!));
    expect(traducida.texto).toMatch(/prima de riesgo de \d+,\d puntos/);
  });
});
