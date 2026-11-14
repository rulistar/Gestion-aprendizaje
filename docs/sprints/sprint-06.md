# Sprint 6 — exportar, importar y ver el avance

- **Fechas:** 2026-11-13 (cerrado el mismo día; se planeó hasta el 2026-11-26)
- **Objetivo:** que la información entre y salga de la app (respaldos en JSON, CSV para Excel y los respaldos del prototipo "Gestor de cursos"), y que el avance se vea de un vistazo en un tablero y en gráficas.
- **Capacidad:** 10 puntos (decisión del PO, 2026-11-12): lo que queda del backlog.

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-06 | Exportar e importar (JSON y CSV), incluidos los respaldos del prototipo "Gestor de cursos" | 5 | Terminado (JSON y CSV; el formato del prototipo, pendiente) |
| HU-08 | Tablero por estado y gráficas (elementos por mes de término) | 5 | Terminado |

## Notas

- **Orden:** primero HU-06, para que el PO pueda cargar sus datos reales del prototipo; las gráficas de HU-08 se prueban mejor con esos datos.
- **Referencia:** HU-13 y HU-14 de Gestor de Proyectos (exportar en CSV compatible con Excel y JSON de respaldo; cargar con vista previa antes de escribir y sin borrar nada) y HU-12 (gráficas). Como allá, sin librería de Excel: CSV con BOM.
- **Decidido (HU-06, PO 2026-11-12):** exporta cualquier miembro (todo lo que ve en el espacio) e importa solo el Admin, como en Proyectos. Importar **solo agrega**: nunca borra ni sobrescribe; un elemento con el mismo tipo y nombre se omite (volver a cargar el mismo archivo no duplica), y los tipos y valores de catálogo que falten se crean. Siempre hay vista previa antes de escribir.
- **Formato (HU-06):** el respaldo habla en nombres (tipo, plataforma, autor...), no en IDs, y la estructura va como lista plana en orden de lectura con su profundidad. El CSV (con BOM, para Excel) tiene una fila por elemento (profundidad 0) y por nodo (1 a 3), se puede volver a importar y acepta `;`, coma decimal, fechas día/mes/año y estados en español. Las celdas que empiezan con `= + - @` se protegen con un apóstrofo al exportar (inyección de fórmulas).
- **Pendiente (HU-06):** el respaldo del prototipo "Gestor de cursos" no se tenía a mano. Falta un lector de ese formato: con un archivo real se agrega como un tercer formato de `readBackupText` (shared) sin tocar la API.
- **Decidido (HU-08, PO 2026-11-13):** una columna por estado (los cinco del elemento); se cambia el estado arrastrando la tarjeta a otra columna (y con un selector en la tarjeta, para pantallas táctiles), solo quien puede editar. Gráficas: elementos por mes de término (fin real o, si no hay, estimado) divididos por estado, y totales por estado; se pueden ocultar. Sin librerías nuevas: SVG a mano y arrastrar nativo del navegador.
- **Fuera de este sprint:** INT-04 sigue esperando TEC-08 y HU-18 en la v2 de Gestor de Proyectos.

## Cierre (2026-11-13)

- **Entregado:** 2 de 2 elementos, 10 puntos (PR 36 y 37). Objetivo cumplido en lo esencial: la información entra y sale de la app (JSON y CSV para Excel, con vista previa antes de escribir) y el avance se ve de un vistazo en un tablero por estado y en gráficas. Del objetivo queda fuera el respaldo del prototipo "Gestor de cursos", que no se tenía a mano.
- **Pruebas:** 290 en la API, todas en verde, más las nuevas de `shared` (respaldo, CSV y tablero). Lint y tipos en verde.
- **Sin migraciones ni dependencias nuevas:** el respaldo habla en nombres y la API crea lo que falte; las gráficas son SVG a mano.

### Lo que aprendimos

- **Poner la lógica en `shared` y la API delgada rindió.** Leer, validar y convertir el CSV, calcular los meses y armar la ficha para mover una tarjeta son funciones puras con pruebas; la API y la web solo las llaman.
- **El lint encontró lo que no se ve.** Tres caracteres BOM invisibles (para Excel) estaban escritos literales en el código y `no-irregular-whitespace` los detuvo antes del PR. Los caracteres invisibles se escriben siempre con su escape (`\uFEFF`).
- **Importar solo agregando simplifica todo.** Sin borrar ni sobrescribir no hace falta preguntar por conflictos; volver a cargar el mismo archivo no duplica nada y una importación equivocada se deshace desde la papelera.
- **El CSV es un ejercicio de seguridad, no solo de formato.** Un texto que empieza con `=`, `+`, `-` o `@` se ejecutaría como fórmula al abrirlo en Excel; se protege al exportar y se deshace al importar.

### Pendiente

- **Respaldo del prototipo "Gestor de cursos":** con un archivo real se agrega como tercer formato de `readBackupText` (`shared`), sin tocar la API.
- **INT-04:** espera TEC-08 y HU-18 en la v2 de Gestor de Proyectos.
- **Próximo sprint:** el backlog ya no tiene historias libres. El PO decide qué entra.
