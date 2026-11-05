# Acta de Constitución del Proyecto (Project Charter)

> Documento PMI de la fase de Inicio. Autoriza el proyecto y define su marco. Se actualiza solo con decisiones formales.

| Campo | Valor |
|---|---|
| Nombre | Gestor de Aprendizaje (nombre comercial por definir) |
| Patrocinador / Product Owner | Tú |
| Equipo de desarrollo | Tú + Claude Code (arquitectura e implementación) |
| Fecha de inicio | 2026-11-05 |
| Metodología | Híbrido: PMI (gobierno, alcance, riesgos) + Scrum (ejecución en sprints de 2 semanas) |

## 1. Propósito
Construir una aplicación web para planear y dar seguimiento a lo que se quiere aprender: **cursos, lecturas u otros temas**. Generaliza el prototipo "Gestor de cursos" y forma parte de un ecosistema de tres desarrollos **separados e integrados**, cada uno con su función y dueño de sus datos:

| Sistema | Función |
|---|---|
| **Gestor de Proyectos** (ya en producción) | Planear y dar seguimiento al trabajo. Recibe del Gestor de Aprendizaje el avance, las fechas y el estado (sincronizados). |
| **Gestor de Aprendizaje** (este proyecto) | Capturar y gestionar elementos de aprendizaje, su estructura (capítulos, cursos, actividades) y su avance. Crece por **módulos**. |
| **Lexika** (futuro) | Idiomas: vocabulario con repetición espaciada y lectura. Se integra con el Gestor de Aprendizaje. |

## 2. Objetivos medibles (SMART)
1. Primera funcionalidad (capturar elementos de aprendizaje con su estructura de 3 niveles) en producción gratuita al cierre del Sprint 2.
2. 0 vulnerabilidades críticas/altas en dependencias en cada release (escaneo automático).
3. Cobertura de pruebas ≥ 70 % en la lógica de negocio, **medida** en el CI (lección aprendida de Gestor de Proyectos, donde no se midió).
4. Sincronización con Gestor de Proyectos (avance, fechas y estado) funcionando antes del cierre del Sprint 4.

## 3. Alcance
**Incluye (primer incremento):**
- Acceso como en Gestor de Proyectos: registro solo por invitación, espacios de trabajo y roles (Admin, Miembro, Lector).
- Catálogos editables: plataforma, patrocinador, categoría, nivel y tipo de actividad.
- Tipos de elemento (Curso, Lectura, Otro…) con **etiquetas propias** para cada campo.
- Ficha del elemento: plataforma, patrocinador, nombre, duración en semanas, días por semana, horas por día, horas totales (calculadas o capturadas), categoría, nivel, fechas estimadas y reales de inicio y fin.
- Estructura de hasta **3 niveles**: capítulos, subcapítulos, cursos (con la misma ficha) y actividades.
- Lista de elementos con su avance.

**Siguientes incrementos (backlog):** sincronización con Gestor de Proyectos, integración con Lexika, tablero y gráficas, exportar e importar (incluidos los respaldos del prototipo), papelera, app en Android (PWA).

**Fuera de alcance:** facturación, multiempresa (SaaS), contenido de los cursos (videos, lecturas): solo se gestionan, no se alojan.

## 4. Interesados (Stakeholders)
| Interesado | Interés | Influencia |
|---|---|---|
| Tú (PO / usuario principal) | Funcionalidad y aprendizaje | Alta |
| Gestor de Proyectos (sistema) | API y eventos estables | Media |
| Lexika (sistema futuro) | API y eventos estables | Baja |

## 5. Supuestos y restricciones
- Presupuesto de infraestructura: $0 (capas gratuitas; uso personal).
- Mismo stack y convenciones que Gestor de Proyectos, para reutilizar código y conocimiento y facilitar la integración.
- Desarrollo a tiempo parcial (~21 puntos por sprint).
- PC de desarrollo con Windows y Smart App Control (bloquea binarios nativos no firmados).
- Las capas gratuitas pueden "dormir" o cambiar sus condiciones.

## 6. Riesgos iniciales
| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| Dos apps gratuitas no caben en los límites del hosting | Media | Media | Verificar los límites antes del despliegue (TEC-04); ambas apps "duermen" sin uso |
| Los contratos de integración se rompen al cambiar una app | Media | Alta | API versionada, esquemas Zod publicados como OpenAPI, ADR de integración |
| Crecimiento desordenado del alcance | Alta | Alta | Backlog priorizado; nada entra sin historia de usuario |
| Fuga de secretos | Media | Alta | `.env` fuera de Git + gitleaks en cada PR |
| Pérdida de datos | Baja | Alta | Respaldos de la BD + exportación JSON |

## 7. Definición de Terminado (Definition of Done)
Una historia está terminada solo si: el código está en `main` vía Pull Request, pasan las pruebas y el linter, el escaneo de seguridad no reporta problemas altos, está documentada y funciona en el entorno desplegado.

## 8. Aprobación
Aprobado por el Product Owner: ____________ Fecha: ________
