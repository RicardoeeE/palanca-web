/**
 * <barra-articulada> — Web Component
 * ─────────────────────────────────────────────────────────────────────
 * Zero dependencias. Zero build step. Un solo archivo.
 * Reutiliza exactamente la misma lógica que DiagramGenerator (Node.js).
 *
 * USO:
 *   <script type="module" src="barra-articulada.js"></script>
 *
 *   <!-- Estático -->
 *   <barra-articulada theta="30" omega="2" alpha="3" L="1" m="1"></barra-articulada>
 *
 *   <!-- Interactivo con sliders -->
 *   <barra-articulada theta="30" omega="2" alpha="3" L="1" m="1" interactive></barra-articulada>
 *
 *   <!-- Preset personalizado -->
 *   <barra-articulada theta="45" preset="dcl" interactive></barra-articulada>
 *
 * ATRIBUTOS observados (todos reactivos):
 *   theta, omega, alpha, L, m, preset, interactive, width, height
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// PHYSICS — idéntico a src/physics/barraArticulada.js
// ═══════════════════════════════════════════════════════════════════
const G_CONST = 9.81;

function physicsCompute({ theta_deg, omega, alpha, L, m, layout = {} }) {
  const th   = theta_deg * Math.PI / 180;
  const sinT = Math.sin(th), cosT = Math.cos(th);
  const Ox   = layout.Ox ?? 220, Oy = layout.Oy ?? 300;
  const PX   = layout.PX ?? 110;
  const aN_m = (L / 2) * omega * omega;
  const aT_m = (L / 2) * Math.abs(alpha);
  const W_m  = m * G_CONST;
  const VS   = (layout.VS ?? 85) / Math.max(aN_m, aT_m, W_m, 1);
  const B    = { x: Ox + L * PX * cosT, y: Oy - L * PX * sinT };
  const Gp   = { x: Ox + (L/2) * PX * cosT, y: Oy - (L/2) * PX * sinT };
  const ex = cosT, ey = -sinT, px = -sinT, py = -cosT;
  const aN_dx = -ex * aN_m * VS, aN_dy = -ey * aN_m * VS;
  const sg = alpha >= 0 ? 1 : -1;
  const aT_dx = px * sg * aT_m * VS, aT_dy = py * sg * aT_m * VS;
  const W_px  = Math.min(W_m * VS, 95);
  const F_val = sinT > 1e-6
    ? (m * G_CONST * cosT) / (2 * sinT) + (m * L * alpha) / (3 * sinT) : 0;
  const F_len = F_val !== 0 ? Math.max(8, Math.min(Math.abs(F_val) * VS * 0.55, 100)) : 0;
  const F_dir = F_val >= 0 ? 1 : -1;
  return {
    O: { x:Ox, y:Oy }, B, Gp, theta:th, theta_deg, omega, alpha, L, m,
    vectors: {
      aN:     { x1:Gp.x, y1:Gp.y, x2:Gp.x+aN_dx, y2:Gp.y+aN_dy,
                label:`aₙ = ${aN_m.toFixed(2)} m/s²`, layer:'accel',  color:'#e74c3c', marker:'arr-red' },
      aT:     { x1:Gp.x, y1:Gp.y, x2:Gp.x+aT_dx, y2:Gp.y+aT_dy,
                label:`aₜ = ${aT_m.toFixed(2)} m/s²`, layer:'accel',  color:'#3498db', marker:'arr-blue' },
      weight: { x1:Gp.x, y1:Gp.y, x2:Gp.x, y2:Gp.y+W_px,
                label:`mg = ${W_m.toFixed(2)} N`,     layer:'forces', color:'#2ecc71', marker:'arr-green' },
      F:      { x1:B.x,  y1:B.y,  x2:B.x+F_dir*F_len, y2:B.y,
                label:`F = ${F_val.toFixed(2)} N`,    layer:'forces', color:'#f39c12', marker:'arr-orange' },
      FiN:    { x1:Gp.x, y1:Gp.y, x2:Gp.x-aN_dx*.85, y2:Gp.y-aN_dy*.85,
                label:`-maₙ`, layer:'dalembert', color:'#e056a0', marker:'arr-pink', dashed:true },
      FiT:    { x1:Gp.x, y1:Gp.y, x2:Gp.x-aT_dx*.85, y2:Gp.y-aT_dy*.85,
                label:`-maₜ`, layer:'dalembert', color:'#e056a0', marker:'arr-pink', dashed:true },
    },
    equations: {
      aN: aN_m, aT: aT_m, vB: L * Math.abs(omega), F: F_val,
      IG: m*L*L/12, Io: m*L*L/3
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// COLLISION — idéntico a src/render/collision.js
// ═══════════════════════════════════════════════════════════════════
const CANDS = [
  [14,-16],[-58,-16],[14,18],[-58,18],[24,0],[-68,0],[0,-24],[0,24],
  [34,-28],[-72,-28],[34,28],[-72,28],[48,-8],[-82,-8],
];
function colBbox(x,y,text,fs=11){const w=text.length*fs*.58+6,h=fs*1.4;return{x,y:y-h*.85,w,h};}
function colOvlp(a,b,p=4){return!(a.x+a.w+p<b.x||b.x+b.w+p<a.x||a.y+a.h+p<b.y||b.y+b.h+p<a.y);}
function colPlace(anchor,text,placed){
  for(const[dx,dy]of CANDS){const cx=anchor.x+dx,cy=anchor.y+dy,bb=colBbox(cx,cy,text);
    if(!placed.some(p=>colOvlp(bb,p))){placed.push(bb);return{x:cx,y:cy,bbox:bb};}}
  for(let r=25;r<=120;r+=20)for(let a=0;a<360;a+=45){
    const cx=anchor.x+r*Math.cos(a*Math.PI/180),cy=anchor.y+r*Math.sin(a*Math.PI/180);
    const bb=colBbox(cx,cy,text);
    if(!placed.some(p=>colOvlp(bb,p))){placed.push(bb);return{x:cx,y:cy,bbox:bb};}}
  const[dx,dy]=CANDS[0];return{x:anchor.x+dx,y:anchor.y+dy,bbox:colBbox(anchor.x+dx,anchor.y+dy,text)};
}
function colBlock(x,y,w,h,placed){placed.push({x:x-w/2,y:y-h/2,w,h});}

// ═══════════════════════════════════════════════════════════════════
// SVG STRING HELPERS
// ═══════════════════════════════════════════════════════════════════
const a2s = o => Object.entries(o).filter(([,v])=>v!=null).map(([k,v])=>`${k}="${v}"`).join(' ');
const L_  = (x1,y1,x2,y2,a={})  => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${a2s(a)}/>`;
const C_  = (cx,cy,r,a={})       => `<circle cx="${cx}" cy="${cy}" r="${r}" ${a2s(a)}/>`;
const R_  = (x,y,w,h,a={})       => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a2s(a)}/>`;
const T_  = (x,y,c,a={})         => `<text x="${x}" y="${y}" ${a2s(a)}>${c}</text>`;
const P_  = (d,a={})              => `<path d="${d}" ${a2s(a)}/>`;
function ARR(x1,y1,x2,y2,mid,a={}){
  const len=Math.hypot(x2-x1,y2-y1);if(len<3)return'';
  const t=Math.max(0,(len-9)/len);
  return L_(x1,y1,x1+(x2-x1)*t,y1+(y2-y1)*t,{'marker-end':`url(#${mid})`,...a});
}
function ARC(cx,cy,r,a0,a1,ccw,a={}){
  const x1=cx+r*Math.cos(a0),y1=cy-r*Math.sin(a0);
  const x2=cx+r*Math.cos(a1),y2=cy-r*Math.sin(a1);
  const sw=ccw?0:1,lg=Math.abs(a1-a0)>Math.PI?1:0;
  return P_(`M ${x1} ${y1} A ${r} ${r} 0 ${lg} ${sw} ${x2} ${y2}`,a);
}
function MARKER(id,color,size=6){
  const h=size/2;
  return `<marker id="${id}" markerWidth="${size}" markerHeight="${size}" `+
    `refX="${size-1}" refY="${h}" orient="auto" markerUnits="strokeWidth">`+
    `<polygon points="0,0 ${size},${h} 0,${size}" fill="${color}"/></marker>`;
}
const MARKERS_DEF = [
  ['arr-red','#e74c3c'],['arr-blue','#3498db'],['arr-green','#2ecc71'],
  ['arr-orange','#f39c12'],['arr-pink','#e056a0'],['arr-purple','#9b59b6']
].map(([id,c])=>MARKER(id,c)).join('');

// ═══════════════════════════════════════════════════════════════════
// RENDER LAYERS
// ═══════════════════════════════════════════════════════════════════
function rGeometry(d){
  const{O,B,Gp,theta}=d; let s='';
  s+=L_(O.x,O.y,B.x,B.y,{stroke:'#1a2535','stroke-width':12,'stroke-linecap':'round'});
  s+=L_(O.x,O.y,B.x,B.y,{stroke:'#8899aa','stroke-width':3,'stroke-linecap':'round'});
  const ra=44;
  s+=ARC(O.x,O.y,ra,0,theta,true,{fill:'none',stroke:'#2d4a62','stroke-width':1.2,'stroke-dasharray':'3,3'});
  s+=L_(O.x,O.y,O.x+58,O.y,{stroke:'#1e2d3d','stroke-width':1,'stroke-dasharray':'4,3'});
  // ground hatch
  s+=L_(O.x-28,O.y+11,O.x+28,O.y+11,{stroke:'#4a5568','stroke-width':2});
  for(let i=-3;i<=3;i++) s+=L_(O.x+i*9-7,O.y+11,O.x+i*9+5,O.y+22,{stroke:'#2d3748','stroke-width':1.5});
  s+=C_(O.x,O.y,9,{fill:'#141b27',stroke:'#4a6fa0','stroke-width':1.5});
  s+=C_(O.x,O.y,3.5,{fill:'#90cdf4'});
  s+=C_(B.x,B.y,6,{fill:'#0d1117',stroke:'#f6e05e','stroke-width':1.5});
  s+=C_(Gp.x,Gp.y,5.5,{fill:'#0d1117',stroke:'#68d391','stroke-width':1.5});
  s+=L_(Gp.x-6,Gp.y,Gp.x+6,Gp.y,{stroke:'#68d391','stroke-width':1});
  s+=L_(Gp.x,Gp.y-6,Gp.x,Gp.y+6,{stroke:'#68d391','stroke-width':1});
  const tb={fill:'#5a7a8a','font-family':'serif','font-style':'italic','font-size':13};
  s+=T_(O.x-17,O.y-12,'O',tb);
  s+=T_(B.x+10,B.y-8,'B',{...tb,fill:'#f6e05e'});
  s+=T_(Gp.x-18,Gp.y,'G',{...tb,fill:'#68d391'});
  const thM=theta/2;
  s+=T_(O.x+52*Math.cos(thM),O.y-52*Math.sin(thM)+4,'θ',{...tb,'font-size':12,fill:'#2d4a62'});
  return s;
}

function rKinematics(d){
  const{O,theta,omega,alpha}=d; let s='';
  if(Math.abs(omega)>.02){
    s+=ARC(O.x,O.y,32,theta+.15,theta+.7,omega>=0,
      {fill:'none',stroke:'#9b59b6','stroke-width':1.8,'marker-end':'url(#arr-purple)'});
    s+=T_(O.x-24,O.y-50,`ω = ${omega.toFixed(1)} rad/s`,
      {fill:'#9b59b6','font-size':10,'font-family':'sans-serif'});
  }
  if(Math.abs(alpha)>.02)
    s+=T_(O.x+14,O.y-50,`α = ${alpha.toFixed(1)} rad/s²`,
      {fill:'#cd8439','font-size':10,'font-family':'sans-serif'});
  return s;
}

function rVectors(d, keys){
  let s='';
  for(const k of keys){
    const v=d.vectors[k]; if(!v) continue;
    const len=Math.hypot(v.x2-v.x1,v.y2-v.y1); if(len<4) continue;
    const sw=k==='F'?2.8:2.2;
    const extra=v.dashed?{'stroke-dasharray':'6,3'}:{};
    s+=ARR(v.x1,v.y1,v.x2,v.y2,v.marker,{stroke:v.color,'stroke-width':sw,opacity:.92,...extra});
  }
  return s;
}

function rLabels(d, activeLayers){
  let s=''; const placed=[];
  [d.O,d.B,d.Gp].forEach(pt=>colBlock(pt.x,pt.y,22,22,placed));
  for(const v of Object.values(d.vectors)){
    if(!activeLayers.includes(v.layer)) continue;
    const len=Math.hypot(v.x2-v.x1,v.y2-v.y1); if(len<4) continue;
    const{x,y,bbox}=colPlace({x:v.x2,y:v.y2},v.label,placed);
    const w=v.label.length*6.5+8,h=14;
    if(Math.hypot(x-v.x2,y-v.y2)>28)
      s+=L_(v.x2,v.y2,x+w*.2,y,{stroke:v.color,'stroke-width':.5,opacity:.3});
    s+=R_(x-2,y-h*.85,w,h,{rx:2,ry:2,fill:'#080d12',opacity:.75});
    s+=T_(x,y,v.label,{fill:v.color,'font-size':11,'font-family':'monospace','dominant-baseline':'auto'});
  }
  return s;
}

function rEquations(d,px=430,py=30){
  const eq=d.equations; let s='';
  const rows=[
    ['aₙᴳ = (L/2)ω²',   `${eq.aN.toFixed(3)} m/s²`,'#e74c3c'],
    ['aₜᴳ = (L/2)|α|',  `${eq.aT.toFixed(3)} m/s²`,'#3498db'],
    ['|vᴮ| = Lω',        `${eq.vB.toFixed(3)} m/s`, '#68d391'],
    ['F = mgcosθ/2sinθ', '',                         '#f39c12'],
    ['  + mLα/3sinθ',    `${eq.F.toFixed(3)} N`,     '#f6e05e'],
  ];
  s+=R_(px-6,py-14,152,rows.length*22+14,{rx:5,ry:5,fill:'#080d12',stroke:'#1e2d3d','stroke-width':1});
  rows.forEach(([lbl,val,col],i)=>{
    const y=py+i*22;
    s+=T_(px,y,lbl,{fill:'#3d5a6e','font-size':10,'font-family':'monospace'});
    if(val) s+=T_(px+90,y,`= ${val}`,{fill:col,'font-size':10,'font-family':'monospace','font-weight':'bold'});
  });
  return s;
}

// ═══════════════════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════════════════
const PRESETS = {
  pdf:       ['geometry','forces','accel','labels','equations'],
  kinematic: ['geometry','kinematics','labels'],
  dcl:       ['geometry','forces','dalembert','labels','equations'],
  full:      ['geometry','kinematics','forces','accel','dalembert','labels','equations'],
};
const LAYER_ORDER = ['geometry','kinematics','forces','accel','dalembert','labels','equations'];

// ═══════════════════════════════════════════════════════════════════
// CORE RENDER → SVG STRING
// ═══════════════════════════════════════════════════════════════════
function renderSVG(params, preset='pdf', w=600, h=480){
  const active = Array.isArray(preset) ? preset : (PRESETS[preset] ?? PRESETS.pdf);
  const d = physicsCompute(params);
  let body='';
  for(const lay of LAYER_ORDER){
    if(!active.includes(lay)) continue;
    switch(lay){
      case 'geometry':   body+=rGeometry(d);            break;
      case 'kinematics': body+=rKinematics(d);          break;
      case 'forces':     body+=rVectors(d,['weight','F']); break;
      case 'accel':      body+=rVectors(d,['aN','aT']);  break;
      case 'dalembert':  body+=rVectors(d,['FiN','FiT']); break;
      case 'labels':     body+=rLabels(d,active);       break;
      case 'equations':  body+=rEquations(d);           break;
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" `+
    `width="${w}" height="${h}" style="background:#080d12">`+
    `<defs>${MARKERS_DEF}</defs>${body}</svg>`;
}

// PNG export (browser)
async function svgToPng(svgStr, w, h, scale=2){
  const blob = new Blob([svgStr],{type:'image/svg+xml'});
  const url  = URL.createObjectURL(blob);
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = ()=>{
      const cv = document.createElement('canvas');
      cv.width=w*scale; cv.height=h*scale;
      const ctx=cv.getContext('2d');
      ctx.scale(scale,scale);
      ctx.drawImage(img,0,0);
      URL.revokeObjectURL(url);
      res(cv.toDataURL('image/png'));
    };
    img.onerror=rej;
    img.src=url;
  });
}

// ═══════════════════════════════════════════════════════════════════
// WEB COMPONENT: <barra-articulada>
// ═══════════════════════════════════════════════════════════════════
const SLIDER_CONFIG = [
  { attr:'theta', label:'θ (°)',        min:5,  max:85,  step:1,   fmt:v=>`${v}°`         },
  { attr:'omega', label:'ω (rad/s)',    min:0,  max:8,   step:0.1, fmt:v=>v.toFixed(1)    },
  { attr:'alpha', label:'α (rad/s²)',   min:-10,max:10,  step:0.5, fmt:v=>v.toFixed(1)    },
  { attr:'L',     label:'L (m)',        min:0.5,max:2.5, step:0.1, fmt:v=>v.toFixed(1)    },
  { attr:'m',     label:'m (kg)',       min:0.5,max:5,   step:0.5, fmt:v=>v.toFixed(1)    },
];

const COMPONENT_STYLE = `
  :host { display:inline-block; font-family:'Segoe UI',system-ui,sans-serif; }
  .wrap { background:#0a0f18; border:1px solid #1e2d3d; border-radius:8px; overflow:hidden; }
  .diagram-area { display:flex; align-items:center; justify-content:center;
                  background:#080d12; padding:8px; }
  .controls { padding:10px 14px; background:#0f151f; border-top:1px solid #1e2d3d; }
  .preset-row { display:flex; gap:5px; margin-bottom:10px; flex-wrap:wrap; }
  .pbtn { background:#0a0f18; border:1px solid #1e2d3d; color:#4a6075; font-size:.68rem;
          padding:3px 10px; border-radius:3px; cursor:pointer; transition:all .12s; }
  .pbtn:hover { background:#141b27; color:#8ba3b8; }
  .pbtn.on { background:#0e2038; border-color:#2b6cb0; color:#63b3ed; }
  .slider-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; }
  .param { display:flex; flex-direction:column; gap:3px; }
  .param-head { display:flex; justify-content:space-between; }
  .param-name { font-size:.72rem; color:#5a7a8a; }
  .param-val  { font-size:.72rem; color:#90cdf4; font-family:monospace; }
  input[type=range] { width:100%; height:3px; -webkit-appearance:none;
    background:#1e2d3d; border-radius:2px; outline:none; cursor:pointer; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px;
    border-radius:50%; background:#63b3ed; cursor:pointer; }
  .actions { display:flex; gap:6px; margin-top:10px; }
  .abtn { flex:1; background:#0a0f18; border:1px solid #1e2d3d; color:#5a7a8a;
          font-size:.72rem; padding:5px 8px; border-radius:4px; cursor:pointer; transition:all .12s; }
  .abtn:hover { background:#141b27; color:#90cdf4; border-color:#2b6cb0; }
  .eq-strip { display:flex; gap:12px; padding:6px 14px; background:#060b10;
              border-top:1px solid #1a2535; flex-wrap:wrap; }
  .eq-item { font-size:.7rem; font-family:monospace; }
  .eq-label { color:#2d4a62; }
  .eq-value { font-weight:bold; }
`;

class BarraArticulada extends HTMLElement {
  static get observedAttributes(){
    return ['theta','omega','alpha','L','m','preset','interactive','width','height'];
  }

  constructor(){
    super();
    this._shadow = this.attachShadow({mode:'open'});
    this._params = { theta_deg:30, omega:2, alpha:3, L:1, m:1 };
    this._preset = 'pdf';
    this._w = 600; this._h = 480;
    this._raf = false;
    this._interactive = false;
  }

  connectedCallback(){
    this._readAttrs();
    this._build();
    this._render();
  }

  attributeChangedCallback(name, _, val){
    if(!this.isConnected) return;
    this._readAttrs();
    this._schedule();
  }

  _readAttrs(){
    const n = (attr, def) => {
      const v = parseFloat(this.getAttribute(attr));
      return isNaN(v) ? def : v;
    };
    this._params = {
      theta_deg: n('theta',30), omega: n('omega',2),
      alpha:     n('alpha',3),  L:     n('L',1),    m: n('m',1),
    };
    this._preset      = this.getAttribute('preset') || 'pdf';
    this._interactive = this.hasAttribute('interactive');
    this._w           = n('width', 600);
    this._h           = n('height', 480);
  }

  _build(){
    const style = document.createElement('style');
    style.textContent = COMPONENT_STYLE;
    this._shadow.appendChild(style);

    this._root = document.createElement('div');
    this._root.className = 'wrap';

    // Diagram area
    this._diagArea = document.createElement('div');
    this._diagArea.className = 'diagram-area';
    this._root.appendChild(this._diagArea);

    // Equation strip
    this._eqStrip = document.createElement('div');
    this._eqStrip.className = 'eq-strip';
    this._root.appendChild(this._eqStrip);

    // Controls (only if interactive)
    if(this._interactive) this._buildControls();

    this._shadow.appendChild(this._root);
  }

  _buildControls(){
    const ctrl = document.createElement('div');
    ctrl.className = 'controls';

    // Preset buttons
    const presetRow = document.createElement('div');
    presetRow.className = 'preset-row';
    this._presetBtns = {};
    for(const p of Object.keys(PRESETS)){
      const btn = document.createElement('button');
      btn.className = 'pbtn' + (p === this._preset ? ' on' : '');
      btn.textContent = p;
      btn.addEventListener('click', ()=>{
        this._preset = p;
        Object.values(this._presetBtns).forEach(b=>b.classList.remove('on'));
        btn.classList.add('on');
        this._schedule();
      });
      this._presetBtns[p] = btn;
      presetRow.appendChild(btn);
    }
    ctrl.appendChild(presetRow);

    // Sliders
    const grid = document.createElement('div');
    grid.className = 'slider-grid';
    this._sliderEls = {};

    for(const cfg of SLIDER_CONFIG){
      const div  = document.createElement('div');
      div.className = 'param';
      const head = document.createElement('div');
      head.className = 'param-head';
      const nameEl = document.createElement('span');
      nameEl.className = 'param-name';
      nameEl.textContent = cfg.label;
      const valEl = document.createElement('span');
      valEl.className = 'param-val';
      const curVal = cfg.attr === 'theta' ? this._params.theta_deg : this._params[cfg.attr];
      valEl.textContent = cfg.fmt(curVal);
      head.appendChild(nameEl); head.appendChild(valEl);
      const inp = document.createElement('input');
      inp.type='range'; inp.min=cfg.min; inp.max=cfg.max;
      inp.step=cfg.step; inp.value=curVal;
      inp.addEventListener('input', ()=>{
        const v = parseFloat(inp.value);
        valEl.textContent = cfg.fmt(v);
        if(cfg.attr === 'theta') this._params.theta_deg = v;
        else this._params[cfg.attr] = v;
        this._schedule();
      });
      this._sliderEls[cfg.attr] = { inp, valEl, cfg };
      div.appendChild(head); div.appendChild(inp);
      grid.appendChild(div);
    }
    ctrl.appendChild(grid);

    // Action buttons
    const acts = document.createElement('div');
    acts.className = 'actions';

    const btnPng = document.createElement('button');
    btnPng.className = 'abtn';
    btnPng.textContent = '⬇ PNG (2×)';
    btnPng.addEventListener('click', ()=>this._downloadPng());
    acts.appendChild(btnPng);

    const btnSvg = document.createElement('button');
    btnSvg.className = 'abtn';
    btnSvg.textContent = '⬇ SVG';
    btnSvg.addEventListener('click', ()=>this._downloadSvg());
    acts.appendChild(btnSvg);

    const btnCopy = document.createElement('button');
    btnCopy.className = 'abtn';
    btnCopy.textContent = '📋 SVG string';
    btnCopy.addEventListener('click', ()=>this._copySvg(btnCopy));
    acts.appendChild(btnCopy);

    ctrl.appendChild(acts);
    this._root.appendChild(ctrl);
  }

  _render(){
    const svgStr = renderSVG(this._params, this._preset, this._w, this._h);

    // Update diagram
    this._diagArea.innerHTML = svgStr;
    this._currentSvg = svgStr;

    // Update equation strip
    const eq = physicsCompute(this._params).equations;
    const items = [
      { label:'aₙᴳ', value:`${eq.aN.toFixed(3)} m/s²`, color:'#e74c3c' },
      { label:'aₜᴳ', value:`${eq.aT.toFixed(3)} m/s²`, color:'#3498db' },
      { label:'|vᴮ|', value:`${eq.vB.toFixed(3)} m/s`,  color:'#68d391' },
      { label:'F',    value:`${eq.F.toFixed(3)} N`,      color:'#f6e05e' },
    ];
    this._eqStrip.innerHTML = items.map(({label,value,color})=>
      `<div class="eq-item"><span class="eq-label">${label} = </span>`+
      `<span class="eq-value" style="color:${color}">${value}</span></div>`
    ).join('');
  }

  _schedule(){
    if(this._raf) return;
    this._raf = true;
    requestAnimationFrame(()=>{ this._raf=false; this._render(); });
  }

  async _downloadPng(){
    const dataUrl = await svgToPng(this._currentSvg, this._w, this._h, 2);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `barra_th${Math.round(this._params.theta_deg)}_${this._preset}.png`;
    a.click();
  }

  _downloadSvg(){
    const blob = new Blob([this._currentSvg], {type:'image/svg+xml'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `barra_th${Math.round(this._params.theta_deg)}_${this._preset}.svg`;
    a.click();
  }

  async _copySvg(btn){
    await navigator.clipboard.writeText(this._currentSvg);
    const orig = btn.textContent;
    btn.textContent = '✓ Copiado';
    setTimeout(()=>{ btn.textContent = orig; }, 1500);
  }

  // API pública: actualizar parámetros desde JS
  setParams(params){
    Object.assign(this._params, params);
    if(params.theta !== undefined) this._params.theta_deg = params.theta;
    // Sync sliders si existen
    if(this._sliderEls){
      for(const[attr, {inp, valEl, cfg}] of Object.entries(this._sliderEls)){
        const v = attr==='theta' ? this._params.theta_deg : this._params[attr];
        if(v !== undefined){ inp.value=v; valEl.textContent=cfg.fmt(v); }
      }
    }
    this._schedule();
  }

  // Devuelve SVG string actual (para Node.js / PDF pipeline)
  getSVG(){ return renderSVG(this._params, this._preset, this._w, this._h); }

  // Devuelve Promise<dataURL> de PNG
  getPNG(scale=2){ return svgToPng(this.getSVG(), this._w, this._h, scale); }
}

customElements.define('barra-articulada', BarraArticulada);

// También exportar la función de render por si se usa como módulo ES
export { renderSVG, physicsCompute, PRESETS };
