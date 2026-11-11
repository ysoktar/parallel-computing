// Pure arithmetic for the course's browser exercises. GPU scheduling and timing are not simulated.
const whole=(...xs)=>xs.every(Number.isInteger);
const valid=(ok)=>{if(!ok)throw new RangeError("Invalid dimensions, indices or configuration");};
const tidy=x=>Math.round((x+Number.EPSILON)*1e12)/1e12;

export function amdahl(fraction,workers){
  valid(typeof fraction==="number" && Number.isFinite(fraction) && fraction>=0 && fraction<=1 &&
    whole(workers) && workers>=1 && workers<=1000000);
  const serial=tidy(1-fraction),parallel=tidy(fraction/workers),time=tidy(serial+parallel);
  return {serial,parallel,time,speedup:tidy(1/time)};
}
export function matrixIndex(rows,cols,row,col){
  valid(whole(rows,cols,row,col)&&rows>0&&cols>0);
  const ok=row>=0&&row<rows&&col>=0&&col<cols;
  return {row,col,linear:ok?row*cols+col:null,valid:ok};
}
export function cudaCell(rows,cols,bx,by,blockX,blockY,tx,ty){
  valid(whole(rows,cols,bx,by,blockX,blockY,tx,ty) && rows>0&&cols>0&&bx>0&&by>0&&
    bx*by<=1024&&blockX>=0&&blockY>=0&&tx>=0&&ty>=0&&tx<bx&&ty<by);
  const grid={x:Math.ceil(cols/bx),y:Math.ceil(rows/by)};
  valid(blockX<grid.x&&blockY<grid.y);
  const row=blockY*by+ty,col=blockX*bx+tx,cell=matrixIndex(rows,cols,row,col);
  const localId=ty*bx+tx;
  return {grid,covered:{rows:grid.y*by,cols:grid.x*bx},row,col,
    valid:cell.valid,offset:cell.linear,localId,warp:Math.floor(localId/32),lane:localId%32};
}
export function haloCell(rows,cols,workers,row,col){
  valid(whole(rows,cols,workers,row,col) && rows>0&&cols>0&&workers>0&&workers<=rows);
  const cell=matrixIndex(rows,cols,row,col);valid(cell.valid);
  const owner=Math.min(workers-1,Math.floor(row*workers/rows));
  // Split in nearly equal contiguous row partitions, with leftovers assigned to earlier workers.
  const ranges=Array.from({length:workers},(_,i)=>{
    const size=Math.floor(rows/workers),extra=rows%workers;
    const lo=i*size+Math.min(i,extra);
    return [lo,lo+size+(i<extra?1:0)-1];
  });
  const realOwner=ranges.findIndex(([a,b])=>a<=row&&row<=b);
  const neighbours=[[row-1,col],[row+1,col],[row,col-1],[row,col+1]]
    .filter(([r,c])=>r>=0&&r<rows&&c>=0&&c<cols);
  const [lo,hi]=ranges[realOwner];
  return {owner:realOwner,ownedRows:[lo,hi],neighbours,
    remoteNeighbours:neighbours.filter(([r])=>r<lo||r>hi)};
}
export function raceInit(withLock=false){
  return {withLock:Boolean(withLock),counter:0,owner:null,threads:[
    {phase:0,local:null},{phase:0,local:null}],history:[]};
}
export function raceStep(previous,thread){
  valid(whole(thread) && thread>=0&&thread<2);
  const s={...previous,threads:previous.threads.map(x=>({...x})),history:[...previous.history]};
  const t=s.threads[thread];
  if(t.phase===0){
    if(s.withLock&&s.owner!==null&&s.owner!==thread){
      s.history.push({thread,action:"blocked"});return s;
    }
    if(s.withLock)s.owner=thread;
    t.local=s.counter;t.phase=1;s.history.push({thread,action:"load",value:t.local});
  } else if(t.phase===1) {
    t.local++;t.phase=2;s.history.push({thread,action:"add",value:t.local});
  } else if(t.phase===2) {
    s.counter=t.local;t.phase=3;
    if(s.withLock)s.owner=null;
    s.history.push({thread,action:"store",value:s.counter});
  }
  return s;
}
export function tiledLoads(width,tile,blockX,blockY,tx,ty,phase){
  valid(whole(width,tile,blockX,blockY,tx,ty,phase) && width>0 && tile>0 &&
    width%tile===0 && blockX>=0&&blockX<width/tile&&blockY>=0&&blockY<width/tile &&
    tx>=0&&tx<tile&&ty>=0&&ty<tile&&phase>=0&&phase<width/tile);
  const row=blockY*tile+ty,col=blockX*tile+tx;
  const M=[row,phase*tile+tx],N=[phase*tile+ty,col];
  return {output:[row,col],outIndex:row*width+col,M,N,
    mIndex:M[0]*width+M[1],nIndex:N[0]*width+N[1],sharedM:[ty,tx],sharedN:[ty,tx]};
}
export function pitchedCell(width,height,pitchBytes,row,col,wordBytes=4){
  valid(whole(width,height,pitchBytes,row,col,wordBytes) && width>0&&height>0&&wordBytes>0 &&
    pitchBytes>=width*wordBytes && pitchBytes%wordBytes===0);
  const logical=matrixIndex(height,width,row,col);
  valid(logical.valid);
  return {row,col,offsetBytes:row*pitchBytes+col*wordBytes,
    tightBytes:(row*width+col)*wordBytes,rowPaddingBytes:pitchBytes-width*wordBytes};
}
export function transposeCell(size,row,col){
  valid(whole(size) && size>=1);
  const x=matrixIndex(size,size,row,col);valid(x.valid);
  return {read:[row,col],write:[col,row],readIndex:row*size+col,writeIndex:col*size+row};
}
export function warpSegments(stride=1,offset=0,wordBytes=4){
  valid(whole(stride,offset,wordBytes) && stride>=0 && offset>=0 && [1,2,4,8,16].includes(wordBytes));
  const addresses=Array.from({length:32},(_,i)=>(offset+i*stride)*wordBytes);
  const touched=new Set();
  for(const a of addresses)for(let byte=a;byte<a+wordBytes;byte++)touched.add(Math.floor(byte/32));
  return {addresses,segments:touched.size,bytes:touched.size*32,uniqueBytes:new Set(addresses).size*wordBytes};
}
