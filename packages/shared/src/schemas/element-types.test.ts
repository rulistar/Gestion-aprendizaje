import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIELD_LABELS,
  DEFAULT_ELEMENT_TYPES,
  fieldLabelsFormSchema,
  fieldLabelsInputSchema as labelsInput,
  HIDEABLE_FIELDS,
  hiddenFieldsSchema,
  showsField,
  fieldLabelsInputSchema,
  resolveFieldLabels,
  updateElementTypeSchema,
} from './element-types.js';

describe('campos por tipo (HU-12)', () => {
  it('nombre, estado y prioridad siempre se muestran', () => {
    expect(HIDEABLE_FIELDS).not.toContain('name');
    expect(HIDEABLE_FIELDS).not.toContain('status');
    expect(HIDEABLE_FIELDS).not.toContain('priority');
    expect(hiddenFieldsSchema.safeParse(['status']).success).toBe(false);
  });

  it('deja los ocultos en el orden de la ficha y sin repetidos', () => {
    expect(hiddenFieldsSchema.parse(['notes', 'pages', 'pages'])).toEqual(['pages', 'notes']);
  });

  it('showsField dice si la ficha muestra un campo', () => {
    expect(showsField(['pages'], 'pages')).toBe(false);
    expect(showsField(['pages'], 'author')).toBe(true);
  });

  it('los tipos iniciales son válidos: sus etiquetas y sus campos ocultos pasan la validación', () => {
    for (const type of DEFAULT_ELEMENT_TYPES) {
      expect(labelsInput.safeParse(type.labels).success).toBe(true);
      expect(hiddenFieldsSchema.parse(type.hiddenFields)).toEqual(type.hiddenFields);
    }
  });
});

describe('resolveFieldLabels', () => {
  it('usa el nombre propio y, en lo demás, el de omisión', () => {
    const labels = resolveFieldLabels({ platform: 'Editorial' });

    expect(labels.platform).toBe('Editorial');
    expect(labels.sponsor).toBe(DEFAULT_FIELD_LABELS.sponsor);
  });
});

describe('fieldLabelsInputSchema', () => {
  it('quita espacios y no guarda un nombre igual al de omisión', () => {
    expect(
      fieldLabelsInputSchema.parse({ platform: ' Editorial ', sponsor: 'Patrocinador' }),
    ).toEqual({ platform: 'Editorial' });
  });

  it('rechaza un campo que no existe', () => {
    expect(fieldLabelsInputSchema.safeParse({ passwordHash: 'x' }).success).toBe(false);
  });

  it.each([
    ['vacío', ''],
    ['muy largo', 'x'.repeat(61)],
  ])('rechaza un nombre %s', (_caso, label) => {
    expect(fieldLabelsInputSchema.safeParse({ platform: label }).success).toBe(false);
  });

  it('rechaza el nombre de otro campo, sin distinguir mayúsculas, y señala el campo', () => {
    const result = fieldLabelsInputSchema.safeParse({ platform: 'NIVEL' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['platform']);
    expect(result.error?.issues[0]?.message).toContain('Nivel');
  });

  it('rechaza dos nombres propios iguales', () => {
    const result = fieldLabelsInputSchema.safeParse({ platform: 'Fuente', sponsor: 'fuente' });

    expect(result.success).toBe(false);
  });

  it('permite que dos campos intercambien sus nombres', () => {
    expect(
      fieldLabelsInputSchema.safeParse({ platform: 'Patrocinador', sponsor: 'Plataforma' }).success,
    ).toBe(true);
  });
});

describe('fieldLabelsFormSchema', () => {
  it('un campo en blanco vuelve al nombre por omisión', () => {
    expect(
      fieldLabelsFormSchema.parse({ platform: 'Editorial', sponsor: '   ', level: '' }),
    ).toEqual({ platform: 'Editorial' });
  });
});

describe('updateElementTypeSchema', () => {
  it('exige algún cambio', () => {
    expect(updateElementTypeSchema.safeParse({}).success).toBe(false);
  });

  it('acepta dejar las etiquetas vacías', () => {
    expect(updateElementTypeSchema.parse({ labels: {} })).toEqual({ labels: {} });
  });
});
