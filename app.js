'use strict';
const $ = id => document.getElementById(id);
const definitions = [
  ['move','Vel / flytt','↔','#18372f','move'],
  ['cleanArea','Rensk av område','▱','#d36bd1','polygon'],
  ['clean','Rensk','R','#ff0000','point'],
  ['bolt','Bolt','▲','#ff0000','point'],
  ['boltArea','Boltesikring','▱','#ff0000','polygon'],
  ['rod','Stag','✚','#888888','point'],
  ['other','Anna sikringsbehov · punkt','▼','#ffc000','point'],
  ['line','Anna sikringsbehov · linje','━','#ffc000','line'],
  ['area','Anna sikringsbehov · område','▱','#ffc000','polygon'],
  ['text','Tekst','T','#ffffff','point']
];
let image=null, objects=[], pending=[], tool='bolt', baseName='inspeksjon', resultURL=null;
let zoom=1, selected=null, history=[];
function remember(){history.push(JSON.stringify(objects));if(history.length>60)history.shift();}
const canvas=$('canvas'), ctx=canvas.getContext('2d');
for(const [id,label,symbol,color] of definitions){
  const button=document.createElement('button'); button.type='button';
  const icon=document.createElement('span');icon.className='symbol';icon.textContent=symbol;icon.style.color=id==='text'?'#18372f':color;
  button.append(icon,document.createTextNode(label));button.dataset.tool=id;
  button.onclick=()=>{pending=[];selected=null;tool=id;update();render();};$('tools').append(button);
}
function definition(id){return definitions.find(d=>d[0]===id);}
function update(){
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
  $('finish').disabled=!image||pending.length<(definition(tool)[4]==='polygon'?3:2);
  $('cancel').disabled=!pending.length;$('undo').disabled=!history.length&&!pending.length;$('export').disabled=!image||!!pending.length;
  $('count').textContent=`${objects.length} objekt`;
  if(image)$('status').textContent=pending.length?`${pending.length} hjørne. Legg til fleire eller fullfør figuren.`:`${definition(tool)[1]}: ${tool==='text'?'skriv merknad og trykk på biletet.':definition(tool)[4]==='point'?'trykk for å plassere symbol.':'trykk for å leggje til hjørne.'}`;
  if(image&&tool==='move')$('status').textContent='Dra eit objekt for å flytte det. Dra på tom bakgrunn for å panorere. Klyp med to fingrar for å zoome.';
}
function draw(c,o){
  const [, , ,color,kind]=definition(o.tool),s=o.size,p=o.points[0];
  c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=Math.max(2,s/9);c.lineJoin='round';c.lineCap='round';
  if(kind!=='point'){
    c.beginPath();o.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));
    if(kind==='polygon'){c.closePath();c.setLineDash([s*.55,s*.4]);}c.stroke();
  }else if(o.tool==='text'){
    c.font=`bold ${s}px system-ui`;c.textBaseline='middle';c.strokeStyle='#18261f';c.lineWidth=s/7;c.strokeText(o.text,p.x,p.y);c.fillText(o.text,p.x,p.y);
  }else if(o.tool==='clean'){
    c.font=`bold ${s*1.4}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('R',p.x,p.y);
  }else if(o.tool==='rod'){
    c.beginPath();const a=s*.18,b=s*.6;
    [[-a,-b],[a,-b],[a,-a],[b,-a],[b,a],[a,a],[a,b],[-a,b],[-a,a],[-b,a],[-b,-a],[-a,-a]].forEach(([x,y],i)=>i?c.lineTo(p.x+x,p.y+y):c.moveTo(p.x+x,p.y+y));c.closePath();c.fill();c.strokeStyle='#303030';c.lineWidth=s/12;c.stroke();
  }else{
    const direction=o.tool==='other'?-1:1;c.beginPath();c.moveTo(p.x,p.y-s*.65*direction);c.lineTo(p.x+s*.65,p.y+s*.5*direction);c.lineTo(p.x-s*.65,p.y+s*.5*direction);c.closePath();c.fill();c.strokeStyle='#171717';c.lineWidth=s/12;c.stroke();
  }c.restore();
}
function symbolSize(){return Number($('size').value)*canvas.width/1000;}
function render(){if(!image)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);objects.forEach(o=>draw(ctx,o));if(pending.length){draw(ctx,{tool,points:pending,size:symbolSize()});ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='#18372f';pending.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,Math.max(4,canvas.width/250),0,Math.PI*2);ctx.fill();ctx.stroke();});ctx.restore();}}
function layout(){if(!image)return;const width=$('viewport').clientWidth;const height=$('viewport').clientHeight;const scale=Math.min(width/canvas.width,height/canvas.height)*zoom;canvas.style.width=`${canvas.width*scale}px`;canvas.style.height=`${canvas.height*scale}px`;}
$('photo').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  if(image&&(objects.length||pending.length)&&!confirm('Opne nytt bilete? Markeringane på det førre biletet blir fjerna.')){e.target.value='';return;}
  const url=URL.createObjectURL(file),next=new Image();
  next.onload=()=>{image=next;objects=[];pending=[];history=[];zoom=1;selected=null;pointers.clear();gesture=null;baseName=file.name.replace(/\.[^.]+$/,'');const scale=Math.min(1,4096/Math.max(next.naturalWidth,next.naturalHeight));canvas.width=Math.round(next.naturalWidth*scale);canvas.height=Math.round(next.naturalHeight*scale);URL.revokeObjectURL(url);$('filename').textContent=file.name;$('empty').hidden=true;$('empty').style.display='none';canvas.hidden=false;$('zoom').value='1';$('result').replaceChildren();if(resultURL)URL.revokeObjectURL(resultURL);layout();render();update();e.target.value='';};
  next.onerror=()=>{URL.revokeObjectURL(url);$('status').textContent='Kunne ikkje opne biletet. Prøv JPEG eller PNG (konverter HEIC ved behov).';e.target.value='';};next.src=url;
};
const viewport=$('viewport'), pointers=new Map();let gesture=null;
function position(x,y){const r=canvas.getBoundingClientRect();return {x:(x-r.left)*canvas.width/r.width,y:(y-r.top)*canvas.height/r.height};}
function hit(p){
  const tolerance=18*canvas.width/canvas.getBoundingClientRect().width;
  for(let i=objects.length-1;i>=0;i--){const o=objects[i],a=o.points[0],kind=definition(o.tool)[4];
    if(kind==='point'){
      if(o.tool==='text'){ctx.font=`bold ${o.size}px system-ui`;if(p.x>=a.x-tolerance&&p.x<=a.x+ctx.measureText(o.text).width+tolerance&&Math.abs(p.y-a.y)<=o.size/2+tolerance)return i;}
      else if(Math.hypot(p.x-a.x,p.y-a.y)<=o.size*.8+tolerance)return i;
    }else{
      let inside=false;
      for(let j=0;j<o.points.length;j++){const a=o.points[j],b=o.points[(j+1)%o.points.length];
        if(kind==='polygon'||j<o.points.length-1){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=tolerance)return i;}
        if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      }if(kind==='polygon'&&inside)return i;
    }
  }return null;
}
function pinchStart(){const [a,b]=[...pointers.values()],r=viewport.getBoundingClientRect();const x=(a.x+b.x)/2,y=(a.y+b.y)/2;gesture={type:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom,anchor:position(x,y),left:r.left,top:r.top};}
viewport.addEventListener('pointerdown',e=>{
  if(!image||e.button!==0)return;e.preventDefault();viewport.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2){pinchStart();return;}
  const p=position(e.clientX,e.clientY);selected=tool==='move'?hit(p):null;
  gesture={type:'single',x:e.clientX,y:e.clientY,p,left:viewport.scrollLeft,top:viewport.scrollTop,index:selected,original:selected===null?null:objects[selected].points.map(p=>({...p})),moved:false};
});
viewport.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(gesture.type==='pinch'){
    const [a,b]=[...pointers.values()];if(!b)return;zoom=Math.max(1,Math.min(6,gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance));layout();
    const scale=canvas.getBoundingClientRect().width/canvas.width;viewport.scrollLeft=gesture.anchor.x*scale-((a.x+b.x)/2-gesture.left);viewport.scrollTop=gesture.anchor.y*scale-((a.y+b.y)/2-gesture.top);$('zoom').value='';return;
  }
  const g=gesture,dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.moved&&Math.hypot(dx,dy)<8)return;
  if(!g.moved&&g.index!==null)remember();g.moved=true;
  if(g.index!==null){const scale=canvas.width/canvas.getBoundingClientRect().width;let x=dx*scale,y=dy*scale;
    x=Math.max(-Math.min(...g.original.map(p=>p.x)),Math.min(x,canvas.width-Math.max(...g.original.map(p=>p.x))));y=Math.max(-Math.min(...g.original.map(p=>p.y)),Math.min(y,canvas.height-Math.max(...g.original.map(p=>p.y))));
    objects[g.index].points=g.original.map(p=>({x:p.x+x,y:p.y+y}));render();update();
  }else{viewport.scrollLeft=g.left-dx;viewport.scrollTop=g.top-dy;}
});
function endPointer(e){
  if(!pointers.has(e.pointerId))return;const g=gesture;pointers.delete(e.pointerId);
  if(g?.type==='pinch'){if(!pointers.size)gesture=null;return;}
  gesture=null;if(e.type==='pointercancel'){if(g?.moved&&g.index!==null){objects[g.index].points=g.original;history.pop();render();update();}return;}
  if(!g||g.moved||tool==='move')return;
  const p=position(e.clientX,e.clientY);if(p.x<0||p.y<0||p.x>canvas.width||p.y>canvas.height)return;
  if(definition(tool)[4]==='point'){
    const text=$('note').value.trim();if(tool==='text'&&!text){$('status').textContent='Skriv ein tekstmerknad først.';$('note').focus();return;}
    remember();objects.push({tool,points:[p],size:symbolSize(),text});
  }else pending.push(p);render();update();
}
viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);
$('finish').onclick=()=>{const minimum=definition(tool)[4]==='polygon'?3:2;if(pending.length<minimum)return;remember();objects.push({tool,points:pending,size:symbolSize()});pending=[];render();update();};
$('cancel').onclick=()=>{pending=[];render();update();};
$('undo').onclick=()=>{if(pending.length)pending.pop();else if(history.length)objects=JSON.parse(history.pop());selected=null;render();update();};
$('size').oninput=render;$('zoom').onchange=()=>{zoom=Number($('zoom').value)||zoom;layout();};window.addEventListener('resize',layout);
$('export').onclick=()=>{
  if(!image||pending.length)return;
  const output=document.createElement('canvas'),factor=Number($('resolution').value),format=$('format').value;
  output.width=Math.max(1,Math.round(canvas.width*factor));output.height=Math.max(1,Math.round(canvas.height*factor));const out=output.getContext('2d');out.fillStyle='#fff';out.fillRect(0,0,output.width,output.height);out.drawImage(canvas,0,0,output.width,output.height);
  output.toBlob(blob=>{if(!blob){$('status').textContent='Kunne ikkje eksportere. Prøv eit mindre bilete.';return;}
    if(resultURL)URL.revokeObjectURL(resultURL);resultURL=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=resultURL;link.download=`${baseName}-markert.${format==='image/jpeg'?'jpg':'png'}`;link.textContent='Last ned det annoterte biletet';
    const help=document.createElement('p');help.textContent='Om nedlasting ikkje fungerer på mobilen: hald inne på biletet under og vel å lagre det. Legg så biletet ved inspeksjonen i Field Maps.';
    const preview=document.createElement('img');preview.src=resultURL;preview.alt='Ferdig bilete med markeringar';$('result').replaceChildren(link,help,preview);link.click();$('status').textContent=`Biletet er klart: ${output.width} × ${output.height} pikslar, ${(blob.size/1024/1024).toFixed(2)} MB. Lagre før du lukkar sida.`;
  },format,0.82);
};
window.addEventListener('beforeunload',e=>{if(objects.length||pending.length){e.preventDefault();e.returnValue='';}});
update();

