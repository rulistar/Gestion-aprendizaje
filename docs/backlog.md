# Product Backlog

> Lista priorizada de todo lo que el producto debe hacer. La ordena el **Product Owner**. Nada entra al desarrollo sin estar aquí.
> Última actualización: 2026-11-05 (Sprint 0).

## Cómo leer este documento

- **HU** = historia de usuario: _Como [rol], quiero [acción], para [beneficio]_.
- **TEC** = habilitador técnico: trabajo que el usuario no ve, pero que hace posibles las historias.
- **Puntos** = esfuerzo relativo (1, 2, 3, 5, 8), no horas. Capacidad: ~21 puntos por sprint de 2 semanas.
- **Prioridad (MoSCoW):** 🔴 Imprescindible (_Must_) · 🟡 Importante (_Should_) · 🟢 Deseable (_Could_).

## Decisiones del Product Owner (2026-11-05)

| Tema | Decisión |
|---|---|
| Nombre | **Gestor de Aprendizaje** (antes "Gestor de cursos"): más genérico, para cursos, lecturas u otros temas. |
| Ecosistema | Tres desarrollos **separados e integrados**, cada uno con su función: Gestor de Proyectos, Gestor de Aprendizaje y Lexika (idiomas). Cada uno con su repo, BD y despliegue. |
| Sincronización | Gestor de Proyectos recibe el **avance**, las **fechas** y el **estado**, sincronizados. |
| Módulos | El Gestor de Aprendizaje crece por módulos; el primero es la captura de elementos. |
| Usuarios | Como Gestor de Proyectos: invitación, espacios y roles. |
| Estructura | Hasta **3 niveles**: Capítulo, Curso (misma ficha que el elemento) o Actividad. Diseño en [ADR-0002](adr/ADR-0002-elementos-de-aprendizaje.md). |
| Etiquetas | Los nombres de los campos **se pueden cambiar por tipo de elemento**. |
| Duración | Horas totales = semanas × días por semana × horas por día, **o capturadas a mano** (manda lo capturado). |
| Fechas reales | Automáticas al cambiar el estado y **editables**. |
| Catálogos | Plataforma, patrocinador, categoría y nivel son **catálogos editables**. |
| Seguridad | Prevalecen las medidas de seguridad de Gestor de Proyectos. Producción gratuita. |

## Sprint 0 — cimientos (en curso)

| ID | Elemento | Puntos |
|---|---|---|
| TEC-00 | Estructura base del monorepo: herramientas, `/health`, seguridad HTTP (helmet, CORS, límite de peticiones), CI, acta y ADRs | 5 |

## Backlog priorizado

| ID | Prioridad | Historia | Puntos | Sprint propuesto |
|---|---|---|---|---|
| TEC-01 | 🔴 | Base de datos: Prisma + PostgreSQL, BD de pruebas, trazabilidad y borrado lógico (como en Gestor de Proyectos) | 5 | 1 |
| TEC-02 | 🔴 | Acceso reutilizado de Gestor de Proyectos: primer Admin (`setup:admin`), inicio y cierre de sesión, invitaciones, espacios con roles | 8 | 1 |
| TEC-03 | 🔴 | Web: enrutador, TanStack Query, componentes shadcn/ui, menú y pantalla de inicio de sesión | 3 | 1 |
| HU-01 | 🔴 | Como Admin, quiero administrar los catálogos (plataforma, patrocinador, categoría, nivel, tipo de actividad), para elegirlos en las fichas sin duplicados | 5 | 1 |
| HU-02 | 🔴 | Como Admin, quiero definir tipos de elemento (Curso, Lectura, Otro…) con el nombre de cada campo, para que la ficha use las palabras de cada tipo | 5 | 2 |
| HU-03 | 🔴 | Como usuario, quiero capturar y editar la ficha de un elemento (con la duración calculada), para registrar lo que quiero aprender | 5 | 2 |
| HU-04 | 🔴 | Como usuario, quiero armar la estructura de un elemento en hasta 3 niveles (capítulos, cursos y actividades), para organizarlo como el contenido real | 8 | 2 |
| HU-05 | 🔴 | Como usuario, quiero ver la lista de mis elementos con su avance, para saber cómo voy | 3 | 2 |
| TEC-04 | 🔴 | Despliegue gratuito (verificar los límites de Render y Neon con dos apps) | 3 | 3 |
| TEC-05 | 🟡 | Recorrido en el navegador con Playwright y su check en el CI | 3 | 3 |
| TEC-06 | 🟡 | Medir la cobertura de pruebas en el CI (objetivo 3 del acta) | 2 | 3 |
| INT-01 | 🔴 | ADR de integración con Gestor de Proyectos: qué se sincroniza, en qué dirección, tokens de API y webhooks | 3 | 3 |
| INT-02 | 🔴 | Sincronizar avance, fechas y estado con Gestor de Proyectos | 8 | 4 |
| HU-06 | 🟡 | Exportar e importar (JSON y CSV), incluidos los respaldos del prototipo "Gestor de cursos" | 5 | — |
| HU-07 | 🟡 | Papelera: borrado lógico restaurable; físico solo desde la papelera (Admin) | 3 | — |
| HU-08 | 🟢 | Tablero por estado y gráficas (elementos por mes de término) | 5 | — |
| INT-03 | 🟢 | Integración con Lexika (cuando exista) | — | — |

## Pendientes de definir (al escribir las historias)

- ¿El elemento lleva **prioridad** (Alta, Media, Baja) como en el prototipo?
- Lista inicial de **tipos de actividad** (propuesta: la del prototipo).
- Etiquetas por omisión de **Lectura** (por ejemplo, ¿páginas en vez de semanas?).
- Nombre del repo en GitHub.
