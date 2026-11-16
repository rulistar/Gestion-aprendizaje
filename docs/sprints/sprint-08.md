# Sprint 8 — estado de libros y capítulos, y leer de nuevo

- **Fechas:** 2026-11-28 → 2026-12-11 (propuesta)
- **Objetivo:** que el estado de un libro y de sus capítulos se maneje como se piensa: a mano cuando se decide (Terminado, Cancelado, Pausado) o solo, según el avance del detalle; y poder volver a leer un libro sin perder la lectura anterior.
- **Capacidad:** 16 puntos (propuesta; el PO confirma).

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-20 | Estado a mano en los capítulos y subcapítulos (Pausado, Cancelado, Terminado) | 5 | Pendiente |
| HU-21 | El estado del libro sigue solo al avance del detalle | 8 | Pendiente |
| HU-22 | "Leer de nuevo": crea una copia del libro como nuevo | 3 | Pendiente |

## Notas

- **Orden:** HU-20, luego HU-21 (usa lo de HU-20) y al final HU-22. Un PR por elemento. Si una historia lleva migración, se fusiona antes de empezar la siguiente.
- **Decidido (PO, 2026-11-15) — estado a mano y automático:**
  - Libro y capítulo pueden tener un **estado a mano** opcional: Pausado, Cancelado o Terminado. Sin él, el estado es **automático** según el avance de lo que contiene: sin avance, No iniciado; con algo, En curso; con todo hecho, Terminado.
  - **Terminado a mano** muestra 100% y **no toca** las actividades. Mientras esté así, el automático no se aplica; solo cambia si el usuario cambia el estado. **Cancelado** no cuenta en el avance ni en los minutos del nivel de arriba (como una actividad cancelada). **Pausado** conserva su avance.
  - Gestor de Proyectos **sigue recibiendo la estructura completa** (fases y tareas); el libro y cada capítulo mandan su avance y estado nuevos.
- **Decidido (PO, 2026-11-15) — Leer de nuevo:** crea una **copia** y no toca el libro original. Copia nombre, tipo, plataforma, autor, páginas, la estructura completa y los minutos y fechas **estimados**. La copia queda como nueva: No iniciado, actividades Pendientes, sin fechas reales ni minutos reales y sin estado a mano. Se llama como el original más " (lectura 2)" (la siguiente, "(lectura 3)"): dos libros del mismo tipo con el mismo nombre dan problemas al importar y al sincronizar. No pide confirmación, porque no borra nada.
- **A definir al llegar a HU-21:**
  - El **tablero** (HU-08): arrastrar a Pausado, Cancelado o Terminado fija el estado a mano; arrastrar a No iniciado o En curso lo devuelve a automático.
  - La casilla **"Terminada"** de las lecturas (HU-17) pasa a ser Terminado a mano.
  - Las **fechas reales** automáticas (HU-03) cuando el estado cambia solo.
  - Cómo se guarda el estado a mano (columna nueva o un valor "automático") y qué se envía a Proyectos.
- **Fuera de este sprint:** el respaldo del prototipo "Gestor de cursos" (falta un archivo real) e INT-04.
