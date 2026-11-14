import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupSchema,
  backupToCsv,
  csvToBackup,
  parseCsv,
  readBackupText,
  structureIssues,
  type Backup,
  type BackupFicha,
} from './backup.js';

const ficha = (overrides: Partial<BackupFicha> = {}): BackupFicha => ({
  name: 'Curso de Go',
  type: 'Curso',
  platform: 'Udemy',
  sponsor: null,
  category: 'Programación',
  level: 'Básico',
  author: null,
  genre: null,
  pages: null,
  durationWeeks: 4,
  daysPerWeek: 5,
  hoursPerDay: 1.5,
  manualTotalHours: null,
  actualHours: null,
  estimatedStart: '2026-01-05',
  estimatedEnd: '2026-02-01',
  actualStart: null,
  actualEnd: null,
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  notes: null,
  ...overrides,
});

const backup: Backup = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  elements: [
    {
      ...ficha({ notes: 'línea 1\nlínea 2, "con comillas"' }),
      nodes: [
        { kind: 'CHAPTER', depth: 1, name: 'Introducción' },
        {
          kind: 'ACTIVITY',
          depth: 2,
          name: 'Hola, mundo',
          activityType: 'Video o lección',
          durationMinutes: 15,
          status: 'DONE',
          estimatedStart: null,
          estimatedEnd: null,
          actualStart: '2026-01-06',
          actualEnd: '2026-01-06',
        },
        { kind: 'COURSE', depth: 1, ...ficha({ name: 'Avanzado', status: 'NOT_STARTED' }) },
        { kind: 'CHAPTER', depth: 2, name: 'Concurrencia' },
        {
          kind: 'ACTIVITY',
          depth: 3,
          name: 'Goroutines',
          activityType: null,
          durationMinutes: null,
          status: 'PENDING',
          estimatedStart: null,
          estimatedEnd: null,
          actualStart: null,
          actualEnd: null,
        },
      ],
    },
    {
      ...ficha({
        name: 'Dune',
        type: 'Lectura',
        platform: 'Debolsillo',
        category: null,
        level: null,
        author: 'Frank Herbert',
        genre: 'Ciencia ficción',
        pages: 600,
        durationWeeks: null,
        hoursPerDay: null,
        manualTotalHours: 20,
        actualHours: 18.5,
        status: 'DONE',
        priority: 'LOW',
      }),
      nodes: [],
    },
  ],
};

describe('el respaldo en JSON', () => {
  it('se lee de vuelta tal como se escribió', () => {
    const result = readBackupText(JSON.stringify(backup));
    expect(result).toEqual({ ok: true, backup });
  });

  it('rechaza un archivo que no es un respaldo, con la razón', () => {
    const result = readBackupText(JSON.stringify({ format: 'otro', version: 1, elements: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('No es un respaldo');
  });

  it('un JSON roto da un mensaje claro', () => {
    expect(readBackupText('{ "format": ')).toEqual({
      ok: false,
      errors: ['El archivo no es un JSON válido'],
    });
  });

  it('señala el elemento y el nodo donde está el error', () => {
    const broken = structuredClone(backup);
    broken.elements[1]!.pages = -3;
    const parsed = backupSchema.safeParse(broken);
    expect(parsed.success).toBe(false);
    const result = readBackupText(JSON.stringify(broken));
    if (!result.ok) expect(result.errors[0]).toMatch(/^elemento 2, pages:/);
  });

  it('el fin no puede ser anterior al inicio', () => {
    const broken = structuredClone(backup);
    broken.elements[0]!.estimatedEnd = '2025-12-31';
    const result = readBackupText(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toContain('El fin no puede ser anterior');
  });
});

describe('las reglas del árbol', () => {
  it('un nodo cuelga del último de la profundidad anterior', () => {
    expect(
      structureIssues([
        { depth: 1, kind: 'CHAPTER' },
        { depth: 2, kind: 'ACTIVITY' },
        { depth: 1, kind: 'COURSE' },
        { depth: 2, kind: 'CHAPTER' },
        { depth: 3, kind: 'ACTIVITY' },
      ]),
    ).toEqual([]);
  });

  it('no se puede saltar un nivel, ni colgar algo de una actividad, ni un capítulo en el nivel 3', () => {
    expect(structureIssues([{ depth: 3, kind: 'ACTIVITY' }])).toEqual([
      { index: 0, message: 'Le falta el nodo del nivel anterior' },
    ]);
    expect(
      structureIssues([
        { depth: 1, kind: 'ACTIVITY' },
        { depth: 2, kind: 'ACTIVITY' },
      ]),
    ).toEqual([{ index: 1, message: 'Ese tipo de nodo no cabe en este lugar del árbol' }]);
    expect(
      structureIssues([
        { depth: 1, kind: 'CHAPTER' },
        { depth: 2, kind: 'CHAPTER' },
        { depth: 3, kind: 'CHAPTER' },
      ]),
    ).toEqual([{ index: 2, message: 'Ese tipo de nodo no cabe en este lugar del árbol' }]);
  });

  it('el respaldo con una estructura imposible se rechaza', () => {
    const broken = structuredClone(backup);
    broken.elements[0]!.nodes = [
      {
        kind: 'ACTIVITY',
        depth: 1,
        name: 'A',
        activityType: null,
        durationMinutes: null,
        status: 'PENDING',
        estimatedStart: null,
        estimatedEnd: null,
        actualStart: null,
        actualEnd: null,
      },
      { kind: 'CHAPTER', depth: 2, name: 'Dentro de una actividad' },
    ];
    expect(readBackupText(JSON.stringify(broken)).ok).toBe(false);
  });
});

describe('el CSV para Excel', () => {
  it('lleva BOM y una fila por elemento y por nodo', () => {
    const csv = backupToCsv(backup);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    // Encabezado + 2 elementos + 5 nodos
    expect(parseCsv(csv).rows).toHaveLength(8);
  });

  it('exporta y vuelve a importar sin perder nada', () => {
    expect(csvToBackup(backupToCsv(backup))).toEqual({ ok: true, backup });
  });

  it('Horas totales es informativa: lo calculado no se vuelve horas capturadas', () => {
    const result = csvToBackup(backupToCsv(backup));
    expect(result.ok && result.backup.elements[0]!.manualTotalHours).toBe(null);
    // 4 semanas × 5 días × 1.5 horas
    expect(backupToCsv(backup)).toContain(',30,');
  });

  it('protege contra fórmulas de Excel y lo deshace al leerlo', () => {
    const risky: Backup = {
      ...backup,
      elements: [{ ...ficha({ name: '=HYPERLINK("http://x")', notes: '-1+1' }), nodes: [] }],
    };
    const csv = backupToCsv(risky);
    expect(csv).toContain(`'=HYPERLINK`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csvToBackup(csv)).toEqual({ ok: true, backup: risky });
  });

  it('acepta punto y coma, coma decimal, fechas día/mes/año y estados en español', () => {
    const csv = [
      'Profundidad;Clase;Nombre;Tipo;Estado;Prioridad;Inicio estimado;Horas por día',
      '0;Elemento;Go;Curso;En curso;alta;05/01/2026;1,5',
      '1;Capítulo;Intro;;;;;',
      '2;Actividad;Hola;;Hecha;;;',
    ].join('\n');
    const result = csvToBackup(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [element] = result.backup.elements;
    expect(element).toMatchObject({
      name: 'Go',
      type: 'Curso',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      estimatedStart: '2026-01-05',
      hoursPerDay: 1.5,
      daysPerWeek: 5,
    });
    expect(element!.nodes.map((node) => node.kind)).toEqual(['CHAPTER', 'ACTIVITY']);
    expect(element!.nodes[1]).toMatchObject({ status: 'DONE' });
  });

  it('los encabezados no distinguen acentos ni mayúsculas', () => {
    const csv = 'PROFUNDIDAD,clase,NOMBRE,tipo,categoria\n0,Elemento,Go,Curso,Programación';
    const result = csvToBackup(csv);
    expect(result.ok && result.backup.elements[0]!.category).toBe('Programación');
  });

  it('señala la fila y la columna de cada error', () => {
    const csv = [
      'Profundidad,Clase,Nombre,Tipo,Estado,Páginas',
      '0,Elemento,Go,Curso,Casi listo,',
      '0,Elemento,Dune,Lectura,,abc',
    ].join('\n');
    const result = csvToBackup(csv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('Fila 2: Estado no válido ("Casi listo")');
    expect(result.errors.some((error) => error.startsWith('Fila 3: Páginas:'))).toBe(true);
  });

  it('avisa de la estructura imposible con la fila del problema', () => {
    const csv = [
      'Profundidad,Clase,Nombre,Tipo',
      '0,Elemento,Go,Curso',
      '1,Actividad,A,',
      '2,Actividad,B,',
    ].join('\n');
    expect(csvToBackup(csv)).toEqual({
      ok: false,
      errors: ['Fila 4: Ese tipo de nodo no cabe en este lugar del árbol'],
    });
  });

  it('un nodo antes de cualquier elemento, o sin las columnas básicas, se rechaza', () => {
    const orphan = csvToBackup('Profundidad,Clase,Nombre\n1,Capítulo,X');
    expect(orphan.ok).toBe(false);
    if (!orphan.ok) expect(orphan.errors[0]).toContain('Fila 2');

    expect(csvToBackup('Nombre\nGo')).toEqual({
      ok: false,
      errors: ['Faltan columnas: Profundidad, Clase'],
    });
    expect(csvToBackup('')).toEqual({ ok: false, errors: ['El archivo está vacío'] });
  });

  it('readBackupText distingue por el contenido: lo que no empieza con "{" es CSV', () => {
    const result = readBackupText(backupToCsv(backup));
    expect(result).toEqual({ ok: true, backup });
  });
});

describe('parseCsv', () => {
  it('lee comillas, comillas dobles, saltos de línea dentro de una celda y fin sin salto', () => {
    expect(parseCsv('a,"b ""c""",d\r\n"x\ny",,z').rows).toEqual([
      ['a', 'b "c"', 'd'],
      ['x\ny', '', 'z'],
    ]);
  });

  it('ignora las filas en blanco', () => {
    expect(parseCsv('a,b\n\n,\nc,d\n').rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});
