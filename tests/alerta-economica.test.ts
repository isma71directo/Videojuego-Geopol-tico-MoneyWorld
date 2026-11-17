// @vitest-environment happy-dom
/** Alertas económicas en la pantalla: tarjeta, textos, iconos y sonidos (tarea f16-t4). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOMBRES_ICONOS } from '../src/av/iconos';
import { EFECTOS } from '../src/av/sonido';
import { t } from '../src/i18n';
import { TIPOS_ALERTA, type TipoAlerta } from '../src/sim/alertas';
import type { Suceso } from '../src/sim/sucesos';
import {
  cerrarAlertasEconomicas,
  DURACION_ALERTA,
  ICONO_ALERTA,
  mostrarAlertaEconomica,
  SONIDO_ALERTA,
  traducirSuceso,
} from '../src/ui/alerta-economica';

const alerta = (tipo: TipoAlerta, valor: number, importante = false): Suceso => ({
  id: `a-${tipo}`,
  titulo: '',
  texto: '',
  fecha: '2011-06-01',
  hora: 1,
  importante,
  origen: 'economia',
  alerta: { tipo, valor },
});

afterEach(() => {
  cerrarAlertasEconomicas();
  vi.useRealTimers();
});

describe('alertas económicas en la pantalla (tarea f16-t4)', () => {
  it('cada alerta tiene su título, su texto con el dato, su icono y su sonido propio', () => {
    const sonidos = new Set<string>();
    for (const tipo of TIPOS_ALERTA) {
      expect(t(`juego.alertas.${tipo}.titulo`)).not.toContain('juego.');
      expect(NOMBRES_ICONOS).toContain(ICONO_ALERTA[tipo]);
      expect(EFECTOS[SONIDO_ALERTA[tipo]]).toBeDefined();
      expect(t(`galeria.sonidos.${SONIDO_ALERTA[tipo]}`)).not.toContain('galeria.');
      sonidos.add(SONIDO_ALERTA[tipo]);
    }
    expect(sonidos.size).toBe(TIPOS_ALERTA.length);
    const traducido = traducirSuceso(alerta('inflacion', 0.124));
    expect(traducido.titulo).toBe('Inflación alta');
    expect(traducido.texto).toContain('12,4 %');
    // Los demás sucesos, tal cual.
    const otro: Suceso = { ...alerta('paro', 0.2), alerta: undefined, titulo: 'Hola' };
    expect(traducirSuceso(otro)).toBe(otro);
  });

  it('las que no paran salen en una tarjeta que se va sola', () => {
    vi.useFakeTimers();
    const tarjeta = mostrarAlertaEconomica(alerta('paro', 0.214));
    expect(document.querySelector('.alertas-economicas')).not.toBeNull();
    expect(tarjeta.textContent).toContain('El paro se dispara');
    expect(tarjeta.textContent).toContain('21,4 %');
    expect(tarjeta.textContent).toContain('1 de junio de 2011');
    expect(tarjeta.querySelector('.icono')).not.toBeNull();
    expect(tarjeta.dataset.grave).toBe('false');
    vi.advanceTimersByTime(DURACION_ALERTA + 500);
    expect(tarjeta.isConnected).toBe(false);
  });

  it('se cierran con su botón; como mucho tres a la vez; y se quitan al salir de la partida', () => {
    const primera = mostrarAlertaEconomica(alerta('recesion', -0.031, true));
    expect(primera.dataset.grave).toBe('true');
    primera.querySelector<HTMLButtonElement>('.alerta-economica__cerrar')!.click();
    for (const tipo of TIPOS_ALERTA) mostrarAlertaEconomica(alerta(tipo, 0.1));
    expect(
      document.querySelectorAll('.alerta-economica:not(.retirandose)').length,
    ).toBeLessThanOrEqual(3);
    cerrarAlertasEconomicas();
    expect(document.querySelector('.alertas-economicas')).toBeNull();
  });
});
