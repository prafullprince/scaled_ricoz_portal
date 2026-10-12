import assert from "node:assert/strict";
import { test } from "node:test";
import { innovationAnchor, innovationFrame, innovationPathPoint, innovationStory } from "./innovation-story";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);

test("each thought starts exactly at its path change in the original video", () => {
  innovationStory.forEach((thought, index) => {
    const frame = innovationFrame(thought.cue * 10, 10);
    assert.equal(frame.index, index);
    close(frame.progress, 0);
  });
  assert.equal(innovationFrame(3.0, 10).index, 0);
  assert.equal(innovationFrame(3.2, 10).index, 1);
  assert.equal(innovationFrame(4.6, 10).index, 2);
  assert.equal(innovationFrame(9.9, 10).index, 3);
  close(innovationFrame(7.9, 10).progress, 0.5);
});

test("looping and seeking select the matching thought without independent timers", () => {
  assert.deepEqual(innovationFrame(10, 10), { index: 0, progress: 0 });
  assert.equal(innovationFrame(23.2, 10).index, 1);
  assert.deepEqual(innovationFrame(7.5, 10), innovationFrame(7.5, 10));
});

test("unloaded metadata and invalid playheads have a bounded static first thought", () => {
  for (const time of [NaN, Infinity, -1]) {
    assert.deepEqual(innovationFrame(time, NaN), { index: 0, progress: 0 });
  }
  for (const duration of [0, -1, NaN, Infinity]) {
    assert.equal(innovationFrame(3.2, duration).index, 1);
  }
});

test("text anchors follow the travelling light inside the video frame", () => {
  for (let time = 0; time <= 10; time += 0.25) {
    const { x, y } = innovationPathPoint(time, 10);
    assert.ok(x > 0 && x < 1 && y > 0 && y < 1);
  }
  close(innovationPathPoint(0, 10).x, 0.84);
  close(innovationPathPoint(10, 10).x, 0.84);
  innovationStory.forEach((thought, index) => assert.deepEqual(innovationAnchor(index), innovationPathPoint(thought.cue, 1)));
  assert.ok(innovationAnchor(0).x > innovationAnchor(3).x);
});
