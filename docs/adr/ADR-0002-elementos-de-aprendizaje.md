# ADR-0002: Elementos de aprendizaje, su estructura y sus etiquetas

- **Estado:** Aceptado (PO, 2026-11-06)
- **Fecha:** 2026-11-05
- **Contexto:** Decisiones del PO del 2026-11-05 para la primera funcionalidad: capturar cursos, lecturas u otros temas, con una estructura de hasta 3 niveles.

## Decisión

### 1. Entidades

```
Espacio de trabajo
 ├─ Catálogos: Plataforma, Patrocinador, Categoría, Nivel, Tipo de actividad
 ├─ Tipos de elemento (Curso, Lectura, Otro…): etiqueta propia de cada campo
 └─ Elemento (la "ficha")
     └─ Nodos (árbol de hasta 3 niveles, ordenados)
         ├─ Capítulo / Subcapítulo: solo agrupa
         ├─ Curso: agrupa y tiene la misma ficha que el Elemento
         └─ Actividad: la hoja; es lo que se hace
```

**Ficha** (Elemento y nodos Curso):

| Campo | Regla |
|---|---|
| Tipo de elemento | Del catálogo de tipos; decide las etiquetas |
| Nombre | Obligatorio |
| Plataforma, Patrocinador, Categoría, Nivel | De sus catálogos (opcionales) |
| Duración en semanas, Días por semana, Horas por día | Opcionales; días por semana de 1 a 7 (por omisión 5) |
| Horas totales | **Calculadas** = semanas × días por semana × horas por día. Si se capturan a mano, **manda lo capturado** (se guarda aparte para saber de dónde viene) |
| Inicio y fin estimados | Fechas `date` (`AAAA-MM-DD`), opcionales; el fin no puede ser anterior al inicio |
| Inicio y fin reales | Se llenan solos al pasar a En curso y a Terminado; **se pueden corregir** |
| Estado | No iniciado, En curso, Pausado, Cancelado, Terminado (los de Gestor de Proyectos) |
| Prioridad | Alta, Media (por omisión) o Baja, como la de los proyectos en Gestor de Proyectos (HU-10, PO 2026-11-08) |
| Autor y Género | Catálogos propios del espacio, como los demás (HU-11, PO 2026-11-08) |
| Número de páginas | Entero mayor que 0 (HU-11) |
| Horas reales | Capturadas a mano, en todos los tipos, para compararlas con las estimadas (HU-11) |
| Notas | Texto libre |

**Actividad:** nombre, tipo de actividad (catálogo; por omisión video/lección, lectura, ejercicio, quiz, proyecto, examen), duración en minutos, estado (Pendiente, En curso, Pausada, Hecha, Cancelada, como las tareas de Gestor de Proyectos) y fechas estimadas y reales.

**Catálogos (HU-01):** una sola tabla (`catalog_items`) con su `kind`, porque los cinco comparten reglas. Nombre único entre los activos, sin distinguir mayúsculas. Un valor no se borra: se archiva, deja de ofrecerse y lo que ya lo usa lo conserva. Un espacio nuevo trae niveles y tipos de actividad; plataformas, patrocinadores y categorías empiezan vacíos.

### 2. Reglas del árbol
- Hasta **3 niveles** debajo del elemento.
- Nivel 1 y 2: Capítulo, Curso o Actividad. **Nivel 3: solo Actividad** (un capítulo ahí quedaría vacío).
- Una actividad no tiene hijos.
- Un nodo Curso usa **el mismo esquema Zod** de la ficha que el Elemento: una sola definición en `packages/shared`.
- Los nodos se ordenan entre hermanos (subir y bajar).
- Una sola tabla (`element_nodes`): las columnas de cada clase quedan vacías en las demás. Un nodo no cambia de clase ni de padre.
- Quitar un nodo manda a la papelera todo lo que contiene, con la misma fecha, para restaurarlos juntos en HU-07. Lo hace quien tiene `element.update`, como las fases en Gestor de Proyectos: armar la estructura es parte de editar el elemento.

### 3. Etiquetas por tipo de elemento
Cada tipo define cómo se llama cada campo de la ficha (por ejemplo, en Lectura "Plataforma" puede mostrarse como "Editorial"). Los campos y sus reglas no cambian, solo su nombre visible: así las reglas de cálculo y la integración siguen funcionando. Es el mismo enfoque de tipos configurables de Gestor de Proyectos (su ADR-0004).

Cada tipo guarda **solo sus nombres propios** (`labels`, JSONB); un campo sin nombre propio usa el de omisión. Dos campos de un tipo no pueden llamarse igual, y debe quedar al menos un tipo activo. Los tipos se archivan, como los catálogos (HU-02).

### 4. Avance
- % de avance = actividades Hechas ÷ actividades no canceladas (0 % si no hay); Pausada cuenta como pendiente.
- Capítulos y cursos calculan su avance con las actividades que contienen.
- Son las mismas reglas que Gestor de Proyectos, para que el avance sincronizado signifique lo mismo en las dos apps.

### 5. Compatibilidad con Gestor de Proyectos
- Convenciones iguales: UUID v7, tablas en `snake_case`, trazabilidad (`createdBy/At`, `updatedBy/At`, `deletedBy/At`), borrado lógico, fechas `AAAA-MM-DD`.
- Mapeo para la sincronización: Elemento → Proyecto, Capítulo o Curso → Fase, Actividad → Tarea. Lo que se sincroniza (avance, fechas, estado) y en qué dirección se decide en el ADR de integración.

## Alternativas consideradas
- **Un nodo Curso como un Elemento aparte enlazado:** reutiliza la tabla, pero complica el árbol y el borrado; se prefirió un nodo con la misma ficha.
- **Texto libre para plataforma, categoría…:** más simple, pero produce duplicados ("Coursera" y "coursera") y filtros sucios.

## Consecuencias
- (+) Una sola ficha para elementos y cursos anidados; etiquetas flexibles sin tocar el código.
- (−) Los catálogos y las etiquetas agregan pantallas de administración.
