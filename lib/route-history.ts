export type RoutePoint = [number, number];

export function snapshotPoints(points: RoutePoint[]): RoutePoint[] {
  return points.map(([lng, lat]) => [lng, lat]);
}

export function pushHistory(history: RoutePoint[][], points: RoutePoint[], limit = 20): RoutePoint[][] {
  return [...history, snapshotPoints(points)].slice(-limit);
}

export function undoHistory(history: RoutePoint[][]): { history: RoutePoint[][]; points: RoutePoint[] | null } {
  if (!history.length) return {history, points: null};
  const next = [...history];
  const points = next.pop() ?? null;
  return {history: next, points: points ? snapshotPoints(points) : null};
}
