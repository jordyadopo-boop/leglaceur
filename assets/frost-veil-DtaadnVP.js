import{n as e}from"./env-DUSrLxhP.js";import{n as t,r as n,t as r}from"./crystals-CBb9YBhW.js";import{o as i}from"./sprites-CpCcYPrC.js";var a=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define P highp
#else
#define P mediump
#endif
`,o=`${a}
attribute vec2 aPos;
uniform P vec2 uRes;
varying vec2 vUv;
void main() {
  vUv = aPos / uRes;
  gl_Position = vec4(vUv.x * 2.0 - 1.0, 1.0 - vUv.y * 2.0, 0.0, 1.0);
}`,s=`${a}
precision P float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform P vec2 uRes;
uniform float uScale;
uniform float uLevel;
uniform float uTime;
uniform float uDepth;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float cr(vec2 uv) {
  float t = texture2D(uMap, uv).r;
  return smoothstep(t, t + 0.05, uLevel) * (1.0 - step(0.975, t));
}
vec4 over(vec4 top, vec4 base) { return top + base * (1.0 - top.a); }

void main() {
  vec2 css = vUv * uRes / uScale;
  vec2 size = uRes / uScale;
  vec2 e = min(css, size - css);
  float d = min(e.x, e.y);
  float corner = (e.x * e.y) / (e.x + e.y + 1.0);
  float dist = min(d, corner * 1.6);
  float n1 = vnoise(css * 0.016);
  float n2 = vnoise(css * 0.065 + 13.0);
  float n = n1 * 0.65 + n2 * 0.35;

  // Voile : gèle du bord vers l'intérieur, front déchiqueté par le bruit.
  float tH = dist / uDepth * 0.95 + (n - 0.5) * 0.45;
  float haze = smoothstep(tH, tH + 0.2, uLevel * 0.97);
  float edge = 1.0 - smoothstep(0.0, uDepth * 0.6, dist);

  vec2 dd = vec2(1.0) / uRes * max(1.0, uScale);
  float c0 = cr(vUv);
  float cp = cr(vUv + dd);
  float cm = cr(vUv - dd);
  float lit = clamp(cp - cm, 0.0, 1.0);
  float shade = clamp(cm - cp, 0.0, 1.0);

  vec4 col = vec4(0.0);
  float hazeA = haze * (0.07 + 0.34 * edge * edge) * (0.7 + 0.6 * n2);
  col = over(vec4(vec3(0.84, 0.92, 1.0) * hazeA, hazeA), col);

  // Grain de givre (taches de cristaux microscopiques).
  float gr = hash(floor(css * 0.75));
  float g = smoothstep(0.78, 0.98, gr) * haze * (0.18 + 0.4 * edge) * (0.6 + 0.8 * n1);
  col = over(vec4(vec3(0.97, 0.99, 1.0) * g, g), col);

  // Cristaux en relief.
  float body = c0 * (0.3 + 0.22 * edge);
  col = over(vec4(vec3(0.82, 0.92, 1.0) * body, body), col);
  float sh = shade * 0.24;
  col = over(vec4(vec3(0.05, 0.2, 0.48) * sh, sh), col);
  float hi = lit * 0.9;
  col = over(vec4(vec3(1.0) * hi, hi), col);

  // Éclats qui scintillent.
  float sp = hash(floor(css * 0.42) + 7.0);
  float tw = step(0.9965, sp) * haze * (0.5 + 0.5 * sin(uTime * 2.6 + sp * 517.0));
  col = over(vec4(vec3(tw), tw), col);

  gl_FragColor = col * smoothstep(0.0, 0.1, uLevel);
}`,c=(t,n)=>e(Math.min(t,n)*.2,90,200);function l(e,a,o,s){let c=i(e,a),l=c.getContext(`2d`);l.fillStyle=`#fff`,l.fillRect(0,0,e,a);let u=e/o,d=a/o,f=r({w:u,h:d,depth:s,seed:29,spacing:u<600?36:46,step:5.5,maxGen:2,corner:1.25,stars:5,pair:.35});l.setTransform(o,0,0,o,0,0),l.lineCap=`round`;for(let e=63;e>=0;e--){let r=t(f,e/64),i=t(f,(e+1)/64);if(r>=i)continue;let a=Math.round((e+.5)/64*255);l.strokeStyle=`rgb(${a},${a},${a})`,n(l,f,r,i,[1.8,1.2,.85])}return{canvas:c,segs:f}}function u(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(t||`shader`)}return r}function d(t){let n=null;try{n=t.getContext(`webgl`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,powerPreference:`low-power`})}catch{n=null}if(n){let e=n.getExtension(`WEBGL_debug_renderer_info`),r=e?String(n.getParameter(e.UNMASKED_RENDERER_WEBGL)):``;if(/swiftshader|llvmpipe|software|softpipe/i.test(r)){n.getExtension(`WEBGL_lose_context`)?.loseContext();let e=t.cloneNode(!1);return t.replaceWith(e),f(e)}}if(!n)return f(t);let r,i,a,d={},p=0,m=0,h=1,g=200,_=0,v=0,y=0,b=!1,x=!1,S=1;function C(){if(r=n.createProgram(),n.attachShader(r,u(n,n.VERTEX_SHADER,o)),n.attachShader(r,u(n,n.FRAGMENT_SHADER,s)),n.linkProgram(r),!n.getProgramParameter(r,n.LINK_STATUS))throw Error(n.getProgramInfoLog(r)||`link`);n.useProgram(r),d={aPos:n.getAttribLocation(r,`aPos`),uRes:n.getUniformLocation(r,`uRes`),uScale:n.getUniformLocation(r,`uScale`),uLevel:n.getUniformLocation(r,`uLevel`),uTime:n.getUniformLocation(r,`uTime`),uDepth:n.getUniformLocation(r,`uDepth`),uMap:n.getUniformLocation(r,`uMap`)},i=n.createBuffer(),a=n.createTexture(),n.bindTexture(n.TEXTURE_2D,a),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE),n.enable(n.BLEND),n.blendFunc(n.ONE,n.ONE_MINUS_SRC_ALPHA),_=0,v=0}function w(){let e=Math.min(g*1.35*h,p/2,m/2),t=[[0,0,p,e],[0,m-e,p,m],[0,e,e,m-e],[p-e,e,p,m-e]],r=[];for(let[e,n,i,a]of t)r.push(e,n,i,n,e,a,e,a,i,n,i,a);n.bindBuffer(n.ARRAY_BUFFER,i),n.bufferData(n.ARRAY_BUFFER,new Float32Array(r),n.STATIC_DRAW),n.enableVertexAttribArray(d.aPos),n.vertexAttribPointer(d.aPos,2,n.FLOAT,!1,0,0),y=r.length/2}function T(){let e=innerWidth,r=innerHeight,i=Math.min(window.devicePixelRatio||1,e>1680?1:1.25);if(h=i*S,p=Math.round(e*h),m=Math.round(r*h),t.width=p,t.height=m,g=c(e,r),b)return;n.viewport(0,0,p,m);let o=Math.round(e*i),s=Math.round(r*i);if(!_||Math.abs(o-_)/_>.12||Math.abs(s-v)/v>.12){let{canvas:e}=l(o,s,i,g);n.bindTexture(n.TEXTURE_2D,a),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.texImage2D(n.TEXTURE_2D,0,n.RGBA,n.RGBA,n.UNSIGNED_BYTE,e),_=o,v=s}w()}t.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),b=!0}),t.addEventListener(`webglcontextrestored`,()=>{b=!1;try{C(),T()}catch{}});try{C(),T()}catch{let e=t.cloneNode(!1);return t.replaceWith(e),f(e)}return{kind:`webgl`,resize:T,setQuality(t){S=e(t,.3,1),T()},get quality(){return S},render(e,r){let i=e>.004&&!b;i!==x&&(x=i,t.style.visibility=i?`visible`:`hidden`,i||(n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT))),i&&(n.clearColor(0,0,0,0),n.clear(n.COLOR_BUFFER_BIT),n.uniform2f(d.uRes,p,m),n.uniform1f(d.uScale,h),n.uniform1f(d.uLevel,e),n.uniform1f(d.uTime,r),n.uniform1f(d.uDepth,g),n.uniform1i(d.uMap,0),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,a),n.drawArrays(n.TRIANGLES,0,y))},destroy(){n.getExtension(`WEBGL_lose_context`)?.loseContext()}}}function f(e){let i=e.getContext(`2d`);if(!i)return null;let a=!1;function o(){let a=innerWidth,o=innerHeight;e.width=a,e.height=o;let s=c(a,o),l=r({w:a,h:o,depth:s,seed:29,spacing:50,step:6,maxGen:1,corner:1.25}),u=t(l,.8),d=i.createRadialGradient(a/2,o/2,Math.min(a,o)*.25,a/2,o/2,Math.hypot(a,o)/2);d.addColorStop(0,`rgba(227,243,255,0)`),d.addColorStop(1,`rgba(227,243,255,0.55)`),i.fillStyle=d,i.fillRect(0,0,a,o),i.lineCap=`round`,n(i,l,0,u,[1.8,1.2,.85],()=>`rgba(10,40,90,0.25)`,.8,.8),n(i,l,0,u,[1.8,1.2,.85],()=>`rgba(255,255,255,0.85)`)}return o(),{kind:`2d`,resize:o,render(t){let n=t>.01;n!==a&&(a=n,e.style.visibility=n?`visible`:`hidden`),n&&(e.style.opacity=String(Math.min(1,t*1.15)))},destroy(){}}}export{d as createVeil,f as createVeil2D};