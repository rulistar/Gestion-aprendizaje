import { describe, expect, it } from 'vitest';
import { createCatalogItemSchema, platformFitsType, updateCatalogItemSchema } from './catalogs.js';

describe('platformFitsType (HU-16)', () => {
  it('una lectura solo usa editoriales', () => {
    expect(platformFitsType({ publisher: true }, true)).toBe(true);
    expect(platformFitsType({ publisher: false }, true)).toBe(false);
  });

  it('los demás tipos solo usan plataformas', () => {
    expect(platformFitsType({ publisher: false }, false)).toBe(true);
    expect(platformFitsType({ publisher: true }, false)).toBe(false);
  });
});

describe('valores del catálogo (HU-16)', () => {
  it('al crear, indicar si es editorial es opcional', () => {
    expect(createCatalogItemSchema.safeParse({ kind: 'PLATFORM', name: 'Alfaomega' }).success).toBe(
      true,
    );
    expect(
      createCatalogItemSchema.safeParse({ kind: 'PLATFORM', name: 'Alfaomega', publisher: true })
        .success,
    ).toBe(true);
  });

  it('cambiar solo si es editorial es un cambio válido', () => {
    expect(updateCatalogItemSchema.safeParse({ publisher: false }).success).toBe(true);
    expect(updateCatalogItemSchema.safeParse({}).success).toBe(false);
  });
});
