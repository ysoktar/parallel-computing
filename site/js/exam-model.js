// Pure CUDA index and synchronization models; no GPU scheduling predictions.
export const TILE = 32;
function validate(N, bx, by, tx, ty) {
  if (![N,bx,by,tx,ty].every(Number.isInteger) || N < TILE || N % TILE ||
      bx < 0 || by < 0 || bx >= N / TILE || by >= N / TILE ||
      tx < 0 || tx >= TILE || ty < 0 || ty >= TILE) {
    throw new RangeError("Expected a square, tile-aligned matrix and in-range block/thread indices");
  }
}
export function traceTranspose(N, bx, by, tx, ty) {
  validate(N,bx,by,tx,ty);
  const at = (row,col) => ({row,col,offset:row*N+col});
  const input = at(by*TILE+ty,bx*TILE+tx);
  const sharedInput = at(by*TILE+tx,bx*TILE+ty);
  return {
    input, naiveOutput:at(input.col,input.row),
    sharedInput, sharedOutput:at(sharedInput.col,sharedInput.row),
    tileWritten:[ty,tx], tileRead:[tx,ty]
  };
}
export function warpAccess(N,bx,by,ty=0) {
  validate(N,bx,by,0,ty);
  const summary = (position) => {
    const addresses=Array.from({length:32},(_,lane)=>position(lane)*4);
    const segments=new Set(addresses.map(a=>Math.floor(a/32))).size;
    const lines=new Set(addresses.map(a=>Math.floor(a/128))).size;
    return {addresses,segments,lines,transferredBytes:segments*32,requestedBytes:128};
  };
  const read=summary(lane=>(by*TILE+ty)*N+bx*TILE+lane);
  const naiveWrite=summary(lane=>(bx*TILE+lane)*N+by*TILE+ty);
  const sharedWrite=summary(lane=>(bx*TILE+ty)*N+by*TILE+lane);
  return {read,naiveWrite,sharedWrite};
}
export function warpMembers(blockWidth,blockHeight,tx,ty) {
  if (![blockWidth,blockHeight,tx,ty].every(Number.isInteger) || blockWidth<=0 || blockHeight<=0 ||
      blockWidth*blockHeight>1024 || tx<0 || tx>=blockWidth || ty<0 || ty>=blockHeight)
    throw new RangeError("Invalid block or thread");
  const id=ty*blockWidth+tx;
  const start=Math.floor(id/32)*32;
  const end=Math.min(start+32,blockWidth*blockHeight);
  return Array.from({length:end-start},(_,i)=>[(start+i)%blockWidth,Math.floor((start+i)/blockWidth)]);
}
// Four symbolic lanes. Missing data means an ordering hazard, not deterministic GPU output.
export function newBarrier(enabled=true) {
  return {enabled:Boolean(enabled),phase:[0,0,0,0],shared:[null,null,null,null],reads:[null,null,null,null]};
}
export function stepBarrier(previous,lane) {
  if (!Number.isInteger(lane) || lane<0 || lane>=4) throw new RangeError("Invalid lane");
  const s={enabled:previous.enabled,phase:[...previous.phase],shared:[...previous.shared],reads:[...previous.reads]};
  const p=s.phase[lane];
  if (p===0) {s.shared[lane]=lane+1;s.phase[lane]=1;}
  else if (p===1 && s.enabled) {
    s.phase[lane]=2;
    if (s.phase.every(x=>x===2)) s.phase.fill(3);
  } else if (p===1 || p===3) {
    s.reads[lane]=s.shared[(lane+1)%4];
    s.phase[lane]=4;
  }
  return s;
}
