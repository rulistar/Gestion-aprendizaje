// Resumen de cobertura para el CI (TEC-06): lee el coverage-summary.json de cada paquete y escribe
// una tabla en Markdown. En GitHub Actions se manda a $GITHUB_STEP_SUMMARY y aparece en el resumen
// del job. Uso: node scripts/coverage-summary.js
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const packages = [
  ['packages/shared', 'Reglas compartidas (shared)'],
  ['apps/api', 'API'],
];
const metrics = [
  ['lines', 'Líneas'],
  ['statements', 'Sentencias'],
  ['functions', 'Funciones'],
  ['branches', 'Ramas'],
];

const rows = packages.map(([dir, label]) => {
  const file = `${dir}/coverage/coverage-summary.json`;
  if (!existsSync(file)) return `| ${label} | ${metrics.map(() => 'sin datos').join(' | ')} |`;
  const { total } = JSON.parse(readFileSync(file, 'utf8'));
  return `| ${label} | ${metrics.map(([key]) => `${total[key].pct} %`).join(' | ')} |`;
});

const markdown = [
  '## Cobertura de pruebas',
  '',
  `| Paquete | ${metrics.map(([, name]) => name).join(' | ')} |`,
  `|---|${metrics.map(() => '---:').join('|')}|`,
  ...rows,
  '',
  'Mínimo: 70 % en cada medida (objetivo 3 del acta). Si un paquete baja, el paso de pruebas falla.',
  '',
].join('\n');

console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
