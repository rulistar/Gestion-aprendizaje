import { z } from 'zod';
import { catalogKindSchema } from './catalogs.js';
import {
  ACTIVITY_STATUS_LABELS,
  activityContentSchema,
  allowedChildKinds,
  MAX_NODE_LEVEL,
  nodeKindLabel,
  type NodeKind,
} from './element-nodes.js';
import {
  checkDateOrder,
  computeTotalHours,
  ELEMENT_PRIORITY_LABELS,
  ELEMENT_STATUS_LABELS,
  elementFichaSchema,
} from './elements.js';

/**
 * Respaldo de un espacio (HU-06): los elementos con su estructura, en JSON o en CSV (para Excel).
 * Habla en nombres, no en IDs (tipo, plataforma, autor...): así un respaldo sirve en cualquier
 * espacio y se puede editar a mano. La estructura va en una lista plana en orden de lectura, cada
 * nodo con su profundidad (1 a 3), igual que las filas del CSV.
 */
export const BACKUP_FORMAT = 'gestor-aprendizaje';
export const BACKUP_VERSION = 1;
/** Topes para que un archivo enorme no deje ocupado al servidor */
export const MAX_BACKUP_ELEMENTS = 2000;
export const MAX_BACKUP_NODES = 20000;

const f = elementFichaSchema.shape;
const a = activityContentSchema.shape;

/** Un valor de catálogo, por su nombre */
const catalogName = z
  .string()
  .trim()
  .min(1, 'El nombre no puede estar vacío')
  .max(80, 'Máximo 80 caracteres')
  .nullable()
  .default(null);

/** La ficha del respaldo: las mismas reglas de la ficha, con los catálogos por nombre */
const fichaShape = {
  name: f.name,
  type: z.string().trim().min(1, 'El tipo es obligatorio').max(80, 'Máximo 80 caracteres'),
  platform: catalogName,
  sponsor: catalogName,
  category: catalogName,
  level: catalogName,
  author: catalogName,
  genre: catalogName,
  pages: f.pages,
  durationWeeks: f.durationWeeks,
  daysPerWeek: f.daysPerWeek,
  hoursPerDay: f.hoursPerDay,
  manualTotalHours: f.manualTotalHours,
  actualHours: f.actualHours,
  estimatedStart: f.estimatedStart,
  estimatedEnd: f.estimatedEnd,
  actualStart: f.actualStart,
  actualEnd: f.actualEnd,
  status: f.status,
  priority: f.priority,
  notes: f.notes,
};

const depth = z.number().int().min(1).max(MAX_NODE_LEVEL);

export const backupNodeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CHAPTER'), depth, name: f.name }),
  z.object({ kind: z.literal('COURSE'), depth, ...fichaShape }).superRefine(checkDateOrder),
  z
    .object({
      kind: z.literal('ACTIVITY'),
      depth,
      name: a.name,
      activityType: catalogName,
      durationMinutes: a.durationMinutes,
      status: a.status,
      estimatedStart: a.estimatedStart,
      estimatedEnd: a.estimatedEnd,
      actualStart: a.actualStart,
      actualEnd: a.actualEnd,
    })
    .superRefine(checkDateOrder),
]);
export type BackupNode = z.infer<typeof backupNodeSchema>;

/** La ficha de un elemento, sin su estructura (una fila de profundidad 0 del CSV) */
export const backupFichaSchema = z.object(fichaShape).superRefine(checkDateOrder);
export type BackupFicha = z.infer<typeof backupFichaSchema>;

/**
 * Las reglas del árbol (ADR-0002 §2) sobre la lista plana: cada nodo cuelga del último de la
 * profundidad anterior, y esa clase de padre debe permitirlo. Devuelve el lugar y el problema.
 */
export function structureIssues(
  nodes: readonly { depth: number; kind: NodeKind }[],
): { index: number; message: string }[] {
  const issues: { index: number; message: string }[] = [];
  const path: { kind: NodeKind; level: number }[] = [];
  for (const [index, node] of nodes.entries()) {
    if (node.depth > path.length + 1) {
      issues.push({ index, message: 'Le falta el nodo del nivel anterior' });
      continue;
    }
    path.length = node.depth - 1;
    const parent = path.at(-1) ?? null;
    if (!allowedChildKinds(parent).includes(node.kind)) {
      issues.push({ index, message: 'Ese tipo de nodo no cabe en este lugar del árbol' });
    }
    path.push({ kind: node.kind, level: node.depth });
  }
  return issues;
}

export const backupElementSchema = z
  .object({ ...fichaShape, nodes: z.array(backupNodeSchema).max(MAX_BACKUP_NODES).default([]) })
  .superRefine((element, ctx) => {
    checkDateOrder(element, ctx);
    for (const { index, message } of structureIssues(element.nodes)) {
      ctx.addIssue({ code: 'custom', path: ['nodes', index], message });
    }
  });
export type BackupElement = z.infer<typeof backupElementSchema>;

export const backupSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT, { error: 'No es un respaldo de Gestor de Aprendizaje' }),
    version: z.literal(BACKUP_VERSION, { error: 'La versión del respaldo no es compatible' }),
    exportedAt: z.string().optional(),
    elements: z
      .array(backupElementSchema)
      .max(MAX_BACKUP_ELEMENTS, `Máximo ${MAX_BACKUP_ELEMENTS} elementos por archivo`),
  })
  .superRefine((backup, ctx) => {
    const nodes = backup.elements.reduce((sum, element) => sum + element.nodes.length, 0);
    if (nodes > MAX_BACKUP_NODES) {
      ctx.addIssue({
        code: 'custom',
        path: ['elements'],
        message: `Máximo ${MAX_BACKUP_NODES} nodos por archivo`,
      });
    }
  });
export type Backup = z.infer<typeof backupSchema>;

/** Qué pasaría (o qué pasó) al importar: nada se borra ni se sobrescribe, solo se agrega */
export const importSummarySchema = z.object({
  /** Elementos que se crean y los nodos de su estructura */
  elements: z.number().int(),
  nodes: z.number().int(),
  /** Los que no se crean: ya existe uno con ese nombre y tipo, o se repite en el archivo */
  skipped: z.array(z.object({ name: z.string(), reason: z.enum(['EXISTS', 'REPEATED']) })),
  /** Tipos de elemento y valores de catálogo que no existían y se crean */
  newTypes: z.array(z.string()),
  newCatalogItems: z.array(z.object({ kind: catalogKindSchema, name: z.string() })),
});
export type ImportSummary = z.infer<typeof importSummarySchema>;

/** Respuesta de POST .../import y .../import/preview */
export const importResultSchema = importSummarySchema.extend({ applied: z.boolean() });
export type ImportResult = z.infer<typeof importResultSchema>;

// ───────────────────────── Lectura de errores ─────────────────────────

const MAX_REPORTED_ERRORS = 20;

function limitErrors(errors: string[]): string[] {
  if (errors.length <= MAX_REPORTED_ERRORS) return errors;
  return [
    ...errors.slice(0, MAX_REPORTED_ERRORS),
    `…y ${errors.length - MAX_REPORTED_ERRORS} errores más`,
  ];
}

/** "elements.2.nodes.5.pages" → "elemento 3, nodo 6, pages" */
function describePath(path: readonly PropertyKey[]): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const next = path[i + 1];
    if (key === 'elements' && typeof next === 'number') {
      parts.push(`elemento ${next + 1}`);
      i++;
    } else if (key === 'nodes' && typeof next === 'number') {
      parts.push(`nodo ${next + 1}`);
      i++;
    } else {
      parts.push(String(key));
    }
  }
  return parts.join(', ');
}

/** Los problemas de un respaldo, en palabras (máximo 20, para no inundar la pantalla) */
export function describeBackupIssues(error: z.ZodError): string[] {
  return limitErrors(
    error.issues.map((issue) => {
      const where = describePath(issue.path);
      return where ? `${where}: ${issue.message}` : issue.message;
    }),
  );
}

// ───────────────────────── CSV (para Excel) ─────────────────────────

/** Las columnas del CSV, en orden. "Horas totales" es informativa: al importar se ignora */
const CSV_COLUMNS = [
  'Profundidad',
  'Clase',
  'Nombre',
  'Tipo',
  'Plataforma',
  'Patrocinador',
  'Categoría',
  'Nivel',
  'Autor',
  'Género',
  'Páginas',
  'Semanas',
  'Días por semana',
  'Horas por día',
  'Horas capturadas',
  'Horas totales',
  'Horas reales',
  'Inicio estimado',
  'Fin estimado',
  'Inicio real',
  'Fin real',
  'Estado',
  'Prioridad',
  'Tipo de actividad',
  'Minutos',
  'Notas',
] as const;
type CsvColumn = (typeof CSV_COLUMNS)[number];

/** El nombre de cada campo del esquema, para decirle a quien edita en qué columna se equivocó */
const FIELD_COLUMN: Record<string, CsvColumn> = {
  name: 'Nombre',
  type: 'Tipo',
  platform: 'Plataforma',
  sponsor: 'Patrocinador',
  category: 'Categoría',
  level: 'Nivel',
  author: 'Autor',
  genre: 'Género',
  pages: 'Páginas',
  durationWeeks: 'Semanas',
  daysPerWeek: 'Días por semana',
  hoursPerDay: 'Horas por día',
  manualTotalHours: 'Horas capturadas',
  actualHours: 'Horas reales',
  estimatedStart: 'Inicio estimado',
  estimatedEnd: 'Fin estimado',
  actualStart: 'Inicio real',
  actualEnd: 'Fin real',
  status: 'Estado',
  priority: 'Prioridad',
  activityType: 'Tipo de actividad',
  durationMinutes: 'Minutos',
  notes: 'Notas',
};

/** Sin acentos ni mayúsculas: "Categoría", "categoria" y "CATEGORIA" son la misma columna */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/**
 * Excel ejecuta como fórmula una celda que empieza con = + - @ (inyección de fórmulas). Al
 * exportar se antepone un apóstrofo, que Excel no muestra; al importar se quita.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const guard = (text: string) => (FORMULA_START.test(text) ? `'${text}` : text);
const unguard = (text: string) =>
  text.startsWith("'") && FORMULA_START.test(text.slice(1)) ? text.slice(1) : text;

function csvCell(value: string): string {
  return /[",;\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

const cellText = (value: string | null) => (value === null ? '' : guard(value));
const cellNumber = (value: number | null) => (value === null ? '' : String(value));

/** El respaldo como CSV con BOM (para que Excel lea bien los acentos): una fila por elemento y nodo */
export function backupToCsv(backup: Backup): string {
  const rows: string[][] = [[...CSV_COLUMNS]];
  const row = (cells: Partial<Record<CsvColumn, string>>) =>
    rows.push(CSV_COLUMNS.map((column) => cells[column] ?? ''));

  const fichaCells = (ficha: BackupFicha) => ({
    Nombre: cellText(ficha.name),
    Tipo: cellText(ficha.type),
    Plataforma: cellText(ficha.platform),
    Patrocinador: cellText(ficha.sponsor),
    Categoría: cellText(ficha.category),
    Nivel: cellText(ficha.level),
    Autor: cellText(ficha.author),
    Género: cellText(ficha.genre),
    Páginas: cellNumber(ficha.pages),
    Semanas: cellNumber(ficha.durationWeeks),
    'Días por semana': String(ficha.daysPerWeek),
    'Horas por día': cellNumber(ficha.hoursPerDay),
    'Horas capturadas': cellNumber(ficha.manualTotalHours),
    'Horas totales': cellNumber(computeTotalHours(ficha)),
    'Horas reales': cellNumber(ficha.actualHours),
    'Inicio estimado': ficha.estimatedStart ?? '',
    'Fin estimado': ficha.estimatedEnd ?? '',
    'Inicio real': ficha.actualStart ?? '',
    'Fin real': ficha.actualEnd ?? '',
    Estado: ELEMENT_STATUS_LABELS[ficha.status],
    Prioridad: ELEMENT_PRIORITY_LABELS[ficha.priority],
    Notas: cellText(ficha.notes),
  });

  for (const element of backup.elements) {
    row({ Profundidad: '0', Clase: 'Elemento', ...fichaCells(element) });
    for (const node of element.nodes) {
      const base = { Profundidad: String(node.depth), Clase: nodeKindLabel(node.kind, node.depth) };
      if (node.kind === 'CHAPTER') row({ ...base, Nombre: cellText(node.name) });
      else if (node.kind === 'COURSE') row({ ...base, ...fichaCells(node) });
      else {
        row({
          ...base,
          Nombre: cellText(node.name),
          'Tipo de actividad': cellText(node.activityType),
          Minutos: cellNumber(node.durationMinutes),
          'Inicio estimado': node.estimatedStart ?? '',
          'Fin estimado': node.estimatedEnd ?? '',
          'Inicio real': node.actualStart ?? '',
          'Fin real': node.actualEnd ?? '',
          Estado: ACTIVITY_STATUS_LABELS[node.status],
        });
      }
    }
  }
  return `\uFEFF${rows.map((cells) => cells.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/**
 * Lee un CSV (comillas, saltos de línea dentro de una celda, BOM). El separador es la coma o, si
 * el archivo lo trae así (Excel en español de España), el punto y coma.
 */
export function parseCsv(text: string): { rows: string[][]; delimiter: ',' | ';' } {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const count = (char: string) => firstLine.split(char).length - 1;
  const delimiter = count(';') > count(',') ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char !== '"') cell += char;
      else if (source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return { rows: rows.filter((cells) => cells.some((value) => value.trim() !== '')), delimiter };
}

function lookup<T extends string>(value: string, labels: Record<T, string>): T | null {
  const wanted = fold(value);
  for (const [code, label] of Object.entries(labels) as [T, string][]) {
    if (fold(label) === wanted || code.toLowerCase() === wanted) return code;
  }
  return null;
}

/** Excel suele mostrar las fechas como 31/12/2026; se acepta ese día/mes/año además de AAAA-MM-DD */
function toIsoDay(text: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return text;
  return `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(2, '0')}`;
}

const CLASS_KINDS: Record<string, NodeKind> = {
  capitulo: 'CHAPTER',
  subcapitulo: 'CHAPTER',
  curso: 'COURSE',
  actividad: 'ACTIVITY',
};

export type CsvReadResult = { ok: true; backup: Backup } | { ok: false; errors: string[] };

/** Un CSV de este formato (el que exporta backupToCsv, editado o armado a mano) a un respaldo */
export function csvToBackup(text: string): CsvReadResult {
  const { rows, delimiter } = parseCsv(text);
  const header = rows[0];
  if (!header) return { ok: false, errors: ['El archivo está vacío'] };

  const index = new Map<CsvColumn, number>();
  for (const [position, title] of header.entries()) {
    const column = CSV_COLUMNS.find((candidate) => fold(candidate) === fold(title));
    if (column && !index.has(column)) index.set(column, position);
  }
  const missing = (['Profundidad', 'Clase', 'Nombre'] as const).filter((c) => !index.has(c));
  if (missing.length > 0) {
    return { ok: false, errors: [`Faltan columnas: ${missing.join(', ')}`] };
  }

  const errors: string[] = [];
  const elements: BackupElement[] = [];
  /** El número de fila del archivo de cada nodo del elemento en curso, para señalar un error */
  let nodeRows: number[] = [];
  let current: BackupElement | null = null;

  const closeElement = () => {
    if (!current) return;
    for (const { index: at, message } of structureIssues(current.nodes)) {
      errors.push(`Fila ${nodeRows[at] ?? '?'}: ${message}`);
    }
  };

  for (const [position, cells] of rows.slice(1).entries()) {
    const line = position + 2;
    const read = (column: CsvColumn) => {
      const at = index.get(column);
      return unguard((at === undefined ? '' : (cells[at] ?? '')).trim());
    };
    const orNull = (value: string) => (value === '' ? null : value);
    const number = (value: string) =>
      value === '' ? null : Number(delimiter === ';' ? value.replace(',', '.') : value);
    const day = (value: string) => (value === '' ? null : toIsoDay(value));
    const fail = (message: string) => errors.push(`Fila ${line}: ${message}`);

    const depthText = read('Profundidad');
    const rowDepth = Number(depthText);
    if (
      depthText === '' ||
      !Number.isInteger(rowDepth) ||
      rowDepth < 0 ||
      rowDepth > MAX_NODE_LEVEL
    ) {
      fail(
        `Profundidad no válida ("${depthText}"): usa 0 para el elemento y de 1 a ${MAX_NODE_LEVEL}`,
      );
      continue;
    }

    let kind: NodeKind | 'ELEMENT';
    if (rowDepth === 0) kind = 'ELEMENT';
    else {
      const found = CLASS_KINDS[fold(read('Clase'))];
      if (!found) {
        fail(`Clase no válida ("${read('Clase')}"): usa Capítulo, Subcapítulo, Curso o Actividad`);
        continue;
      }
      kind = found;
    }

    const status = read('Estado');
    const statusCode =
      status === ''
        ? undefined
        : kind === 'ACTIVITY'
          ? lookup(status, ACTIVITY_STATUS_LABELS)
          : lookup(status, ELEMENT_STATUS_LABELS);
    if (status !== '' && statusCode === null) fail(`Estado no válido ("${status}")`);
    const priority = read('Prioridad');
    const priorityCode = priority === '' ? undefined : lookup(priority, ELEMENT_PRIORITY_LABELS);
    if (priority !== '' && priorityCode === null) fail(`Prioridad no válida ("${priority}")`);

    const dates = {
      estimatedStart: day(read('Inicio estimado')),
      estimatedEnd: day(read('Fin estimado')),
      actualStart: day(read('Inicio real')),
      actualEnd: day(read('Fin real')),
    };
    const days = read('Días por semana');
    const ficha = {
      name: read('Nombre'),
      type: read('Tipo'),
      platform: orNull(read('Plataforma')),
      sponsor: orNull(read('Patrocinador')),
      category: orNull(read('Categoría')),
      level: orNull(read('Nivel')),
      author: orNull(read('Autor')),
      genre: orNull(read('Género')),
      pages: number(read('Páginas')),
      durationWeeks: number(read('Semanas')),
      ...(days !== '' && { daysPerWeek: number(days) }),
      hoursPerDay: number(read('Horas por día')),
      manualTotalHours: number(read('Horas capturadas')),
      actualHours: number(read('Horas reales')),
      ...dates,
      ...(statusCode && { status: statusCode }),
      ...(priorityCode && { priority: priorityCode }),
      notes: orNull(read('Notas')),
    };

    const report = (error: z.ZodError) => {
      for (const issue of error.issues) {
        const key = String(issue.path[0] ?? '');
        const column = FIELD_COLUMN[key];
        fail(`${column ? `${column}: ` : ''}${issue.message}`);
      }
    };

    if (kind === 'ELEMENT') {
      closeElement();
      const head = backupFichaSchema.safeParse(ficha);
      if (!head.success) {
        report(head.error);
        current = null;
        continue;
      }
      current = { ...head.data, nodes: [] };
      nodeRows = [];
      elements.push(current);
      continue;
    }

    if (!current) {
      fail('Antes de este renglón falta la fila del elemento (profundidad 0)');
      continue;
    }
    const raw =
      kind === 'CHAPTER'
        ? { kind, depth: rowDepth, name: ficha.name }
        : kind === 'COURSE'
          ? { kind, depth: rowDepth, ...ficha }
          : {
              kind,
              depth: rowDepth,
              name: ficha.name,
              activityType: orNull(read('Tipo de actividad')),
              durationMinutes: number(read('Minutos')),
              ...(statusCode && { status: statusCode }),
              ...dates,
            };
    const node = backupNodeSchema.safeParse(raw);
    if (!node.success) {
      report(node.error);
      continue;
    }
    current.nodes.push(node.data);
    nodeRows.push(line);
  }
  closeElement();

  if (errors.length > 0) return { ok: false, errors: limitErrors(errors) };
  const parsed = backupSchema.safeParse({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    elements,
  });
  return parsed.success
    ? { ok: true, backup: parsed.data }
    : { ok: false, errors: describeBackupIssues(parsed.error) };
}

/**
 * Lee el texto de un archivo de respaldo: si empieza con "{" es JSON; si no, se toma como CSV.
 * Devuelve el respaldo o los problemas, en palabras.
 */
export function readBackupText(text: string): CsvReadResult {
  if (
    !text
      .replace(/^\uFEFF/, '')
      .trimStart()
      .startsWith('{')
  )
    return csvToBackup(text);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['El archivo no es un JSON válido'] };
  }
  const parsed = backupSchema.safeParse(data);
  return parsed.success
    ? { ok: true, backup: parsed.data }
    : { ok: false, errors: describeBackupIssues(parsed.error) };
}
