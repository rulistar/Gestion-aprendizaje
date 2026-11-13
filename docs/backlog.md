5 |5 |5 |5 |5 |5 |# Product Backlog

> Lista priorizada de todo lo que el producto debe hacer. La ordena el **Product Owner**. Nada entra al desarrollo sin estar aquí.
> Última actualización: 2026-11-08 (Sprint 5 planeado: HU-10 a HU-15).

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
| Sincronización | Gestor de Proyectos recibe el **avance**, las **fechas** y el **estado**, sincronizados. Solo de Aprendizaje a Proyectos, con la estructura completa y envío automático ([ADR-0004](adr/ADR-0004-integracion-gestor-proyectos.md), PO 2026-11-08). |
| Módulos | El Gestor de Aprendizaje crece por módulos; el primero es la captura de elementos. |
| Usuarios | Como Gestor de Proyectos: invitación, espacios y roles. |
| Estructura | Hasta **3 niveles**: Capítulo, Curso (misma ficha que el elemento) o Actividad. Diseño en [ADR-0002](adr/ADR-0002-elementos-de-aprendizaje.md). |
| Etiquetas | Los nombres de los campos **se pueden cambiar por tipo de elemento**. |
| Duración | Horas totales = semanas × días por semana × horas por día, **o capturadas a mano** (manda lo capturado). |
| Fechas reales | Automáticas al cambiar el estado y **editables**. |
| Catálogos | Plataforma, patrocinador, categoría y nivel son **catálogos editables**. |
| Seguridad | Prevalecen las medidas de seguridad de Gestor de Proyectos. Producción gratuita. |
| Prioridad | Cada elemento lleva prioridad **Alta, Media o Baja**, como el prototipo, y viaja a la prioridad del proyecto en Gestor de Proyectos (PO, 2026-11-08). |
| Ficha de Lectura | Nombre del libro, autor, editorial, número de páginas, fechas estimadas y reales, horas estimadas y reales, y género. **Autor** y **Género** son catálogos propios. **Horas reales** es para todos los tipos. **Cada tipo elige qué campos muestra** (PO, 2026-11-08). |
| Usuarios en la web | Sí a las pantallas de **miembros e invitaciones**, a **mi perfil** y a **administrar usuarios** (PO, 2026-11-08). |

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
| HU-09 | 🔴 | Como Admin, quiero restablecer una contraseña desde la terminal, para recuperar la cuenta si la olvido | 1 | 3 |
| TEC-04 | 🔴 | Despliegue gratuito (verificar los límites de Render y Neon con dos apps) | 3 | 3 |
| TEC-05 | 🟡 | Recorrido en el navegador con Playwright y su check en el CI | 3 | 3 |
| TEC-06 | 🟡 | Medir la cobertura de pruebas en el CI (objetivo 3 del acta) | 2 | 3 |
| INT-01 | 🔴 | ADR de integración con Gestor de Proyectos: qué se sincroniza, en qué dirección, tokens de API y webhooks ([ADR-0004](adr/ADR-0004-integracion-gestor-proyectos.md)) | 3 | 3 |
| INT-02 | 🔴 | Como usuario, quiero enviar un elemento a Gestor de Proyectos y que sus cambios lleguen solos, para no capturar dos veces (lado de Aprendizaje: bandeja de salida, vínculos y envío, probado contra un receptor de prueba) | 8 | 4 |
| INT-04 | 🔴 | Conectar la sincronización con Gestor de Proyectos real y activarla en producción (requiere TEC-08 y HU-18 de Proyectos, en su v2) | 3 | — |
| HU-06 | 🟡 | Exportar e importar (JSON y CSV), incluidos los respaldos del prototipo "Gestor de cursos" | 5 | — |
| HU-07 | 🟡 | Papelera: borrado lógico restaurable; físico solo desde la papelera (Admin) | 3 | 4 |
| HU-08 | 🟢 | Tablero por estado y gráficas (elementos por mes de término) | 5 | — |
| HU-10 | 🟡 | Como usuario, quiero darle prioridad (Alta, Media, Baja) a cada elemento y filtrar por ella, para saber qué estudiar primero (también llega a la prioridad del proyecto en Gestor de Proyectos) | 2 | 5 |
| HU-11 | 🟡 | Como usuario, quiero registrar autor, género, número de páginas y horas reales, para que la ficha de un libro tenga sus datos y pueda comparar horas estimadas contra reales (Autor y Género: catálogos nuevos; horas reales: todos los tipos) | 5 | 5 |
| HU-12 | 🟡 | Como Admin, quiero elegir qué campos muestra cada tipo de elemento, para que una Lectura no muestre lo que no usa (nivel, semanas, días por semana…). Incluye dejar Lectura como la pidió el PO, también en los espacios que ya existen | 3 | 5 |
| HU-13 | 🟡 | Como Admin, quiero ver los miembros de un espacio, cambiar su rol o quitarlos, e invitar a alguien desde la web, para no usar la API a mano (la API ya existe: TEC-02) | 5 | 5 |
| HU-14 | 🟡 | Como usuario, quiero cambiar mi nombre, mi correo y mi contraseña, para mantener mi cuenta al día (como HU-29 de Gestor de Proyectos) | 3 | 5 |
| HU-15 | 🟡 | Como Admin del sistema, quiero ver las cuentas, cambiar un correo, desactivar o reactivar una cuenta y generar un enlace para restablecer una contraseña, para administrar quién entra (como HU-30 y HU-54 de Gestor de Proyectos) | 5 | 5 |
| INT-03 | 🟢 | Integración con Lexika (cuando exista) | — | — |

## Pendientes de definir (al escribir las historias)

- Lista inicial de **tipos de actividad** (propuesta: la del prototipo).
- ¿Los demás tipos (Curso, Otro) también ocultan campos? Se decide al hacer HU-12.
