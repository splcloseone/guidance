/** Bounded, portable solid field. No renderer, storage, or DOM dependencies. */
export const CLAY_SIZE = 28;
const N = CLAY_SIZE, COUNT = N ** 3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const index = (x,y,z) => x + N*y + N*N*z;
export const encodeClay = field => Array.from(field, v => v.toString(16).padStart(2,'0')).join('');
export function decodeClay(data) {
  const field = new Uint8Array(COUNT);
  if (typeof data !== 'string' || data.length !== COUNT*2 || !/^[a-f\d]+$/i.test(data)) return field;
  for (let i=0;i<COUNT;i++) field[i]=parseInt(data.slice(i*2,i*2+2),16);
  return field;
}
const box = (x,y,z,a,b,c) => Math.min(a-Math.abs(x),b-Math.abs(y),c-Math.abs(z));
export function clayPreset(kind = 'ball') {
  const field = new Uint8Array(COUNT);
  for(let z=1;z<N-1;z++)for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++) {
    const px=(x-N/2)/(N/2),py=(y-N/2)/(N/2),pz=(z-N/2)/(N/2);
    let d=.55-Math.hypot(px,py,pz);
    if(kind==='sword') d=Math.max(box(px,py-.18,pz,.10,.60,.07),box(px,py+.43,pz,.35,.075,.10),box(px,py+.62,pz,.075,.19,.075));
    if(kind==='pants') {
      const legs = Math.max(box(px-.25,py+.28,pz,.21,.45,.24),box(px+.25,py+.28,pz,.21,.45,.24));
      const waist = box(px,py-.32,pz,.47,.24,.27);
      const holes = Math.max(box(px-.25,py+.4,pz,.11,.9,.12),box(px+.25,py+.4,pz,.11,.9,.12),box(px,py-.46,pz,.36,.18,.16));
      d=Math.min(Math.max(legs,waist),-holes);
    }
    field[index(x,y,z)]=clamp(Math.round(128+d*380),0,255);
  }
  return { data: encodeClay(field), purpose: kind==='pants'?'armor':kind==='sword'?'sword':'sculpture' };
}
let defaultBall;
export function normalizeClay(value) {
  defaultBall ||= clayPreset();
  return { data: typeof value?.data==='string' && value.data.length===COUNT*2 && /^[a-f\d]+$/i.test(value.data) ? value.data.toLowerCase() : defaultBall.data,
    purpose: ['sculpture','armor','sword'].includes(value?.purpose) ? value.purpose : 'sculpture' };
}
function sample(f,x,y,z) {
  x=clamp(x,0,N-1);y=clamp(y,0,N-1);z=clamp(z,0,N-1);
  const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z),tx=x-a,ty=y-b,tz=z-c;
  let out=0;
  for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)out+=f[index(Math.min(a+dx,N-1),Math.min(b+dy,N-1),Math.min(c+dz,N-1))]*(dx?tx:1-tx)*(dy?ty:1-ty)*(dz?tz:1-tz);
  return out;
}
export function sculptClay(solid, { point=[0,0,.5], delta=[0,0,0], radius=.25, tool='add', symmetry=false }={}) {
  if (!point.every(Number.isFinite) || !delta.every(Number.isFinite)) return normalizeClay(solid);
  const normalized=normalizeClay(solid), original=decodeClay(normalized.data), next=original.slice();
  radius=clamp(Number(radius)||.25,.12,.65);
  const brushes=[{point,delta}];
  if(symmetry && Math.abs(point[0])>.02) brushes.push({point:[-point[0],point[1],point[2]],delta:[-delta[0],delta[1],delta[2]]});
  for(let z=1;z<N-1;z++)for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++) {
    const p=[(x-N/2)/(N/2),(y-N/2)/(N/2),(z-N/2)/(N/2)],i=index(x,y,z);
    for(const brush of brushes) {
      const dist=Math.hypot(...p.map((v,a)=>v-brush.point[a]));
      if(dist>=radius)continue;
      const w=(1-dist/radius)**2;
      if(tool==='pull') next[i]=sample(original,x-brush.delta[0]*N/2*w,y-brush.delta[1]*N/2*w,z-brush.delta[2]*N/2*w);
      else if(tool==='smooth') next[i]=original[i]*(1-w)+w*(original[i-1]+original[i+1]+original[i-N]+original[i+N]+original[i-N*N]+original[i+N*N])/6;
      else if(tool==='flatten') next[i]=clamp(original[i]+(brush.point[2]-p[2])*w*160,0,255);
      else next[i]=clamp(next[i]+(tool==='carve'?-1:1)*w*100,0,255);
    }
  }
  return {...normalized,data:encodeClay(next)};
}
export function clayHasVolume(solid) { return decodeClay(solid?.data).some(v=>v>140); }
