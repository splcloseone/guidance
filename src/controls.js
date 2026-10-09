const editable=t=>t instanceof HTMLElement&&(t.matches('input,textarea,select')||t.isContentEditable);
const deadzone=v=>Math.abs(v||0)<.17?0:(Math.abs(v)-.17)/.83*Math.sign(v);
export function connectedGamepad(){try{return Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected)||null;}catch{return null;}}
export class Controls {
  constructor(canvas){
    this.keys=new Set();this.actions=[];this.lookX=0;this.lookY=0;this.device='keyboard';this.gamepadName='';this.previousButtons=[];
    this.dragging=false;this.lookPointer=null;this.touchMove={x:0,forward:0};this.touchEnabled=navigator.maxTouchPoints>0;
    document.body.classList.toggle('touch-mode',this.touchEnabled);
    window.addEventListener('keydown',e=>{
      if(editable(e.target))return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      this.device='keyboard';this.keys.add(e.code);if(e.repeat)return;
      const action={Space:'jump',KeyF:'cast',KeyC:'spike',KeyV:'equip',KeyN:'manifest',Digit5:'practice-melee',Digit6:'practice-combo',KeyE:'release',KeyT:'slam',Digit1:'slot-0',Digit2:'slot-1',Digit3:'slot-2',Digit4:'slot-3',KeyQ:'reel-toggle',KeyR:'payout-toggle',KeyM:'meditate',KeyG:'map',KeyH:'guide',Escape:'escape'}[e.code];
      if(action)this.actions.push(action);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.clear());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch'){this.enableTouch();this.lookPointer=e.pointerId;this.lastLook=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}
      this.device='keyboard';if(e.button===2){this.dragging=true;canvas.setPointerCapture(e.pointerId);}if(e.button===0)this.actions.push('primary');
    });
    canvas.addEventListener('pointermove',e=>{
      if(e.pointerId===this.lookPointer){this.lookX+=e.clientX-this.lastLook[0];this.lookY+=e.clientY-this.lastLook[1];this.lastLook=[e.clientX,e.clientY];}
      else if(this.dragging){this.lookX+=e.movementX;this.lookY+=e.movementY;}
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(e.pointerId===this.lookPointer)this.lookPointer=null;this.dragging=false;});
    const stick=document.getElementById('touch-stick');let movePointer=null;
    const move=e=>{const r=stick.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/42,y=(e.clientY-r.top-r.height/2)/42,n=Math.max(1,Math.hypot(x,y));this.touchMove={x:x/n,forward:-y/n};stick.firstElementChild.style.transform=`translate(${x/n*30}px,${y/n*30}px)`;};
    stick.addEventListener('pointerdown',e=>{e.preventDefault();this.enableTouch();movePointer=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);});
    stick.addEventListener('pointermove',e=>{if(e.pointerId===movePointer)move(e);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{if(e.pointerId===movePointer){movePointer=null;this.touchMove={x:0,forward:0};stick.firstElementChild.style.transform='';}});
    document.querySelectorAll('[data-touch-action]').forEach(button=>{
      button.addEventListener('pointerdown',e=>{e.preventDefault();this.enableTouch();this.actions.push(button.dataset.touchAction);});
      button.addEventListener('click',e=>{if(e.detail===0)this.actions.push(button.dataset.touchAction);});
    });
  }
  enableTouch(){this.touchEnabled=true;this.device='touch';document.body.classList.add('touch-mode');}
  clear(){this.keys.clear();this.actions.length=0;this.dragging=false;this.lookPointer=null;this.lookX=this.lookY=0;this.touchMove={x:0,forward:0};document.querySelector('#touch-stick span')?.style.removeProperty('transform');}
  read(dt){
    const pad=connectedGamepad();let mx=this.touchMove.x,forward=this.touchMove.forward,sprint=false,struggle=this.keys.has('KeyB');
    let lx=this.lookX*.004,ly=this.lookY*.004;this.lookX=this.lookY=0;this.gamepadName=pad?.id||'';
    if(pad){
      const axes=pad.axes.map(deadzone),down=i=>!!pad.buttons[i]?.pressed||(pad.buttons[i]?.value||0)>.45;
      if(axes.some(a=>Math.abs(a)>.03)||pad.buttons.some(b=>b.pressed))this.device='controller';
      mx+=axes[0]||0;forward-=axes[1]||0;lx+=(axes[2]||0)*dt*2.3;ly+=(axes[3]||0)*dt*1.8;sprint=down(10);struggle||=down(11);
      for(const [i,action]of [[0,'jump'],[1,'context-b'],[2,'slam'],[3,'meditate'],[4,'release'],[5,'payout-toggle'],[6,'reel-toggle'],[7,'primary'],[8,'map'],[9,'guide'],[12,'slot-2'],[13,'slot-3'],[14,'slot-0'],[15,'slot-1']]){
        if(down(i)&&!this.previousButtons[i])this.actions.push(action);
      }
      this.previousButtons=pad.buttons.map((_,i)=>down(i));
    }else this.previousButtons=[];
    mx+=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
    forward+=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'));
    sprint||=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight');
    return {x:mx,forward,sprint,struggle,lookX:lx,lookY:ly,actions:this.actions.splice(0)};
  }
}
