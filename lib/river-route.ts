import type { CrewRecord } from "./jaguar";

export type RoutePoint = { x: number; y: number };

// Acceptance and ownership must never change a challenge's place on the map.
export function orderRiverChallenges(tasks: CrewRecord[]) {
  return [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function riverRoute(tasks: CrewRecord[]) {
  const width = Math.max(760, 180 + (tasks.length + 1) * 240);
  const heights = [190, 390, 225, 365];
  const challenges = tasks.map((_, index) => ({ x: 240 + index * 240, y: heights[index % heights.length] }));
  const points: RoutePoint[] = [{ x: 65, y: 355 }, ...challenges, { x: width - 95, y: 235 }];
  const lengths = [0];
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index], middle = (a.x + b.x) / 2;
    path += ` C ${middle} ${a.y}, ${middle} ${b.y}, ${b.x} ${b.y}`;
    // The invisible motion path moves the boat between scattered landmarks.
    let length = lengths[index - 1], previous = a;
    for (let step = 1; step <= 40; step++) {
      const t = step / 40, u = 1 - t;
      const next = {
        x: u ** 3 * a.x + 3 * u ** 2 * t * middle + 3 * u * t ** 2 * middle + t ** 3 * b.x,
        y: u ** 3 * a.y + 3 * u ** 2 * t * a.y + 3 * u * t ** 2 * b.y + t ** 3 * b.y,
      };
      length += Math.hypot(next.x - previous.x, next.y - previous.y);
      previous = next;
    }
    lengths.push(length);
  }
  const currentIndex = tasks.findIndex(task => task.data.status !== "Accepted");
  const boatIndex = tasks.length === 0 ? 0 : currentIndex === -1 ? points.length - 1 : currentIndex + 1;
  return {
    width, path, points, challenges, currentIndex,
    boatPoint: points[boatIndex],
    boatDistance: lengths[boatIndex] / lengths[lengths.length - 1] * 100,
    arrived: tasks.length > 0 && currentIndex === -1,
  };
}
