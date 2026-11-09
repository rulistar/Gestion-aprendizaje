# Sprint 4 — enviar a Gestor de Proyectos

- **Fechas:** 2026-11-08 → 2026-11-21
- **Objetivo:** que un elemento se pueda enviar a Gestor de Proyectos y sus cambios salgan solos (lado de Aprendizaje, ADR-0004), y que lo quitado se pueda recuperar.
- **Capacidad:** 11 puntos (decisión del PO).

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-07 | Papelera: borrado lógico restaurable; físico solo desde la papelera (Admin) | 3 | Pendiente |
| INT-02 | Enviar un elemento a Gestor de Proyectos y que sus cambios lleguen solos (bandeja de salida, vínculos y envío, probado contra un receptor de prueba) | 8 | Pendiente |

## Notas

- **Orden:** primero HU-07. El ADR-0004 dice que quitar un nodo lo manda a la papelera de Proyectos y que restaurarlo lo vuelve a crear; conviene que la papelera exista antes de construir el envío.
- **INT-02** no se conecta todavía con Gestor de Proyectos real: necesita TEC-08 y HU-18 de su v2. Eso es INT-04. Al cierre de este sprint se cumple la primera parte del objetivo 4 del acta.
