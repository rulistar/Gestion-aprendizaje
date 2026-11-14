# Sprint 6 — exportar, importar y ver el avance

- **Fechas:** 2026-11-13 → 2026-11-26
- **Objetivo:** que la información entre y salga de la app (respaldos en JSON, CSV para Excel y los respaldos del prototipo "Gestor de cursos"), y que el avance se vea de un vistazo en un tablero y en gráficas.
- **Capacidad:** 10 puntos (decisión del PO, 2026-11-12): lo que queda del backlog.

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-06 | Exportar e importar (JSON y CSV), incluidos los respaldos del prototipo "Gestor de cursos" | 5 | En revisión (rama `feat/hu-06-exportar-importar`) |
| HU-08 | Tablero por estado y gráficas (elementos por mes de término) | 5 | Pendiente |

## Notas

- **Orden:** primero HU-06, para que el PO pueda cargar sus datos reales del prototipo; las gráficas de HU-08 se prueban mejor con esos datos.
- **Referencia:** HU-13 y HU-14 de Gestor de Proyectos (exportar en CSV compatible con Excel y JSON de respaldo; cargar con vista previa antes de escribir y sin borrar nada) y HU-12 (gráficas). Como allá, sin librería de Excel: CSV con BOM.
- **Decidido (HU-06, PO 2026-11-12):** exporta cualquier miembro (todo lo que ve en el espacio) e importa solo el Admin, como en Proyectos. Importar **solo agrega**: nunca borra ni sobrescribe; un elemento con el mismo tipo y nombre se omite (volver a cargar el mismo archivo no duplica), y los tipos y valores de catálogo que falten se crean. Siempre hay vista previa antes de escribir.
- **Formato (HU-06):** el respaldo habla en nombres (tipo, plataforma, autor...), no en IDs, y la estructura va como lista plana en orden de lectura con su profundidad. El CSV (con BOM, para Excel) tiene una fila por elemento (profundidad 0) y por nodo (1 a 3), se puede volver a importar y acepta `;`, coma decimal, fechas día/mes/año y estados en español. Las celdas que empiezan con `= + - @` se protegen con un apóstrofo al exportar (inyección de fórmulas).
- **Pendiente (HU-06):** el respaldo del prototipo "Gestor de cursos" no se tenía a mano. Falta un lector de ese formato: con un archivo real se agrega como un tercer formato de `readBackupText` (shared) sin tocar la API.
- **Por decidir al llegar (HU-08):** qué columnas tiene el tablero (los estados del elemento) y si se puede cambiar el estado arrastrando, como en Proyectos.
- **Fuera de este sprint:** INT-04 sigue esperando TEC-08 y HU-18 en la v2 de Gestor de Proyectos.
