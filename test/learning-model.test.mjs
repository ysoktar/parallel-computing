import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amdahl, matrixIndex, cudaCell, haloCell, raceInit, raceStep,
  tiledLoads, pitchedCell, transposeCell, warpSegments
} from "../site/js/learning-model.js";

test("Amdahl speedup decomposes serial and parallel time", () => {
  assert.deepEqual(amdahl(0.8, 4), { serial: 0.2, parallel: 0.2, time: 0.4, speedup: 2.5 });
  assert.equal(amdahl(0.9, 1).speedup, 1);
  assert.throws(() => amdahl(1.1, 4), RangeError);
});
test("row-major indices and bounds", () => {
  assert.deepEqual(matrixIndex(6, 9, 2, 5), { row: 2, col: 5, linear: 23, valid: true });
  assert.deepEqual(matrixIndex(6, 9, 2, 9), { row: 2, col: 9, linear: null, valid: false });
});
test("2D CUDA layout handles partial edge blocks and linear warp IDs", () => {
  const x = cudaCell(7, 9, 4, 3, 1, 1, 1, 2);
  assert.deepEqual(x.grid, { x: 3, y: 3 });
  assert.deepEqual(x.covered, { rows: 9, cols: 12 });
  assert.equal(x.row, 5); assert.equal(x.col, 5); assert.equal(x.offset, 50);
  assert.equal(x.localId, 9); assert.equal(x.warp, 0); assert.equal(x.lane, 9);
  const edge = cudaCell(7, 9, 4, 3, 2, 2, 1, 1);
  assert.equal(edge.valid, false); assert.equal(edge.offset, null);
});
test("halo ownership distinguishes local and neighbouring worker rows", () => {
  const x = haloCell(6, 8, 2, 2, 3);
  assert.equal(x.owner, 0);
  assert.deepEqual(x.ownedRows, [0, 2]);
  assert.deepEqual(x.neighbours, [[1,3],[3,3],[2,2],[2,4]]);
  assert.deepEqual(x.remoteNeighbours, [[3,3]]);
});
test("race with two explicit load/increment/store interleavings", () => {
  let r=raceInit(false);
  for(const thread of [0,1,0,1,0,1]) r=raceStep(r,thread);
  assert.equal(r.counter,1);
  r=raceInit(true);
  for(const thread of [0,1,0,0,0,1,1,1]) r=raceStep(r,thread);
  assert.equal(r.counter,2);
  assert.equal(raceInit(false).counter,0);
});
test("tiled matmul loads for a chosen output thread and phase", () => {
  const x=tiledLoads(8,4,1,0,2,1,1);
  assert.deepEqual(x.output,[1,6]);
  assert.deepEqual(x.M,[1,6]); assert.deepEqual(x.N,[5,6]);
  assert.deepEqual(x.sharedM,[1,2]); assert.deepEqual(x.sharedN,[1,2]);
  assert.equal(x.outIndex,14); assert.equal(x.mIndex,14); assert.equal(x.nIndex,46);
});
test("pitched row-major memory counts padding in bytes only", () => {
  const x=pitchedCell(5,6,32,3,2);
  assert.equal(x.offsetBytes,104); assert.equal(x.tightBytes,68);
  assert.equal(x.rowPaddingBytes,12);
  assert.throws(()=>pitchedCell(5,6,16,3,2),RangeError);
});
test("transpose swaps row and column for output indexing", () => {
  const x=transposeCell(8,2,3);
  assert.equal(x.readIndex,19); assert.equal(x.writeIndex,26);
  assert.deepEqual(x.read,[2,3]); assert.deepEqual(x.write,[3,2]);
});
test("warp segment calculation respects stride and per-lane addresses",()=>{
  const a=warpSegments(1,0,4);
  assert.equal(a.segments,4);assert.equal(a.bytes,128);
  assert.equal(a.addresses[31],124);
  const b=warpSegments(1024,0,4);
  assert.equal(b.segments,32);assert.equal(b.bytes,1024);
  const c=warpSegments(1,1,4);
  assert.equal(c.segments,5);
  assert.throws(()=>warpSegments(-1,0,4),RangeError);
});
