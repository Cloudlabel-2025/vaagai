import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/river-route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const routeExports = {};
new Function("exports", source)(routeExports);
const { orderRiverChallenges, riverRoute } = routeExports;
const task = (id, status = "Planned", createdAt = `2026-10-${id.padStart(2, "0")}T10:00:00Z`) => ({ id, createdAt, data: { status, title: `Task ${id}`, owner: "rider" } });

test("challenge order stays stable across acceptance, ownership and newest-first API responses", () => {
  const tasks = [task("3"), task("2"), task("1")];
  assert.deepEqual(orderRiverChallenges(tasks).map(t => t.id), ["1", "2", "3"]);
  tasks[2].data.status = "Accepted";
  tasks[1].data.owner = "another-rider";
  assert.deepEqual(orderRiverChallenges(tasks).map(t => t.id), ["1", "2", "3"]);
  assert.deepEqual(tasks.map(t => t.id), ["3", "2", "1"], "sorting must not mutate workspace records");
  const tied = [task("b", "Planned", tasks[0].createdAt), task("a", "Accepted", tasks[0].createdAt)];
  assert.deepEqual(orderRiverChallenges(tied).map(t => t.id), ["a", "b"]);
});

test("only acceptance advances the boat, to the first uncleared challenge", () => {
  const tasks = [task("1"), task("2"), task("3")];
  const initial = riverRoute(tasks);
  for (const status of ["In progress", "Pending review", "Blocked", "Rework"]) {
    tasks[0].data.status = status;
    assert.equal(riverRoute(tasks).boatDistance, initial.boatDistance);
  }
  tasks[2].data.status = "Accepted";
  assert.equal(riverRoute(tasks).currentIndex, 0, "later acceptance must not skip an uncleared challenge");
  tasks[0].data.status = "Accepted";
  const next = riverRoute(tasks);
  assert.equal(next.currentIndex, 1);
  assert.deepEqual(next.boatPoint, next.challenges[1]);
  assert.ok(next.boatDistance > initial.boatDistance);
  tasks[0].data.status = "Rework";
  assert.equal(riverRoute(tasks).currentIndex, 0, "reopened work brings the boat back");
});

test("empty routes wait at departure; completed routes arrive at destination", () => {
  const empty = riverRoute([]);
  assert.equal(empty.arrived, false);
  assert.equal(empty.boatDistance, 0);
  const completed = riverRoute([task("1", "Accepted"), task("2", "Accepted")]);
  assert.equal(completed.arrived, true);
  assert.equal(completed.boatDistance, 100);
  assert.deepEqual(completed.boatPoint, completed.points.at(-1));
});

test("large routes include every challenge and keep markers between banks", () => {
  const tasks = Array.from({ length: 40 }, (_, i) => task(String(i + 1)));
  const route = riverRoute(tasks);
  assert.equal(route.challenges.length, 40);
  assert.ok(route.width > 9600);
  for (let i = 0; i < route.challenges.length; i++) {
    assert.ok(route.challenges[i].x > route.points[0].x);
    assert.ok(route.challenges[i].x < route.points.at(-1).x);
    if (i) assert.equal(route.challenges[i].x - route.challenges[i - 1].x, 240);
  }
  assert.ok(Number.isFinite(route.boatDistance));
});

test("landmarks crisscross the river rather than forming a row", () => {
  const route = riverRoute(Array.from({ length: 8 }, (_, i) => task(String(i + 1))));
  for (let i = 1; i < route.challenges.length; i++) {
    const change = route.challenges[i].y - route.challenges[i - 1].y;
    assert.ok(Math.abs(change) >= 140, "successive stops need a visible vertical separation");
    assert.equal(Math.sign(change), i % 2 ? 1 : -1);
  }
  for (const point of route.challenges) {
    assert.ok(point.y >= 180 && point.y <= 400, "leave room for the boat above and labels below");
  }
});
