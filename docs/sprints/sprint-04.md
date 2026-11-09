# Sprint 4 — enviar a Gestor de Proyectos

- **Fechas:** 2026-11-08 → 2026-11-21
- **Objetivo:** que un elemento se pueda enviar a Gestor de Proyectos y sus cambios salgan solos (lado de Aprendizaje, ADR-0004), y que lo quitado se pueda recuperar.
- **Capacidad:** 11 puntos (decisión del PO).

## Elementos

| ID | Elemento | Puntos | Estado |
|---|---|---|---|
| HU-07 | Papelera: borrado lógico restaurable; físico solo desde la papelera (Admin) | 3 | Hecho (PR 22) |
| INT-02 | Enviar un elemento a Gestor de Proyectos y que sus cambios lleguen solos (bandeja de salida, vínculos y envío, probado contra un receptor de prueba) | 8 | En revisión |

## Notas

- **Orden:** primero HU-07. El ADR-0004 dice que quitar un nodo lo manda a la papelera de Proyectos y que restaurarlo lo vuelve a crear; conviene que la papelera exista antes de construir el envío.
- **INT-02** no se conecta todavía con Gestor de Proyectos real: necesita TEC-08 y HU-18 de su v2. Eso es INT-04. Al cierre de este sprint se cumple la primera parte del objetivo 4 del acta.
- **HU-07:** quitar un elemento (solo el Admin, `element.delete`) lo manda a la papelera sin tocar su estructura: deja de verse y vuelve completa. Un capítulo o curso vuelve con lo que se fue con él (misma fecha de baja); lo quitado antes se queda en la papelera y aparece solo cuando su padre vuelve. Cada quien ve y restaura lo que pudo quitar: el Admin todo, el Miembro los nodos, el Lector nada. Borrar para siempre es solo del Admin y se lleva todo lo que contiene. No vacía la papelera sola por antigüedad.
- **INT-02:** la ficha tiene la tarjeta **Gestor de Proyectos** (solo si la instalación tiene las tres variables `PROYECTOS_*`): Enviar, Dejar de sincronizar y, si falló 24 h, Reintentar. Lo ve quien ve el elemento; lo cambia quien lo edita. Probado contra un receptor de prueba que imita las rutas de Proyectos; en producción sigue apagado hasta INT-04. Detalles de lo que se envía en el ADR-0004 §7.
- **Observación (no es de INT-02):** cada vez que la ventana vuelve a tener el foco, la web relee todas las consultas de la página (React Query, `staleTime` 0). Con el límite de 100 peticiones por minuto, cambiar de ventana muchas veces seguidas puede dar "Demasiadas peticiones". Pasó al probar en el panel del navegador; con uso normal no debería. Si aparece en uso real, se ajusta `staleTime`.
