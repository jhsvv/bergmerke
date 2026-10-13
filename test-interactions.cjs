const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = {}, handlers = {};
const ctx = new Proxy({measureText: () => ({width: 100})}, {get: (o,k) => o[k] || (() => {})});
function element(id) {
  return elements[id] ??= {
    value: ({size:'28', resolution:'0.5', format:'image/jpeg'})[id] || '',
    style: {}, dataset: {}, clientWidth:1000, clientHeight:600, scrollLeft:0, scrollTop:0,
    append(){}, replaceChildren(){}, setAttribute(){}, click(){}, focus(){}, setPointerCapture(){},
    addEventListener(k,f){handlers[id+':'+k]=f;},
    getBoundingClientRect(){return {left:0,top:0,width:1000,height:600};},
    getContext(){return ctx;},
    toBlob(fn,type,quality){this.exported={type,quality};fn({size:100000});}
  };
}
const sandbox = {
  document:{getElementById:element, createElement:element, createTextNode:s=>s, querySelectorAll:()=>[]},
  window:{addEventListener(){}}, URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}}
};
vm.createContext(sandbox);
const run = source => vm.runInContext(source, sandbox);
run(fs.readFileSync('app.js','utf8'));
run('image={};canvas.width=2000;canvas.height=1200;objects=[{tool:"bolt",points:[{x:200,y:200}],size:40}];tool="move";');
function pointer(type,id,x,y){handlers['viewport:'+type]({type,pointerId:id,clientX:x,clientY:y,button:0,preventDefault(){}});}
pointer('pointerdown',1,100,100);
pointer('pointermove',1,150,125);
pointer('pointerup',1,150,125);
assert.equal(run('objects[0].points[0].x'),300);
elements.undo.onclick();
assert.equal(run('objects[0].points[0].x'),200);
assert.equal(elements.zoom.disabled,true);
assert.equal(elements.viewport.style.overflow,'hidden');
pointer('pointerdown',1,700,400);
pointer('pointermove',1,500,300);
pointer('pointerup',1,500,300);
assert.equal(elements.viewport.scrollLeft,0);
assert.equal(elements.viewport.scrollTop,0);
pointer('pointerdown',1,100,100);
pointer('pointerdown',2,200,100);
pointer('pointermove',2,300,100);
assert.equal(run('zoom'),1);
pointer('pointerup',1,100,100);
pointer('pointerup',2,300,100);
assert.equal(run('objects[0].points[0].x'),200);
run('tool="bolt";update();');
assert.equal(elements.zoom.disabled,false);
assert.equal(elements.viewport.style.overflow,'auto');
pointer('pointerdown',1,100,100);
pointer('pointerdown',2,200,100);
pointer('pointermove',2,300,100);
assert.equal(run('zoom'),2);
pointer('pointerup',1,100,100);
pointer('pointerup',2,300,100);
assert.equal(run('objects.length'),1);
elements.export.onclick();
assert.equal(elements.canvas.width,1000);
assert.equal(elements.canvas.height,600);
assert.equal(elements.canvas.exported.type,'image/jpeg');
assert.equal(elements.canvas.exported.quality,0.82);
console.log('PASS: object drag and undo; zoom/pan locked in edit mode; pinch restored in drawing mode; half-resolution JPEG export');
