import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
export async function installGamepad(page) {
  await page.addInitScript(() => {
    const buttons=Array.from({length:17},()=>({pressed:false,touched:false,value:0}));
    const pad={id:'Test standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons,timestamp:0,vibrationActuator:null};
    window.__TEST_GAMEPAD__={pad,connect(){pad.connected=true;window.dispatchEvent(new GamepadEvent('gamepadconnected',{gamepad:pad}));},button(index,pressed){buttons[index].pressed=pressed;buttons[index].touched=pressed;buttons[index].value=pressed?1:0;pad.timestamp=performance.now();},axis(index,value){pad.axes[index]=value;pad.timestamp=performance.now();},reset(){buttons.forEach(b=>{b.pressed=false;b.touched=false;b.value=0;});pad.axes.fill(0);pad.timestamp=performance.now();}};
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad,null,null,null]});
  });
}
export async function tapGamepad(page,index,holdMs=100) {
  await page.evaluate(index=>window.__TEST_GAMEPAD__.button(index,true),index);
  await page.waitForTimeout(holdMs);
  await page.evaluate(index=>window.__TEST_GAMEPAD__.button(index,false),index);
  await page.waitForTimeout(100);
}
export async function pixelStats(page, selector='canvas') {
  const screenshot=await page.locator(selector).first().screenshot();
  const png=PNG.sync.read(screenshot), colors=new Set(); let min=255,max=0,sum=0;
  for(let y=0;y<png.height;y+=8)for(let x=0;x<png.width;x+=8){const i=(png.width*y+x)*4; const rgb=[png.data[i],png.data[i+1],png.data[i+2]];colors.add(rgb.join(','));for(const channel of rgb){min=Math.min(min,channel);max=Math.max(max,channel);sum+=channel;}}
  assert(colors.size>30,`Expected rendered scene diversity; sampled ${colors.size} colors`);
  assert(max-min>40,`Expected nonempty rendered image; brightness range ${max-min}`);
  return{width:png.width,height:png.height,sampledColors:colors.size,minChannel:min,maxChannel:max};
}
