import { test } from "node:test";
import assert from "node:assert/strict";
import {
  traceTranspose, warpAccess, newBarrier, stepBarrier, warpMembers
} from "../site/js/exam-model.js";

test("transpose: thread reads and writes different elements in shared and naive kernels", () => {
  const t = traceTranspose(64, 1, 0, 5, 10);
  assert.deepEqual(t.input, { row: 10, col: 37, offset: 677 });
  assert.deepEqual(t.naiveOutput, { row: 37, col: 10, offset: 2378 });
  assert.deepEqual(t.sharedInput, { row: 5, col: 42, offset: 362 });
  assert.deepEqual(t.sharedOutput, { row: 42, col: 5, offset: 2693 });
  assert.deepEqual(t.tileWritten, [10, 5]);
  assert.deepEqual(t.tileRead, [5, 10]);
});

test("transpose rejects out-of-grid and out-of-block coordinates", () => {
  for (const a of [[48,0,0,0,0], [64,2,0,0,0], [64,0,0,32,0], [64,0,0,-1,0]]) {
    assert.throws(() => traceTranspose(...a), RangeError);
  }
});

test("one warp: naive column writes touch 32 segments, shared output touches 4 on N=64", () => {
  const x = warpAccess(64, 1, 0, 10);
  assert.equal(x.read.segments, 4);
  assert.equal(x.naiveWrite.segments, 32);
  assert.equal(x.sharedWrite.segments, 4);
  assert.equal(x.read.addresses[0], (10 * 64 + 32) * 4);
  assert.equal(x.naiveWrite.addresses[1] - x.naiveWrite.addresses[0], 256);
  assert.equal(x.sharedWrite.addresses[1] - x.sharedWrite.addresses[0], 4);
});

test("warp membership is linear x-fastest even for a non-multiple-of-32 block width", () => {
  assert.deepEqual(warpMembers(33, 2, 32, 0).slice(0, 3), [[32,0],[0,1],[1,1]]);
  assert.deepEqual(warpMembers(12, 8, 0, 3).slice(0, 3), [[8,2],[9,2],[10,2]]);
  assert.equal(warpMembers(8, 32, 5, 10).length, 32);
});

test("with a barrier no thread reads before all four lanes arrive", () => {
  let state = newBarrier(true);
  for (let i = 0; i < 3; i++) { state = stepBarrier(state, i); state = stepBarrier(state, i); }
  assert.deepEqual(state.reads, [null,null,null,null]);
  assert.deepEqual(state.phase.slice(0,3), [2,2,2]);
  state = stepBarrier(state, 3);
  state = stepBarrier(state, 3);
  assert.deepEqual(state.phase, [3,3,3,3]);
  state = stepBarrier(state, 0);
  assert.equal(state.reads[0], 2);
});

test("without a barrier early neighbour read is uninitialized, not a simulated GPU result", () => {
  let state = newBarrier(false);
  state = stepBarrier(state, 0);
  state = stepBarrier(state, 0);
  assert.equal(state.reads[0], null);
  assert.equal(state.phase[0], 4);
});

test("state transitions are immutable and reject invalid lanes", () => {
  const old = newBarrier(true);
  const next = stepBarrier(old, 0);
  assert.deepEqual(old.phase, [0,0,0,0]);
  assert.notEqual(old, next);
  assert.throws(() => stepBarrier(old, 4), RangeError);
});