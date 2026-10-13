'use strict';
const $ = id => document.getElementById(id);
const definitions = [
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
const canvas=$('canvas'), ctx=canvas.getContext('2d');
for(const [id,label,symbol,color] of definitions){
  const button=document.createElement('button'); button.type='button';
  const icon=document.createElement('span');icon.className='symbol';icon.textContent=symbol;icon.style.color=id==='text'?'#18372f':color;
  button.append(icon,document.createTextNode(label));button.dataset.tool=id;
  button.onclick=()=>{pending=[];tool=id;update();render();};$('tools').append(button);
}
function definition(id){return definitions.find(d=>d[0]===id);}
function update(){
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
  $('finish').disabled=!image||pending.length<(definition(tool)[4]==='polygon'?3:2);
  $('cancel').disabled=!pending.length;$('undo').disabled=!objects.length&&!pending.length;$('export').disabled=!image||!!pending.length;
  $('count').textContent=`${objects.length} objekt`;
  if(image)$('status').textContent=pending.length?`${pending.length} hjørne. Legg til fleire eller fullfør figuren.`:`${definition(tool)[1]}: ${tool==='text'?'skriv merknad og trykk på biletet.':definition(tool)[4]==='point'?'trykk for å plassere symbol.':'trykk for å leggje til hjørne.'}`;
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
function layout(){if(!image)return;const width=$('viewport').clientWidth;const height=$('viewport').clientHeight;const scale=Math.min(width/canvas.width,height/canvas.height)*Number($('zoom').value);canvas.style.width=`${canvas.width*scale}px`;canvas.style.height=`${canvas.height*scale}px`;}
$('photo').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  if(image&&(objects.length||pending.length)&&!confirm('Opne nytt bilete? Markeringane på det førre biletet blir fjerna.')){e.target.value='';return;}
  const url=URL.createObjectURL(file),next=new Image();
  next.onload=()=>{image=next;objects=[];pending=[];baseName=file.name.replace(/\.[^.]+$/,'');const scale=Math.min(1,4096/Math.max(next.naturalWidth,next.naturalHeight));canvas.width=Math.round(next.naturalWidth*scale);canvas.height=Math.round(next.naturalHeight*scale);URL.revokeObjectURL(url);$('filename').textContent=file.name;$('empty').hidden=true;$('empty').style.display='none';canvas.hidden=false;$('zoom').value='1';$('result').replaceChildren();if(resultURL)URL.revokeObjectURL(resultURL);layout();render();update();e.target.value='';};
  next.onerror=()=>{URL.revokeObjectURL(url);$('status').textContent='Kunne ikkje opne biletet. Prøv JPEG eller PNG (konverter HEIC ved behov).';e.target.value='';};next.src=url;
};
let down=null;
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointercancel',()=>down=null);
canvas.addEventListener('pointerup',e=>{
  if(!image||!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8){down=null;return;}down=null;
  const r=canvas.getBoundingClientRect(),p={x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};
  if(definition(tool)[4]==='point'){
    const text=$('note').value.trim();if(tool==='text'&&!text){$('status').textContent='Skriv ein tekstmerknad først.';$('note').focus();return;}
    objects.push({tool,points:[p],size:symbolSize(),text});
  }else pending.push(p);render();update();
});
$('finish').onclick=()=>{const minimum=definition(tool)[4]==='polygon'?3:2;if(pending.length<minimum)return;objects.push({tool,points:pending,size:symbolSize()});pending=[];render();update();};
$('cancel').onclick=()=>{pending=[];render();update();};
$('undo').onclick=()=>{if(pending.length)pending.pop();else objects.pop();render();update();};
$('size').oninput=render;$('zoom').onchange=layout;window.addEventListener('resize',layout);
$('export').onclick=()=>{
  if(!image||pending.length)return;
  canvas.toBlob(blob=>{if(!blob){$('status').textContent='Kunne ikkje eksportere. Prøv eit mindre bilete.';return;}
    if(resultURL)URL.revokeObjectURL(resultURL);resultURL=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=resultURL;link.download=`${baseName}-markert.png`;link.textContent='Last ned det annoterte biletet';
    const help=document.createElement('p');help.textContent='Om nedlasting ikkje fungerer på mobilen: hald inne på biletet under og vel å lagre det. Legg så biletet ved inspeksjonen i Field Maps.';
    const preview=document.createElement('img');preview.src=resultURL;preview.alt='Ferdig bilete med markeringar';$('result').replaceChildren(link,help,preview);link.click();$('status').textContent='PNG er klar. Lagre biletet før du lukkar sida.';
  },'image/png');
};
window.addEventListener('beforeunload',e=>{if(objects.length||pending.length){e.preventDefault();e.returnValue='';}});
update();
