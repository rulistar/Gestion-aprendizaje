/**
 * Minutos de un elemento y de su estructura (HU-18). Todo se mide en minutos. En cada nivel manda
 * lo capturado a mano; si no hay, se suman los minutos de lo que contiene; y si tampoco hay, se
 * calcula con la duración (semanas × días por semana × minutos por día), solo en cursos y elementos.
 * Una actividad cancelada ya no se va a hacer: no cuenta.
 */

/** Un nodo de la estructura con lo necesario para sumar minutos */
export interface MinutesNode {
  id: string;
  parentId: string | null;
  /** Lo capturado a mano: los minutos de una actividad o los totales de un curso */
  captured: number | null;
  /** Lo que sale de la duración del curso; null si faltan datos o no es un curso */
  calculated: number | null;
  /** Una actividad cancelada no cuenta */
  cancelled: boolean;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** La suma de lo que hay; null si no hay nada (para distinguir "0 minutos" de "sin datos") */
export function sumMinutes(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : round(present.reduce((total, value) => total + value, 0));
}

export interface MinutesRollup {
  /** Los minutos de cada nodo, por su ID; null si no tiene o no cuenta */
  byNode: Map<string, number | null>;
  /** La suma de los nodos de primer nivel: lo que la estructura aporta al elemento */
  roots: number | null;
}

export function rollupMinutes(nodes: readonly MinutesNode[]): MinutesRollup {
  const childrenOf = new Map<string | null, MinutesNode[]>();
  for (const node of nodes) {
    childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node]);
  }

  const byNode = new Map<string, number | null>();
  const total = (node: MinutesNode): number | null => {
    if (node.cancelled) {
      byNode.set(node.id, null);
      return null;
    }
    // Siempre se recorren los hijos: cada uno muestra los suyos aunque el padre tenga captura
    const inside = sumMinutes((childrenOf.get(node.id) ?? []).map(total));
    const minutes = node.captured ?? inside ?? node.calculated;
    byNode.set(node.id, minutes);
    return minutes;
  };

  return { byNode, roots: sumMinutes((childrenOf.get(null) ?? []).map(total)) };
}

/** Lo mismo para una lista plana en orden de lectura con profundidad (como el respaldo) */
export function rollupByDepth(
  nodes: readonly (Omit<MinutesNode, 'id' | 'parentId'> & { depth: number })[],
): { byIndex: (number | null)[]; roots: number | null } {
  const lastAtDepth: number[] = [];
  const asTree = nodes.map(({ depth, ...rest }, index) => {
    lastAtDepth[depth] = index;
    const parent = depth > 1 ? lastAtDepth[depth - 1] : undefined;
    return { ...rest, id: String(index), parentId: parent === undefined ? null : String(parent) };
  });
  const { byNode, roots } = rollupMinutes(asTree);
  return { byIndex: nodes.map((_, index) => byNode.get(String(index)) ?? null), roots };
}
