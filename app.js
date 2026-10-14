/*
 * BERGMERKE – fotoannotering i nettlesaren
 *
 * index.html: felt, knappar og hjelpetekstar. Behald id-ane når du endrar tekst.
 * style.css: utsjånad og mobiltilpassing.
 * advanced-symbols.js: symbol frå Word-malen, innebygde som data-URL-ar.
 * Denne fila: tilstand, teikning, muse-/berøringshandlingar og eksport.
 *
 * Vanlege justeringar (søk etter verdiane nedanfor):
 *   4096  = maksimal lengste side på arbeidsfotoet, i pikslar.
 *   0.82  = JPEG-kvalitet ved eksport (0–1; påverkar ikkje PNG).
 *   60    = maksimalt tal steg i angrehistorikken.
 *   / 68  = skriftstorleik i teiknforklaringa relativt til fotobreidda.
 * Zoom blir avgrensa til 1–6 i både klypezoom og musehjul.
 *
 * Alt blir behandla lokalt. Arbeidet er i minnet fram til eksport;
 * det er ikkje automatisk lagring eller synkronisering til ArcGIS.
 */
'use strict';
// Kortform for oppslag av eit HTML-element etter id, til dømes $('photo').
const $ = id => document.getElementById(id);
// VERKTØY OG SYMBOL
// Kvar rad: [id, visingsnamn, knappsymbol, farge, type, valfrie biletkjelder].
// Type er point, line, polygon, action (navigering/plassering) eller move.
// Nye former treng også teiknelogikk i draw(); ei ny rad åleine er ikkje nok.
const definitions = [
  ['pan','Panorer','✋','#18372f','action'],
  ['legendPlace','Plasser teiknforklaring','▤','#18372f','action'],
  ['move','Flytt / rediger','↔','#18372f','move'],
  ['delete','Slett objekt','⌫','#b32929','action'],
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
// Ta vare på kva verktøy som høyrer til enkel modus før avanserte blir lagde til.
const simpleTools=new Set(definitions.map(d=>d[0]));
// Last biletsymbol ein gong. Data-URL-ar gjer at lokal HTML også kan eksporterast.
const symbolImages=new Map();
for(const [id,label,assets,kind] of advancedSymbols){
  definitions.push([id,label,'','#00b050',kind,assets]);
  for(const src of assets){const img=new Image();img.onload=()=>{render();update();};img.onerror=()=>{$('status').textContent='Kunne ikkje laste symbol. Last sida på nytt med nett.';};img.src=src;symbolImages.set(src,img);}
}
definitions.push(['advRod','Stag, X m','✚','#888888','point'],['advBand','Band','═','#ff0000','line'],['advClean','Rensk','R','#ff0000','point'],['advLoose','Ser laust ut · rensk eller bolt','?','#ff0000','point'],['advExisting','Eksisterande bolt','◌','#ff0000','point'],['advOther','Anna markering','◌','#000000','point']);
// APP-TILSTAND
// objects: fullførte objekt {tool, points: [{x,y}], size, valfri text}.
// pending: hjørne i linja/polygonet som enno ikkje er fullført.
// Alle punkt og legendPlacement er i arbeidsfotoet sine pikslar, ikkje skjermpikslar.
// tool: aktiv modus. resultURL: mellombels nedlastingsadresse for siste eksport.
let image=null, objects=[], pending=[], tool='pan', baseName='inspeksjon', resultURL=null, legendPlacement=null;
// Zoom påverkar berre visinga. history lagrar objekt og plassering av teiknforklaring.
let zoom=1, selected=null, history=[];
// Ta eit bilete av tilstanden FØR ei endring. Ei heil draging er eitt angresteg.
function remember(){history.push(JSON.stringify({objects,legendPlacement}));if(history.length>60)history.shift();}
// Same teikneflate blir brukt i førehandsvisinga og som grunnlag for eksport.
const canvas=$('canvas'), ctx=canvas.getContext('2d');
// Lag knappane frå symboldefinisjonane. Navigering og redigering kjem nær fotoet.
for(const [id,label,symbol,color] of definitions){
  const button=document.createElement('button'); button.type='button';
  const icon=document.createElement('span');icon.className='symbol';icon.textContent=symbol;icon.style.color=id==='text'?'#18372f':color;
  if(definition(id)[5]){const preview=document.createElement('img');preview.src=definition(id)[5][0];preview.alt='';icon.append(preview);}
  button.append(icon,document.createTextNode(label));button.dataset.tool=id;
  button.onclick=()=>{pending=[];selected=null;tool=tool===id&&['move','delete'].includes(id)?'pan':id;pointers.clear();gesture=null;update();render();};$(id==='move'||definition(id)[4]==='action'?'editTools':'tools').append(button);
}
// Finn definisjonen til eit verktøy ut frå den stabile interne id-en.
function definition(id){return definitions.find(d=>d[0]===id);}
// Lagre ferdige symbolpeikarar, så dei ikkje må teiknast for kvar museflytting.
const cursorCache=new Map();
// MUSEPEIKAR: hand for panorering, piler for flytting og valt symbol for teikning.
// Eit 48 × 48-bilete med treffpunkt (24,24) blir brukt som eigendefinert peikar.
function updateCursor(){
  let cursor='crosshair';
  if(!image)cursor='default';
  else if(tool==='pan')cursor=gesture?.type==='single'&&gesture.moved?'grabbing':'grab';
  else if(tool==='move')cursor='move';
  else if(tool==='delete')cursor='not-allowed';
  else if(tool==='legendPlace')cursor='copy';
  else{
    if(!cursorCache.has(tool)){
      const d=definition(tool);
      if(!d[5]||d[5].every(src=>symbolImages.get(src).naturalWidth)){
        try{
          const badge=document.createElement('canvas');badge.width=48;badge.height=48;
          const c=badge.getContext('2d');
          c.fillStyle='rgba(235,238,232,0.85)';c.beginPath();c.arc(24,24,22,0,Math.PI*2);c.fill();
          const points=d[4]==='point'?[{x:24,y:24}]:d[4]==='polygon'?[{x:10,y:14},{x:38,y:14},{x:38,y:34},{x:10,y:34}]:[{x:10,y:24},{x:38,y:24}];
          draw(c,{tool,size:22,points,text:'T'});
          cursorCache.set(tool,`url("${badge.toDataURL('image/png')}") 24 24, crosshair`);
        }catch{cursorCache.set(tool,'crosshair');}
      }
    }
    cursor=cursorCache.get(tool)||'crosshair';
  }
  canvas.style.cursor=cursor;$('viewport').style.cursor=cursor;
}
// Oppdater knappar, aktiv modus, zoomlås og status. Dette teiknar ikkje fotoet.
// Eksport blir sperra dersom ei figur er ufullført eller eit brukt symbol ikkje er lasta.
function update(){
  updateCursor();
  document.querySelectorAll('[data-tool]').forEach(b=>{const d=definition(b.dataset.tool);b.hidden=d[4]!=='action'&&b.dataset.tool!=='move'&&b.dataset.tool!=='text'&&($('registration').value==='advanced'?simpleTools.has(b.dataset.tool):!simpleTools.has(b.dataset.tool));b.disabled=(b.dataset.tool==='legendPlace'&&(!image||!legendEntries().length))||!!d[5]&&d[5].some(src=>!symbolImages.get(src).complete||!symbolImages.get(src).naturalWidth);});
  $('removeLegend').disabled=!legendPlacement;
  $('zoom').disabled=['move','delete'].includes(tool);
  $('viewport').style.overflow=['move','delete'].includes(tool)?'hidden':'auto';
  $('modeHint').textContent=tool==='move'?'Zoom og panorering er låst. Dra eit objekt. Trykk knappen igjen for å teikne.':'Klyp eller bruk musehjulet for zoom · dra bakgrunnen for å panorere';
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
  $('finish').disabled=!image||pending.length<(definition(tool)[4]==='polygon'?3:2);
  $('cancel').disabled=!pending.length;$('undo').disabled=!history.length&&!pending.length;$('export').disabled=!image||!!pending.length;
  if(objects.some(o=>definition(o.tool)[5]?.some(src=>!symbolImages.get(src).naturalWidth)))$('export').disabled=true;
  $('count').textContent=`${objects.length} objekt`;
  if(image)$('status').textContent=pending.length?`${pending.length} hjørne. Legg til fleire eller fullfør figuren.`:`${definition(tool)[1]}: ${tool==='text'?'skriv merknad og trykk på biletet.':definition(tool)[4]==='point'?'trykk for å plassere symbol.':'trykk for å leggje til hjørne.'}`;
  if(image&&tool==='move')$('status').textContent='Dra eit objekt eller teiknforklaringa for å flytte. Zoom og panorering er låst.';
  if(tool==='delete'){$('modeHint').textContent='Trykk på objektet du vil slette. Angre gjenopprettar det.';if(image)$('status').textContent='Slett objekt: trykk på eit symbol, ei linje, eit polygon eller teiknforklaringa. Zoom og panorering er låst.';}
  if(image&&tool==='pan')$('status').textContent='Panorer: dra biletet. Trykk legg ikkje til symbol. Klyp eller bruk musehjulet for zoom.';
  if(image&&tool==='legendPlace')$('status').textContent='Trykk på biletet der øvre venstre hjørne av teiknforklaringa skal vere.';
}
// TEIKN EITT OBJEKT på den oppgitte 2D-flata c.
// Brukt av fotoet, symbolpeikaren og teiknforklaringa for å halde symbola like.
// Biletsymbol blir stempla; grøne avgrensingar brukar eitt merke i kvar ende.
// save()/restore() hindrar at farge, stipling og linjebreidd smittar over på neste objekt.
function draw(c,o){
  const [, , ,color,kind]=definition(o.tool),s=o.size,p=o.points[0];
  const assets=definition(o.tool)[5];
  if(assets){
    const stamp=(src,p)=>{const img=symbolImages.get(src);if(!img.naturalWidth)return;const scale=s*1.4/Math.max(img.naturalWidth,img.naturalHeight);c.drawImage(img,p.x-img.naturalWidth*scale/2,p.y-img.naturalHeight*scale/2,img.naturalWidth*scale,img.naturalHeight*scale);};
    stamp(assets[0],p);if(kind==='line'&&o.points.length>1)stamp(assets[1],o.points[o.points.length-1]);return;
  }
  c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=Math.max(2,s/9);c.lineJoin='round';c.lineCap='round';
  if(o.tool==='advExisting'||o.tool==='advOther'){c.setLineDash([s*.07,s*.14]);c.beginPath();c.arc(p.x,p.y,s*.6,0,Math.PI*2);c.stroke();c.restore();return;}
  if(o.tool==='advLoose'){c.font=`bold ${s*1.4}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('?',p.x,p.y);c.restore();return;}
  if(kind!=='point'){
    if(o.tool==='advBand'){c.lineWidth=s*.25;}
    c.beginPath();o.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));
    if(kind==='polygon'){c.closePath();c.setLineDash([s*.55,s*.4]);}c.stroke();
    if(o.tool==='advBand'){c.strokeStyle='#ffffff';c.lineWidth=s*.08;c.stroke();}
  }else if(o.tool==='text'){
    c.font=`bold ${s}px system-ui`;c.textBaseline='middle';c.strokeStyle='#18261f';c.lineWidth=s/7;c.strokeText(o.text,p.x,p.y);c.fillText(o.text,p.x,p.y);
  }else if(o.tool==='clean'||o.tool==='advClean'){
    c.font=`bold ${s*1.4}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('R',p.x,p.y);
  }else if(o.tool==='rod'||o.tool==='advRod'){
    c.beginPath();const a=s*.18,b=s*.6;
    [[-a,-b],[a,-b],[a,-a],[b,-a],[b,a],[a,a],[a,b],[-a,b],[-a,a],[-b,a],[-b,-a],[-a,-a]].forEach(([x,y],i)=>i?c.lineTo(p.x+x,p.y+y):c.moveTo(p.x+x,p.y+y));c.closePath();c.fill();c.strokeStyle='#303030';c.lineWidth=s/12;c.stroke();
  }else{
    const direction=o.tool==='other'?-1:1;c.beginPath();c.moveTo(p.x,p.y-s*.65*direction);c.lineTo(p.x+s*.65,p.y+s*.5*direction);c.lineTo(p.x-s*.65,p.y+s*.5*direction);c.closePath();c.fill();c.strokeStyle='#171717';c.lineWidth=s/12;c.stroke();
  }c.restore();
}
// Symbolstorleiken er relativ til fotobreidda. Endringar gjeld nye objekt.
function symbolSize(){return Number($('size').value)*canvas.width/1000;}
// Teikn på nytt i lag: originalfoto → objekt → ufullførte hjørne → teiknforklaring.
// Foto og markeringar blir alltid teikna frå tilstanden, ikkje oppå førre teikning.
function render(){if(!image)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);objects.forEach(o=>draw(ctx,o));if(pending.length){draw(ctx,{tool,points:pending,size:symbolSize()});ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='#18372f';pending.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,Math.max(4,canvas.width/250),0,Math.PI*2);ctx.fill();ctx.stroke();});ctx.restore();}drawPlacedLegend(ctx);}
// Tilpass fotoet til visingsfeltet og legg til zoom som CSS-storleik.
// canvas.width/height blir ikkje endra her; då ville teikneflata blitt tømd.
function layout(){if(!image)return;const width=$('viewport').clientWidth;const height=$('viewport').clientHeight;const scale=Math.min(width/canvas.width,height/canvas.height)*zoom;canvas.style.width=`${canvas.width*scale}px`;canvas.style.height=`${canvas.height*scale}px`;}
// LAST INN FOTO: opprett ei mellombels adresse, skaler ved behov og nullstill arbeidet.
// Originalfila blir ikkje endra. Nytt foto krev stadfesting dersom markeringar finst.
$('photo').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  if(image&&(objects.length||pending.length)&&!confirm('Opne nytt bilete? Markeringane på det førre biletet blir fjerna.')){e.target.value='';return;}
  const url=URL.createObjectURL(file),next=new Image();
  next.onload=()=>{image=next;objects=[];pending=[];history=[];legendPlacement=null;zoom=1;selected=null;pointers.clear();gesture=null;baseName=file.name.replace(/\.[^.]+$/,'');const scale=Math.min(1,4096/Math.max(next.naturalWidth,next.naturalHeight));canvas.width=Math.round(next.naturalWidth*scale);canvas.height=Math.round(next.naturalHeight*scale);URL.revokeObjectURL(url);$('filename').textContent=file.name;$('empty').hidden=true;$('empty').style.display='none';canvas.hidden=false;$('zoom').value='1';$('result').replaceChildren();if(resultURL)URL.revokeObjectURL(resultURL);layout();render();update();e.target.value='';};
  next.onerror=()=>{URL.revokeObjectURL(url);$('status').textContent='Kunne ikkje opne biletet. Prøv JPEG eller PNG (konverter HEIC ved behov).';e.target.value='';};next.src=url;
};
// MUS OG BERØRING
// pointers held styr på aktive fingrar/museknappar. gesture beskriv pågåande handling.
// single: trykk/draging; pinch: klypezoom; blocked: fleire fingrar i redigeringsmodus.
const viewport=$('viewport'), pointers=new Map();let gesture=null;
// Gjer klientkoordinatar om til fotopikslar, også når fotoet er zooma og panorert.
function position(x,y){const r=canvas.getBoundingClientRect();return {x:(x-r.left)*canvas.width/r.width,y:(y-r.top)*canvas.height/r.height};}
// Trefftest: gå baklengs så øvste objekt blir valt først.
// Punkt og tekst får treffmargin; linjer blir testa mot segment; polygon også mot innsida.
function hit(p){
  const tolerance=18*canvas.width/canvas.getBoundingClientRect().width;
  for(let i=objects.length-1;i>=0;i--){const o=objects[i],a=o.points[0],kind=definition(o.tool)[4];
    if(kind==='point'){
      if(o.tool==='text'){ctx.font=`bold ${o.size}px system-ui`;if(p.x>=a.x-tolerance&&p.x<=a.x+ctx.measureText(o.text).width+tolerance&&Math.abs(p.y-a.y)<=o.size/2+tolerance)return i;}
      else if(Math.hypot(p.x-a.x,p.y-a.y)<=o.size*.8+tolerance)return i;
    }else{
      if(definition(o.tool)[5]){if(o.points.some(a=>Math.hypot(p.x-a.x,p.y-a.y)<=o.size+tolerance))return i;continue;}
      let inside=false;
      for(let j=0;j<o.points.length;j++){const a=o.points[j],b=o.points[(j+1)%o.points.length];
        if(kind==='polygon'||j<o.points.length-1){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=tolerance)return i;}
        if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      }if(kind==='polygon'&&inside)return i;
    }
  }return null;
}
// Hugs avstand, zoom og fotopunktet mellom fingrane ved starten av klypezoom.
function pinchStart(){const [a,b]=[...pointers.values()],r=viewport.getBoundingClientRect();const x=(a.x+b.x)/2,y=(a.y+b.y)/2;gesture={type:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom,anchor:position(x,y),left:r.left,top:r.top};}
// Avbryt ei draging og fjern angresteg som vart oppretta for denne draginga.
function restoreDrag(g){if(g.index==='legend')legendPlacement=g.savedLegend;else objects[g.index].points=g.original;history.pop();render();update();}
// START HANDLING: fang peikaren også utanfor feltet.
// I redigeringsmodus har teiknforklaringa prioritet over objekt ho ligg oppå.
// To fingrar avbryt flytting, sidan zoom/panorering skal vere låst ved redigering.
viewport.addEventListener('pointerdown',e=>{
  if(!image||e.button!==0)return;e.preventDefault();viewport.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size>=2){
    if(['move','delete'].includes(tool)){
      if(gesture?.type==='single'&&gesture.moved&&gesture.index!==null)restoreDrag(gesture);
      gesture={type:'blocked'};return;
    }
    pinchStart();return;
  }
  const p=position(e.clientX,e.clientY),legend=tool==='move'?legendBounds():null;
  selected=tool==='move'?(legend&&p.x>=legend.x&&p.x<=legend.x+legend.w&&p.y>=legend.y&&p.y<=legend.y+legend.h?'legend':hit(p)):null;
  gesture={type:'single',x:e.clientX,y:e.clientY,p,left:viewport.scrollLeft,top:viewport.scrollTop,index:selected,original:selected===null?null:selected==='legend'?[{x:legend.x,y:legend.y}]:objects[selected].points.map(p=>({...p})),savedLegend:legendPlacement?{...legendPlacement}:null,legend,moved:false};
});
// FLYTT HANDLING: mindre enn 8 skjermpikslar blir rekna som eit trykk.
// Klypezoom held ankerpunktet mellom fingrane. Objekt og teiknforklaring
// blir avgrensa til fotoet; bakgrunnsdraging panorerer utanfor redigeringsmodus.
viewport.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(gesture.type==='blocked')return;
  if(gesture.type==='pinch'){
    const [a,b]=[...pointers.values()];if(!b)return;zoom=Math.max(1,Math.min(6,gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance));layout();
    const scale=canvas.getBoundingClientRect().width/canvas.width;viewport.scrollLeft=gesture.anchor.x*scale-((a.x+b.x)/2-gesture.left);viewport.scrollTop=gesture.anchor.y*scale-((a.y+b.y)/2-gesture.top);$('zoom').value='';return;
  }
  const g=gesture,dx=e.clientX-g.x,dy=e.clientY-g.y;if(!g.moved&&Math.hypot(dx,dy)<8)return;
  // Draging i slettemodus skal verken flytte, panorere eller slette noko.
  if(tool==='delete'){g.moved=true;return;}
  if(!g.moved&&g.index!==null)remember();g.moved=true;
  updateCursor();
  if(g.index!==null){const scale=canvas.width/canvas.getBoundingClientRect().width;let x=dx*scale,y=dy*scale;
    if(g.index==='legend'){
      legendPlacement={x:Math.max(0,Math.min(g.original[0].x+x,canvas.width-g.legend.w)),y:Math.max(0,Math.min(g.original[0].y+y,canvas.height-g.legend.h))};render();update();return;
    }
    x=Math.max(-Math.min(...g.original.map(p=>p.x)),Math.min(x,canvas.width-Math.max(...g.original.map(p=>p.x))));y=Math.max(-Math.min(...g.original.map(p=>p.y)),Math.min(y,canvas.height-Math.max(...g.original.map(p=>p.y))));
    objects[g.index].points=g.original.map(p=>({x:p.x+x,y:p.y+y}));render();update();
  }else if(tool!=='move'){viewport.scrollLeft=g.left-dx;viewport.scrollTop=g.top-dy;}
});
// AVSLUTT HANDLING: berre eit kort trykk i teiknemodus legg til eit objekt/hjørne.
// Panorering, flytting og klypezoom skal aldri leggje til nye symbol.
function endPointer(e){
  if(!pointers.has(e.pointerId))return;const g=gesture;pointers.delete(e.pointerId);
  if(g?.type==='pinch'||g?.type==='blocked'){if(!pointers.size)gesture=null;return;}
  gesture=null;if(e.type==='pointercancel'){if(g?.moved&&g.index!==null)restoreDrag(g);return;}
  if(!g||g.moved||tool==='move'||tool==='pan')return;
  const p=position(e.clientX,e.clientY);if(p.x<0||p.y<0||p.x>canvas.width||p.y>canvas.height)return;
  // Slett berre det øvste trefte objektet. Tom bakgrunn gjer ingenting.
  // Teiknforklaringa ligg øvst, slik at objekt under panelet ikkje blir sletta.
  if(tool==='delete'){
    const legend=legendBounds();
    if(legend&&p.x>=legend.x&&p.x<=legend.x+legend.w&&p.y>=legend.y&&p.y<=legend.y+legend.h){remember();legendPlacement=null;}
    else{const index=hit(p);if(index===null)return;remember();objects.splice(index,1);}
    render();update();return;
  }
  if(tool==='legendPlace'){remember();legendPlacement=p;tool='pan';render();update();return;}
  if(definition(tool)[4]==='point'){
    const text=$('note').value.trim();if(tool==='text'&&!text){$('status').textContent='Skriv ein tekstmerknad først.';$('note').focus();return;}
    remember();objects.push({tool,points:[p],size:symbolSize(),text});
  }else if(!definition(tool)[5]||pending.length<2)pending.push(p);render();update();
}
viewport.addEventListener('pointerup',e=>{endPointer(e);updateCursor();});viewport.addEventListener('pointercancel',e=>{endPointer(e);updateCursor();});
// MUSEHJUL: normaliser pikslar/linjer/sider og zoom rundt musepeikaren.
// .002 styrer farten. preventDefault hindrar samtidig siderulling over biletet.
viewport.addEventListener('wheel',e=>{
  if(!image)return;
  e.preventDefault();
  if(['move','delete'].includes(tool)||pointers.size)return;
  const anchor=position(e.clientX,e.clientY),r=viewport.getBoundingClientRect();
  const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1);
  zoom=Math.max(1,Math.min(6,zoom*Math.exp(-Math.max(-500,Math.min(500,delta))*.002)));
  layout();
  const scale=canvas.getBoundingClientRect().width/canvas.width;
  viewport.scrollLeft=anchor.x*scale-(e.clientX-r.left);
  viewport.scrollTop=anchor.y*scale-(e.clientY-r.top);
  $('zoom').value='';
},{passive:false});
// FIGURAR OG ANGRE
// Ei linje krev minst to punkt, eit polygon minst tre. Fullføringa er eitt angresteg.
$('finish').onclick=()=>{const minimum=definition(tool)[4]==='polygon'?3:2;if(pending.length<minimum)return;remember();objects.push({tool,points:pending,size:symbolSize()});pending=[];render();update();};
$('cancel').onclick=()=>{pending=[];render();update();};
$('undo').onclick=()=>{if(pending.length)pending.pop();else if(history.length){const state=JSON.parse(history.pop());objects=state.objects;legendPlacement=state.legendPlacement;}selected=null;render();update();};
// Felt og vindaugsstorleik: oppdater visinga utan å endre eksisterande objekt.
$('size').oninput=render;$('zoom').onchange=()=>{if(['move','delete'].includes(tool))return;zoom=Number($('zoom').value)||zoom;layout();};window.addEventListener('resize',layout);
// Modusbyte beheld fullførte objekt, men avbryt ei ufullført figur.
$('registration').onchange=()=>{pending=[];selected=null;tool=$('registration').value==='advanced'?'advanced0':'bolt';update();render();};
// TEIKNFORKLARING
// Finn kvar brukt symboltype éin gong. Tekstmerknader har inga eiga forklaringsrad.
function legendEntries(){return [...new Set(objects.filter(o=>o.tool!=='text').map(o=>o.tool))].map(id=>definition(id));}
// Tel berre enkeltboltar, ikkje boltesikringsområde eller eksisterande boltar.
// advanced0–20 er lengd/diameter-variantar; advanced31 er bolt med boreretning.
function isCountedBolt(id) {
  return id === 'bolt' || id === 'advanced31' || /^advanced([0-9]|1[0-9]|20)$/.test(id);
}
function legendSummary() {
  const counts = new Map();
  for (const object of objects) counts.set(object.tool, (counts.get(object.tool) || 0) + 1);
  const rows = legendEntries().map(d => ({
    d,
    label: isCountedBolt(d[0]) ? `${d[1]} (${counts.get(d[0])} stk.)` : d[1]
  }));
  const total = objects.filter(object => isCountedBolt(object.tool)).length;
  return { rows, total };
}
// Mål teksten med same skrifttype som ved teikning. Panelet får akkurat
// den breidda innhaldet treng, inkludert symbolfelt, overskrift og marg.
// legendBounds() krympar panelet dersom det elles ville gått utanfor fotoet.
function buildLegend() {
  const output = document.createElement('canvas');
  const { rows, total } = legendSummary();
  const font = Math.max(13, Math.round(canvas.width / 68));
  const pad = font, rowHeight = font * 2.4, textX = pad * 4.5;
  const heading = 'Teiknforklaring';
  const footer = `Totalt tal boltar: ${total} stk.`;
  const measure = output.getContext('2d');
  measure.font = `${font}px system-ui`;
  const rowWidth = Math.max(0, ...rows.map(row => measure.measureText(row.label).width));
  measure.font = `bold ${font}px system-ui`;
  const titleWidth = Math.max(measure.measureText(heading).width, measure.measureText(footer).width);
  output.width = Math.ceil(Math.max(textX + rowWidth + pad, titleWidth + pad * 2));
  output.height = Math.ceil(pad * 4 + font * 2 + rows.length * rowHeight);

  const out = output.getContext('2d');
  out.fillStyle = '#fff';
  out.fillRect(0, 0, output.width, output.height);
  out.font = `bold ${font}px system-ui`;
  out.fillStyle = '#18372f';
  out.fillText(heading, pad, pad + font);
  let y = pad * 2 + font;
  for (const { d, label } of rows) {
    const size = font * 1.25, h = rowHeight;
    out.fillStyle = '#e7eae5';
    out.fillRect(pad, y, pad * 2.6, h - pad / 3);
    const points = d[4] === 'point'
      ? [{ x: pad * 2.3, y: y + h / 2 }]
      : d[4] === 'polygon'
        ? [{ x: pad * 1.3, y: y + h * .25 }, { x: pad * 3.3, y: y + h * .25 },
           { x: pad * 3.3, y: y + h * .75 }, { x: pad * 1.3, y: y + h * .75 }]
        : [{ x: pad * 1.5, y: y + h / 2 }, { x: pad * 3.1, y: y + h / 2 }];
    draw(out, { tool: d[0], size, points });
    out.font = `${font}px system-ui`;
    out.fillStyle = '#18372f';
    out.fillText(label, textX, y + font);
    y += h;
  }
  out.font = `bold ${font}px system-ui`;
  out.fillStyle = '#18372f';
  out.fillText(footer, pad, y + pad + font);
  return output;
}
// Rekn ut faktisk plassering/storleik; krymp og avgrens panelet til fotoet.
// Desse same måla blir brukte av teikning og trefftesten for flytting.
function legendBounds(){
  if(!legendPlacement||!legendEntries().length)return null;
  const panel=buildLegend(),scale=Math.min(1,canvas.width/panel.width,canvas.height/panel.height),w=panel.width*scale,h=panel.height*scale;
  const x=Math.max(0,Math.min(legendPlacement.x,canvas.width-w)),y=Math.max(0,Math.min(legendPlacement.y,canvas.height-h));
  return {panel,x,y,w,h};
}
// Legg panelet over fotoet på den valde plassen.
function drawPlacedLegend(c){
  const bounds=legendBounds();if(!bounds)return;
  const {panel,x,y,w,h}=bounds;c.drawImage(panel,x,y,w,h);
}
// EKSPORT
// Lag ei separat teikneflate i valt oppløysing. factor=0.5 gir halv breidd/høgd.
// Zoom på skjermen påverkar ikkje eksporten; arbeidsfotoet blir brukt direkte.
function exportImage(factor){
  const output=document.createElement('canvas');output.width=Math.max(1,Math.round(canvas.width*factor));output.height=Math.max(1,Math.round(canvas.height*factor));
  const out=output.getContext('2d');out.fillStyle='#fff';out.fillRect(0,0,output.width,output.height);out.drawImage(canvas,0,0,output.width,output.height);return output;
}
// Fjerning av teiknforklaring kan angrast, akkurat som flytting.
$('removeLegend').onclick=()=>{remember();legendPlacement=null;render();update();};
// Lag JPEG/PNG som Blob, start nedlasting og vis lenkje/førehandsvising som reserve.
// Frigjer førre Blob-adresse for å unngå å halde gamle eksportar i minnet.
// Feil frå teikning/koding blir viste i statusfeltet i staden for eit stumt knappetrykk.
$('export').onclick=()=>{
  if(!image||pending.length)return;
  try{
  render();const output=exportImage(Number($('resolution').value)),format=$('format').value;
  output.toBlob(blob=>{if(!blob){$('status').textContent='Kunne ikkje eksportere. Prøv eit mindre bilete.';return;}
    if(resultURL)URL.revokeObjectURL(resultURL);resultURL=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=resultURL;link.download=`${baseName}-markert.${format==='image/jpeg'?'jpg':'png'}`;link.textContent='Last ned det annoterte biletet';
    const help=document.createElement('p');help.textContent='Om nedlasting ikkje fungerer på mobilen: hald inne på biletet under og vel å lagre det. Legg så biletet ved inspeksjonen i Field Maps.';
    const preview=document.createElement('img');preview.src=resultURL;preview.alt='Ferdig bilete med markeringar';$('result').replaceChildren(link,help,preview);document.body.append(link);link.click();$('result').prepend(link);$('status').textContent=`Biletet er klart: ${output.width} × ${output.height} pikslar, ${(blob.size/1024/1024).toFixed(2)} MB. Lagre før du lukkar sida.`;
  },format,0.82);
  }catch(error){$('status').textContent='Kunne ikkje lagre biletet: '+error.message+'. Prøv å opne den oppdaterte sida på nytt.';}
};
// Be nettlesaren varsle før ulagrede markeringar blir borte ved lukking/oppfrisking.
window.addEventListener('beforeunload',e=>{if(objects.length||pending.length){e.preventDefault();e.returnValue='';}});
// Set starttilstanden for knappane. Ingen bilete er lasta enno.
update();
