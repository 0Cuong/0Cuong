(() => {
  "use strict";
  const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches??false;
  const coarse=window.matchMedia?.("(pointer: coarse)")?.matches??false;
  const compact=Math.min(innerWidth,innerHeight)<760;

  const solar=document.createElement("canvas"), fx=document.createElement("canvas"), particles=document.createElement("canvas");
  solar.id="solar-v9";fx.id="solar-v9-effects";particles.id="solar-v9-particles";
  [solar,fx,particles].forEach(e=>{e.setAttribute("aria-hidden","true");document.body.appendChild(e);});
  const gl=solar.getContext("webgl2",{alpha:true,antialias:true,powerPreference:"high-performance"})||
            solar.getContext("webgl",{alpha:true,antialias:true,powerPreference:"high-performance"});
  if(!gl)return;
  const fctx=fx.getContext("2d",{alpha:true}), pctx=particles.getContext("2d",{alpha:true});

  const hud=document.createElement("div");hud.className="solar-v9__hud";
  hud.innerHTML=[
    '<button class="solar-v9__button" type="button" data-solar="prev" aria-label="Lùi thời gian">‹</button>',
    '<button class="solar-v9__button" type="button" data-solar="pause" aria-label="Tạm dừng">Ⅱ</button>',
    '<div class="solar-v9__readout">SYSTEM · 50×</div>',
    '<button class="solar-v9__button" type="button" data-solar="next" aria-label="Tăng tốc">›</button>',
    '<button class="solar-v9__button" type="button" data-solar="reset" aria-label="Đặt lại camera">⌖</button>'
  ].join("");document.body.appendChild(hud);
  const status=document.createElement("div");status.className="solar-v9__status";
  status.innerHTML="<strong>SOLAR SYSTEM</strong><span>OBSERVATORY MODE · PROCEDURAL PLANETARY RENDERER</span>";document.body.appendChild(status);
  const hint=document.createElement("div");hint.className="solar-v9__hint";hint.textContent=coarse?"Kéo xoay · chụm zoom":"Drag orbit · wheel zoom";document.body.appendChild(hint);

  const state={
    intro:true,portrait:false,previousStage:"",
    width:1,height:1,dpr:1,
    yaw:.68,pitch:.48,distance:7.5,targetYaw:.68,targetPitch:.48,targetDistance:7.5,
    dragging:false,pointers:new Map(),pinch:0,
    paused:reduced,speedIndex:1,simTime:0,last:performance.now(),pulse:0,portraitStarted:0,portrait:null,portraitExitTimer:null
  };
  const speeds=[0,1,50,500,5000], speedNames=["STOP","1×","50×","500×","5000×"];
  const planets=[
    {name:"Mercury",a:.55,e:.10,r:.034,period:87.97,type:0,c:[.54,.50,.46]},
    {name:"Venus",a:.78,e:.03,r:.062,period:224.70,type:1,c:[.80,.64,.35]},
    {name:"Earth",a:1,e:.02,r:.068,period:365.25,type:2,c:[.20,.45,.78]},
    {name:"Mars",a:1.25,e:.09,r:.048,period:686.98,type:3,c:[.65,.24,.13]},
    {name:"Jupiter",a:1.86,e:.05,r:.19,period:4332.59,type:4,c:[.78,.61,.45]},
    {name:"Saturn",a:2.35,e:.06,r:.16,period:10759.2,type:5,c:[.82,.69,.47]},
    {name:"Uranus",a:2.85,e:.05,r:.11,period:30688.5,type:6,c:[.43,.75,.79]},
    {name:"Neptune",a:3.35,e:.01,r:.108,period:60182,type:7,c:[.15,.32,.82]}
  ];

  const resize=()=>{
    state.width=innerWidth;state.height=innerHeight;state.dpr=Math.min(devicePixelRatio||1,compact?1.35:2);
    for(const c of [solar,fx,particles]){c.width=Math.floor(state.width*state.dpr);c.height=Math.floor(state.height*state.dpr);c.style.width="100%";c.style.height="100%";}
    gl.viewport(0,0,solar.width,solar.height);
  };addEventListener("resize",resize,{passive:true});resize();

  const M={
    I:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
    mul:(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;},
    tr:(x,y,z)=>{const o=M.I();o[12]=x;o[13]=y;o[14]=z;return o;},
    sc:(x,y,z)=>{const o=M.I();o[0]=x;o[5]=y;o[10]=z;return o;},
    persp:(f,a,n,far)=>{const q=1/Math.tan(f/2),nf=1/(n-far),o=M.I();o[0]=q/a;o[5]=q;o[10]=(far+n)*nf;o[11]=-1;o[14]=2*far*n*nf;o[15]=0;return o;},
    look:(e,t,u)=>{
      let zx=e[0]-t[0],zy=e[1]-t[1],zz=e[2]-t[2],l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
      let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
      const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx,o=M.I();
      o[0]=xx;o[1]=yx;o[2]=zx;o[4]=xy;o[5]=yy;o[6]=zy;o[8]=xz;o[9]=yz;o[10]=zz;
      o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]);o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);return o;
    }
  };

  const sphere=(()=>{const p=[],n=[],u=[],i=[],S=36,R=18;
    for(let y=0;y<=R;y++){const v=y/R,ph=v*Math.PI,sp=Math.sin(ph),cp=Math.cos(ph);
      for(let x=0;x<=S;x++){const q=x/S,th=q*TAU,st=Math.sin(th),ct=Math.cos(th),X=sp*ct,Y=cp,Z=sp*st;p.push(X,Y,Z);n.push(X,Y,Z);u.push(q,v);}
    }
    for(let y=0;y<R;y++)for(let x=0;x<S;x++){const a=y*(S+1)+x,b=a+1,c=a+S+1,d=c+1;i.push(a,c,b,b,c,d);}
    return {p:new Float32Array(p),n:new Float32Array(n),u:new Float32Array(u),i:new Uint16Array(i)};
  })();

  const makeStars=()=>{
    const n=compact?2600:6000,p=new Float32Array(n*3),s=new Float32Array(n),t=new Float32Array(n);
    for(let i=0;i<n;i++){const r=12+Math.random()*24,th=Math.random()*TAU,ph=Math.acos(2*Math.random()-1);
      p[i*3]=Math.sin(ph)*Math.cos(th)*r;p[i*3+1]=Math.cos(ph)*r;p[i*3+2]=Math.sin(ph)*Math.sin(th)*r;s[i]=.45+Math.random()*2.4;t[i]=Math.random();}
    return {p,s,t,n};
  };
  const stars=makeStars();
  const dust=(()=>{const n=compact?1400:3200,p=new Float32Array(n*3),s=new Float32Array(n),t=new Float32Array(n);
    for(let i=0;i<n;i++){const r=3.55+Math.random()*2.35,a=Math.random()*TAU;p[i*3]=Math.cos(a)*r;p[i*3+1]=(Math.random()-.5)*.24;p[i*3+2]=Math.sin(a)*r;s[i]=.35+Math.random()*1.75;t[i]=Math.random();}return {p,s,t,n};})();

  const VS_S="attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUv;uniform mat4 uMvp;uniform mat4 uModel;varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUv;void main(){vec4 w=uModel*vec4(aPosition,1.0);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);vUv=aUv;gl_Position=uMvp*vec4(aPosition,1.0);}";
  const FS_S="precision highp float;varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUv;uniform vec3 uColor;uniform vec3 uLightDir;uniform float uType;uniform float uTime;uniform float uSun;float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float n=mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);return n;}float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p*=2.02;a*=.5;}return v;}void main(){vec3 N=normalize(vNormal),L=normalize(uLightDir);float ndl=max(dot(N,L),0.),rim=pow(1.-max(dot(N,vec3(0,0,1)),0.),2.4),n=fbm(N*5.2+uTime*.012),atmosphere=0.;vec3 b=uColor;if(uType<.5){b*=.72+.45*n;b*=1.-smoothstep(.42,.72,fbm(N*18.))*.28;}else if(uType<1.5){b=mix(b*.72,vec3(1,.82,.57),fbm(N*7.+vec3(0,uTime*.02,0))*.35);}else if(uType<2.5){float land=fbm(N*7.+vec3(4,0,2)),cloud=smoothstep(.68,.82,fbm(N*12.-uTime*.025));float ice=smoothstep(.68,.96,abs(N.y));b=mix(vec3(.022,.10,.30),vec3(.09,.34,.12),smoothstep(.48,.63,land));b=mix(b,vec3(.82,.88,.92),cloud*.34);b=mix(b,vec3(.84,.90,1.),ice*.20);atmosphere=pow(1.-max(dot(N,L),0.),2.9)*(1.-.24*cloud);}else if(uType<3.5){b=mix(vec3(.34,.10,.055),vec3(.78,.31,.16),.42+fbm(N*9.)*.28);b=mix(b,vec3(.8,.72,.62),smoothstep(.82,.98,abs(N.y))*.7);}else if(uType<4.5){float band=.5+.5*sin(vUv.y*94.2+n*4.),storm=smoothstep(.75,.95,fbm(N*10.+vec3(2,4,uTime*.015)));float spot=1.-smoothstep(.035,.13,length(vec2((vUv.x-.69)*2.1,(vUv.y-.52)*3.2)));b=mix(vec3(.72,.43,.26),vec3(.92,.84,.65),band);b=mix(b,vec3(.52,.16,.08),storm*.38);b=mix(b,vec3(.72,.38,.19),spot*.72);}else if(uType<5.5){float band=.5+.5*sin(vUv.y*88.+n*3.);b=mix(vec3(.58,.42,.26),vec3(.92,.80,.59),band*.65+.2);}else if(uType<6.5){b=mix(vec3(.24,.58,.66),vec3(.66,.84,.84),(.5+.5*sin(vUv.y*50.+n*2.))*.18+.1);}else{b=mix(vec3(.06,.16,.58),vec3(.15,.42,.88),(.5+.5*sin(vUv.y*69.+n*3.))*.25+.08);}vec3 c=b*(.10+ndl*.88)+b*rim*.12;if(uType>=2.&&uType<2.5)c+=vec3(.18,.45,1.)*atmosphere*.55;if(uSun>.5){c=vec3(1,.25,.03)*(.72+.14*sin(uTime*.7+n*13.)+n*.28);}gl_FragColor=vec4(c,1.);}";
  const VS_P="attribute vec3 aPosition;attribute float aSize;attribute float aTint;uniform mat4 uVp;uniform float uTime;uniform float uMode;varying float vTint;void main(){vec3 p=aPosition;if(uMode>.5){float a=uTime*(.018+.010*aTint);float c=cos(a),s=sin(a),x=p.x*c-p.z*s;p.z=p.x*s+p.z*c;p.x=x;p.xz*=1.+.018*sin(uTime*.73+aTint*31.);}gl_Position=uVp*vec4(p,1.);gl_PointSize=min(4.5,aSize*(1.+.25*sin(uTime*.4+aTint*12.)));vTint=aTint;}";
  const FS_P="precision highp float;varying float vTint;void main(){vec2 p=gl_PointCoord*2.-1.;float a=smoothstep(1.,0.,dot(p,p));vec3 c=mix(vec3(.44,.56,.74),vec3(1.),vTint);gl_FragColor=vec4(c,a*.68);}";
  const VS_R="attribute vec3 aPosition;uniform mat4 uMvp;varying float vR;void main(){vR=aPosition.x;gl_Position=uMvp*vec4(aPosition,1.);}";
  const FS_R="precision highp float;varying float vR;void main(){float p=abs(fract((vR-.2)*34.)-.5);float b=smoothstep(.48,.18,p);vec3 c=mix(vec3(.22,.20,.16),vec3(.78,.69,.53),b);gl_FragColor=vec4(c,.58*b);}";

  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||"shader");return s;};
  const link=(a,b)=>{const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,a));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,b));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||"link");return p;};
  let ps,pp,pr;try{ps=link(VS_S,FS_S);pp=link(VS_P,FS_P);pr=link(VS_R,FS_R);}catch{return;}

  const B={p:gl.createBuffer(),n:gl.createBuffer(),u:gl.createBuffer(),i:gl.createBuffer()};
  gl.bindBuffer(gl.ARRAY_BUFFER,B.p);gl.bufferData(gl.ARRAY_BUFFER,sphere.p,gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,B.n);gl.bufferData(gl.ARRAY_BUFFER,sphere.n,gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,B.u);gl.bufferData(gl.ARRAY_BUFFER,sphere.u,gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,B.i);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,sphere.i,gl.STATIC_DRAW);
  const PB=(a)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);return b;};
  const SB=PB(stars.p),SS=PB(stars.s),ST=PB(stars.t),DB=PB(dust.p),DS=PB(dust.s),DT=PB(dust.t);
  const ring=[];for(let i=0;i<=240;i++){const a=i/240*TAU;for(const r of [.20,.25,.30,.35,.40,.45,.50])ring.push(Math.cos(a)*r,0,Math.sin(a)*r);}
  const RB=PB(new Float32Array(ring));

  const L={
    s:{p:gl.getAttribLocation(ps,"aPosition"),n:gl.getAttribLocation(ps,"aNormal"),u:gl.getAttribLocation(ps,"aUv"),m:gl.getUniformLocation(ps,"uMvp"),mo:gl.getUniformLocation(ps,"uModel"),c:gl.getUniformLocation(ps,"uColor"),l:gl.getUniformLocation(ps,"uLightDir"),t:gl.getUniformLocation(ps,"uType"),tm:gl.getUniformLocation(ps,"uTime"),sun:gl.getUniformLocation(ps,"uSun")},
    p:{p:gl.getAttribLocation(pp,"aPosition"),s:gl.getAttribLocation(pp,"aSize"),t:gl.getAttribLocation(pp,"aTint"),vp:gl.getUniformLocation(pp,"uVp"),tm:gl.getUniformLocation(pp,"uTime"),mode:gl.getUniformLocation(pp,"uMode")},
    r:{p:gl.getAttribLocation(pr,"aPosition"),m:gl.getUniformLocation(pr,"uMvp")}
  };

  const orbit=(p,t)=>{const m=t/p.period*TAU,e=p.e;let E=m;for(let i=0;i<3;i++)E-=((E-e*Math.sin(E))-m)/(1-e*Math.cos(E));return [p.a*(Math.cos(E)-e),0,p.a*Math.sqrt(1-e*e)*Math.sin(E)];};
  const moonOrbit=(earth,t)=>{const a=t/27.3217*TAU;return [earth[0]+Math.cos(a)*.19,.018*Math.sin(a*1.7),earth[2]+Math.sin(a)*.19];};
  const camera=()=>{const cp=Math.cos(state.pitch),sp=Math.sin(state.pitch),cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),eye=[state.distance*cp*sy,state.distance*sp,state.distance*cp*cy];return {view:M.look(eye,[0,0,0],[0,1,0]),proj:M.persp(Math.PI/3,state.width/Math.max(1,state.height),.05,50),eye};};
  const point=(p,v,prj)=>{const x=v[0]*p[0]+v[4]*p[1]+v[8]*p[2]+v[12],y=v[1]*p[0]+v[5]*p[1]+v[9]*p[2]+v[13],z=v[2]*p[0]+v[6]*p[1]+v[10]*p[2]+v[14],w=v[3]*p[0]+v[7]*p[1]+v[11]*p[2]+v[15];const X=prj[0]*x+prj[4]*y+prj[8]*z+prj[12]*w,Y=prj[1]*x+prj[5]*y+prj[9]*z+prj[13]*w,W=prj[3]*x+prj[7]*y+prj[11]*z+prj[15]*w;return [state.width*(X/W+1)/2,state.height*(1-Y/W)/2,W>0?z:2];};

  const points=(bp,bs,bt,n,vp,t,mode=0)=>{
    gl.useProgram(pp);gl.bindBuffer(gl.ARRAY_BUFFER,bp);gl.enableVertexAttribArray(L.p.p);gl.vertexAttribPointer(L.p.p,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,bs);gl.enableVertexAttribArray(L.p.s);gl.vertexAttribPointer(L.p.s,1,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,bt);gl.enableVertexAttribArray(L.p.t);gl.vertexAttribPointer(L.p.t,1,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(L.p.vp,false,vp);gl.uniform1f(L.p.tm,t);gl.uniform1f(L.p.mode,mode);gl.drawArrays(gl.POINTS,0,n);
  };
  const sphereDraw=(p,pos,r,t)=>{
    gl.useProgram(ps);gl.bindBuffer(gl.ARRAY_BUFFER,B.p);gl.enableVertexAttribArray(L.s.p);gl.vertexAttribPointer(L.s.p,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,B.n);gl.enableVertexAttribArray(L.s.n);gl.vertexAttribPointer(L.s.n,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,B.u);gl.enableVertexAttribArray(L.s.u);gl.vertexAttribPointer(L.s.u,2,gl.FLOAT,false,0,0);
    const model=M.mul(M.tr(pos[0],pos[1],pos[2]),M.sc(r,r,r)),mvp=M.mul(M.mul(t.proj,t.view),model);
    gl.uniformMatrix4fv(L.s.m,false,mvp);gl.uniformMatrix4fv(L.s.mo,false,model);gl.uniform3fv(L.s.c,new Float32Array(p.c||[1,1,1]));
    gl.uniform3f(L.s.l,-pos[0],.12,-pos[2]);gl.uniform1f(L.s.t,p.type??0);gl.uniform1f(L.s.tm,performance.now()*.001);gl.uniform1f(L.s.sun,p.name==="Sun"?1:0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,B.i);gl.drawElements(gl.TRIANGLES,sphere.i.length,gl.UNSIGNED_SHORT,0);
  };
  const rings=(pos,t)=>{
    gl.useProgram(pr);gl.bindBuffer(gl.ARRAY_BUFFER,RB);gl.enableVertexAttribArray(L.r.p);gl.vertexAttribPointer(L.r.p,3,gl.FLOAT,false,0,0);
    const model=M.mul(M.tr(pos[0],pos[1],pos[2]),M.sc(1,1,.72)),mvp=M.mul(M.mul(t.proj,t.view),model);gl.uniformMatrix4fv(L.r.m,false,mvp);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);for(let j=0;j<7;j++)gl.drawArrays(gl.LINE_STRIP,j*241,241);gl.disable(gl.BLEND);
  };

  const sync=()=>{
    const intro=!!document.querySelector(".intro-hero"),portrait=!!document.querySelector(".portrait-reveal");
    state.intro=intro;state.portrait=portrait;
    solar.classList.toggle("is-active",!intro);solar.classList.toggle("is-interactive",!intro&&!portrait);
    fx.classList.toggle("is-active",!intro&&!portrait);particles.classList.toggle("is-active",!intro&&portrait);
    hud.classList.toggle("is-visible",!intro&&!portrait);status.classList.toggle("is-visible",!intro&&!portrait);hint.classList.toggle("is-visible",!intro&&!portrait&&!coarse);
    const stage=portrait?"PORTRAIT":intro?"INTRO":"SYSTEM";
    if(stage!==state.previousStage){
      state.previousStage=stage;
      if(state.portraitExitTimer){clearTimeout(state.portraitExitTimer);state.portraitExitTimer=null;}
      const reveal=document.querySelector(".portrait-reveal");
      if(!portrait && reveal) reveal.classList.remove("solar-v9__portrait-exit");
      if(portrait){
        state.portraitStarted=performance.now();
        if(reveal) reveal.classList.remove("solar-v9__portrait-exit");
        makePortrait().catch(()=>{});
        state.portraitExitTimer=setTimeout(()=>{
          const current=document.querySelector(".portrait-reveal");
          if(state.portrait && current) current.classList.add("solar-v9__portrait-exit");
        },1250);
      }
    }
    updateUI();
  };
  const updateUI=()=>{const e=hud.querySelector(".solar-v9__readout");if(e)e.textContent=state.portrait?"PORTRAIT":"SYSTEM · "+(state.paused?"PAUSE":speedNames[state.speedIndex]);};

  hud.addEventListener("click",e=>{const b=e.target.closest("[data-solar]");if(!b)return;const a=b.dataset.solar;
    if(a==="prev")state.simTime=Math.max(0,state.simTime-90);
    if(a==="next"){state.speedIndex=(state.speedIndex+1)%speeds.length;updateUI();}
    if(a==="pause"){state.paused=!state.paused;updateUI();}
    if(a==="reset"){state.targetYaw=.68;state.targetPitch=.48;state.targetDistance=7.5;}
  });

  const xy=e=>[e.clientX,e.clientY];
  solar.addEventListener("pointerdown",e=>{if(state.intro||state.portrait)return;solar.setPointerCapture?.(e.pointerId);state.pointers.set(e.pointerId,xy(e));state.dragging=state.pointers.size===1;
    if(state.pointers.size===2){const a=[...state.pointers.values()];state.pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);}solar.classList.toggle("is-dragging",state.dragging);});
  solar.addEventListener("pointermove",e=>{if(state.intro||state.portrait||!state.pointers.has(e.pointerId))return;const old=state.pointers.get(e.pointerId),cur=xy(e);state.pointers.set(e.pointerId,cur);
    if(state.pointers.size===1){state.targetYaw-=(cur[0]-old[0])*.004;state.targetPitch=clamp(state.targetPitch+(cur[1]-old[1])*.003,-1.15,1.15);}
    else{const a=[...state.pointers.values()],d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(state.pinch>0)state.targetDistance=clamp(state.targetDistance*(state.pinch/d),1.35,24);state.pinch=d;}});
  const release=e=>{state.pointers.delete(e.pointerId);if(state.pointers.size<2)state.pinch=0;state.dragging=state.pointers.size===1;solar.classList.toggle("is-dragging",state.dragging);};
  solar.addEventListener("pointerup",release);solar.addEventListener("pointercancel",release);
  solar.addEventListener("wheel",e=>{if(state.intro||state.portrait)return;e.preventDefault();state.targetDistance=clamp(state.targetDistance*Math.exp(e.deltaY*.0011),1.35,24);},{passive:false});

  const makePortrait=async()=>{
    const img=new Image();img.decoding="async";img.src="./portrait/girlfriend.jpg";try{await img.decode();}catch{await new Promise((r,j)=>{img.onload=r;img.onerror=j;});}
    const w=compact?110:160,h=Math.max(140,Math.round(w*img.naturalHeight/Math.max(img.naturalWidth,1))),off=document.createElement("canvas");off.width=w;off.height=h;
    const c=off.getContext("2d",{willReadFrequently:true});if(!c)return;const sc=Math.max(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*sc,dh=img.naturalHeight*sc;c.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
    const px=c.getImageData(0,0,w,h).data,g=new Float32Array(w*h),weights=new Float32Array(w*h);let total=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4;g[y*w+x]=(px[k]*.299+px[k+1]*.587+px[k+2]*.114)/255;}
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,edge=Math.abs(g[i-1]-g[i+1])+Math.abs(g[i-w]-g[i+w]);weights[i]=.18+Math.pow(1-g[i],1.35)*.58+edge*.85;total+=weights[i];}
    const count=compact?8200:14000,target=new Array(count);
    for(let i=0;i<count;i++){let r=Math.random()*total,pick=0;while(r>weights[pick]&&pick<weights.length-1){r-=weights[pick];pick++;}const x=pick%w,y=Math.floor(pick/w),nx=x/(w-1)*2-1,ny=y/(h-1)*2-1,k=pick*4;target[i]={x:nx*(w<h?.55:.78),y:ny*(w<h?.78:.55),r:px[k],g:px[k+1],b:px[k+2],z:Math.random(),a:.45+Math.random()*.55};}
    state.portrait={target,count};
  };
  const drawPortrait=(now)=>{
    if(!pctx||!state.portrait)return;pctx.setTransform(state.dpr,0,0,state.dpr,0,0);pctx.clearRect(0,0,state.width,state.height);pctx.globalCompositeOperation="lighter";
    const a=clamp((now-state.portraitStarted)/2400,0,1),e=a*a*(3-2*a),scale=.33+.05*Math.sin(now*.001);
    for(let i=0;i<state.portrait.count;i++){const q=state.portrait.target[i],x=state.width*.5+(q.x+Math.sin(now*.0014+i)*.004)*Math.min(state.width,state.height)*scale,y=state.height*.49+(q.y+Math.cos(now*.0011+i*.7)*.004)*Math.min(state.width,state.height)*scale,s=.55+q.z*1.9;pctx.fillStyle="rgba("+q.r+","+q.g+","+q.b+","+(a*(.22+q.a*.62))+")";pctx.fillRect(x,y,s*(1-e*.18),s*(1-e*.18));}
    pctx.globalCompositeOperation="source-over";const gr=pctx.createRadialGradient(state.width*.5,state.height*.49,0,state.width*.5,state.height*.49,Math.min(state.width,state.height)*.38);gr.addColorStop(0,"rgba(255,220,180,.08)");gr.addColorStop(1,"rgba(255,190,120,0)");pctx.fillStyle=gr;pctx.fillRect(0,0,state.width,state.height);
  };

  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
  const draw=now=>{
    const dt=Math.min(.04,Math.max(.001,(now-state.last)/1000));state.last=now;
    if(!state.intro&&!state.portrait&&!state.paused)state.simTime+=dt*speeds[state.speedIndex]*.07;
    state.yaw=lerp(state.yaw,state.targetYaw,1-Math.exp(-6*dt));state.pitch=lerp(state.pitch,state.targetPitch,1-Math.exp(-6*dt));state.distance=lerp(state.distance,state.targetDistance,1-Math.exp(-6*dt));
    if(state.intro){requestAnimationFrame(draw);return;}
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const t=camera(),vp=M.mul(t.proj,t.view);
    points(SB,SS,ST,stars.n,vp,now*.001,0);sphereDraw({name:"Sun",type:0,c:[1,1,1]},[0,0,0],.43,t);
    for(let i=0;i<planets.length;i++){const p=planets[i],pos=orbit(p,state.simTime);sphereDraw(p,pos,p.r,t);if(i===5)rings(pos,t);}
    const earth=orbit(planets[2],state.simTime);sphereDraw({name:"Moon",type:0,c:[.62,.61,.59]},moonOrbit(earth,state.simTime),.021,t);
    points(DB,DS,DT,dust.n,vp,now*.001,1);
    if(fctx){
      fctx.setTransform(state.dpr,0,0,state.dpr,0,0);fctx.clearRect(0,0,state.width,state.height);
      fctx.save();fctx.globalCompositeOperation="screen";
      for(const p of planets){fctx.beginPath();for(let q=0;q<=180;q++){const a=q/180*TAU,e=p.e,x=p.a*(Math.cos(a)-e),z=p.a*Math.sqrt(1-e*e)*Math.sin(a),s=point([x,0,z],t.view,t.proj);if(q===0)fctx.moveTo(s[0],s[1]);else fctx.lineTo(s[0],s[1]);}fctx.strokeStyle="rgba(170,190,220,.085)";fctx.lineWidth=.7;fctx.stroke();}
      fctx.restore();
      const s=point([0,0,0],t.view,t.proj),gr=fctx.createRadialGradient(s[0],s[1],0,s[0],s[1],Math.min(state.width,state.height)*.22);gr.addColorStop(0,"rgba(255,255,230,.30)");gr.addColorStop(.14,"rgba(255,196,95,.15)");gr.addColorStop(.48,"rgba(255,130,30,.05)");gr.addColorStop(1,"rgba(255,80,20,0)");fctx.fillStyle=gr;fctx.fillRect(0,0,state.width,state.height);
      if(!compact){fctx.font="500 8px ui-monospace,SFMono-Regular,Menlo,monospace";for(const p of planets){const sp=point(orbit(p,state.simTime),t.view,t.proj);if(sp[2]<1) {fctx.fillStyle="rgba(255,255,255,.22)";fctx.fillText(p.name.toUpperCase(),sp[0]+8,sp[1]-7);}}}
    }
    drawPortrait(now);syncStage();requestAnimationFrame(draw);
  };
  let syncAt=0;
  const syncStage=()=>{
    if(performance.now()-syncAt<180)return;
    syncAt=performance.now();
    sync();
  };
  syncStage();new MutationObserver(syncStage).observe(document.body,{childList:true,subtree:true});setInterval(syncStage,700);
  requestAnimationFrame(draw);
})();