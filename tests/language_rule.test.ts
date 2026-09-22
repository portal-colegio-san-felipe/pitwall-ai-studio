import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Regla de Idioma: 100% de la Interfaz Pública en Español (M0)', () => {
  it('el archivo index.html debe declarar lang="es" y títulos en español', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    expect(html).toContain('lang="es"');
    expect(html).toContain('Pit Wall / Race Control');
    expect(html).toContain('Sistema escolar de cronometraje');
  });

  it('el archivo metadata.json debe contener descripción en español', () => {
    const meta = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../metadata.json'), 'utf-8'));
    expect(meta.description).toContain('Sistema escolar');
  });

  it('los estados principales de presencia deben usar la terminología en español especificada', () => {
    const badgeFile = fs.readFileSync(path.resolve(__dirname, '../src/components/StatusBadge.tsx'), 'utf-8');
    expect(badgeFile).toContain('EN LÍNEA');
    expect(badgeFile).toContain('RECONECTANDO');
    expect(badgeFile).toContain('SIN CONEXIÓN');
    expect(badgeFile).toContain('REINTENTAR CONEXIÓN');
  });

  it('la acción principal del Pit Wall debe llamarse REGISTRAR VUELTA', () => {
    const pitWallFile = fs.readFileSync(path.resolve(__dirname, '../src/views/PitWallView.tsx'), 'utf-8');
    expect(pitWallFile).toContain('REGISTRAR VUELTA');
  });
});
