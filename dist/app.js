"use strict";(()=>{var M=t=>t&32768?(t&65535)-65536:t&65535,l=(t,e=4)=>(t>>>0).toString(16).toUpperCase().padStart(e,"0"),X=["AND","OR","ADD","XOR","SUB","SLL","SLT","NOR"];function qt(t,e,r){t&=65535,e&=65535;let n=0,s=!1,c=!1;switch(r&7){case 0:n=t&e;break;case 1:n=t|e;break;case 2:{let f=t+e;n=f&65535,c=f>65535,s=((t^e)&32768)===0&&((t^n)&32768)!==0;break}case 3:n=t^e;break;case 4:{let f=t+(~e&65535)+1;n=f&65535,c=f>65535,s=((t^e)&32768)!==0&&((t^n)&32768)!==0;break}case 5:n=t<<(e&15)&65535;break;case 6:n=M(t)<M(e)?1:0;break;default:n=~(t|e)&65535}return{r:n,zero:n===0,ovf:s,cout:c}}var O={add:{funct:32,ctl:2},sub:{funct:34,ctl:4},and:{funct:36,ctl:0},or:{funct:37,ctl:1},xor:{funct:38,ctl:3},nor:{funct:39,ctl:7},slt:{funct:42,ctl:6}};function Z(t){for(let e of Object.keys(O))if(O[e].funct===t)return e;return null}function Dt(t,e){let r=Z(e);return r?{ctl:O[r].ctl,regWrite:t===0}:{ctl:2,regWrite:!1}}function J(t){return{op:t>>>26&63,rs:t>>>21&31,rt:t>>>16&31,rd:t>>>11&31,shamt:t>>>6&31,funct:t&63}}function _(t,e){let r=t.slice(0,16);for(;r.length<16;)r.push(0);let n=e.slice(0,32).map(s=>s&65535);for(;n.length<32;)n.push(0);return n[0]=0,{pc:0,regs:n.slice(),rom:r.map(s=>s>>>0),inicial:n}}function ft(t){t.pc=0,t.regs=t.inicial.slice()}function Q(t){let e=t.rom[t.pc>>>2&15],r=J(e),{ctl:n,regWrite:s}=Dt(r.op,r.funct),c=t.regs[r.rs],f=t.regs[r.rt];return{...r,...qt(c,f,n),pc:t.pc,pc4:t.pc+4&65535,instr:e,a:c,b:f,ctl:n,regWrite:s}}function F(t){let e=Q(t),r=e.regWrite&&e.rd!==0;return r&&(t.regs[e.rd]=e.r),t.pc=e.pc4,{...e,gravou:r}}var Gt=[64,121,36,48,25,18,2,120,0,16,8,3,70,33,6,14];function mt(t,e){let r=Q(t),n,s,c;e.sw>>17&1?(n=e.sw&31,s=t.regs[n],c="reg"):e.key[2]?(n=r.rs,s=r.a,c="rs"):e.key[3]?(n=r.rt,s=r.b,c="rt"):(n=r.rd,s=r.r,c="rd");let f=[s&15,s>>4&15,s>>8&15,s>>12&15,n&15,n>>4&15,r.pc&15,r.pc>>4&15].map(v=>Gt[v]),b=(r.zero?1:0)|(r.ovf?2:0)|(r.cout?4:0)|(r.regWrite?8:0)|(r.r>>15&1?16:0)|(e.key[0]?256:0);return{hex:f,ledr:r.instr&262143,ledg:b,mostraReg:n,mostraValor:s,fonte:c}}var Ut=["zero","at","v0","v1","a0","a1","a2","a3","t0","t1","t2","t3","t4","t5","t6","t7","s0","s1","s2","s3","s4","s5","s6","s7","t8","t9","k0","k1","gp","sp","fp","ra"],j=`# Valores iniciais do banco (o resto come\xE7a em 0)
$1 = 5
$2 = 7
$3 = -5
$4 = 12
$5 = 0x00F0
$6 = 0x0F0F
$7 = 0x7FFF
$8 = 1

# Programa (m\xE1ximo 16 instru\xE7\xF5es): op rd, rs, rt
add $9,  $1, $2     # 5 + 7
sub $10, $1, $2     # 5 - 7, negativo
and $11, $5, $6     # Zero
or  $12, $5, $6
slt $13, $3, $4     # -5 < 12
slt $14, $4, $3     # 12 < -5 ? n\xE3o
nor $15, $0, $0
add $16, $7, $8     # Overflow
sub $17, $1, $1     # Zero e Cout
add $18, $9, $10    # usa resultados gravados
xor $19, $5, $6
add $1,  $1, $1     # sobrescreve $1
add $0,  $1, $2     # $0 n\xE3o muda
add $20, $0, $1
`;function gt(t){let e=t.trim().toLowerCase();if(!e.startsWith("$"))return null;let r=e.slice(1);if(/^\d+$/.test(r)){let s=Number(r);return s<=31?s:null}let n=Ut.indexOf(r);return n>=0?n:null}function _t(t){let e=t.trim().toLowerCase().replace(/_/g,""),r;if(/^-?0x[0-9a-f]+$/.test(e))r=e.startsWith("-")?-parseInt(e.slice(3),16):parseInt(e.slice(2),16);else if(/^-?0b[01]+$/.test(e))r=e.startsWith("-")?-parseInt(e.slice(3),2):parseInt(e.slice(2),2);else if(/^-?\d+$/.test(e))r=parseInt(e,10);else return null;return r<-32768||r>65535?null:r&65535}function jt(t,e,r,n){return(r<<21|n<<16|e<<11|O[t].funct)>>>0}function tt(t){let e=[],r=[],n=new Array(32).fill(0);if(t.split(/\r?\n/).forEach((c,f)=>{let b=f+1,v=c.replace(/(#|--|\/\/).*$/,"").trim();if(!v)return;let $=v.match(/^(\$\w+)\s*=\s*(\S+)$/);if($){let E=gt($[1]),o=_t($[2]);E===null?e.push({linha:b,msg:`registrador inv\xE1lido: ${$[1]}`}):E===0?e.push({linha:b,msg:"$0 \xE9 sempre zero, n\xE3o d\xE1 para iniciar"}):o===null?e.push({linha:b,msg:`valor inv\xE1lido: ${$[2]} (use decimal, 0x\u2026 ou 0b\u2026, 16 bits)`}):n[E]=o;return}let h=v.match(/^([a-z]+)\b\s*(.*)$/i),S=h?h[1].toLowerCase():"";if(S==="nop"&&h&&!h[2].trim()){r.push(0);return}if(!h||!(S in O)){e.push({linha:b,msg:`instru\xE7\xE3o desconhecida: "${v.split(/\s/)[0]}" (aceitas: add sub and or xor nor slt nop)`});return}let d=h[2].split(",").map(E=>E.trim()).filter(Boolean);if(d.length!==3){e.push({linha:b,msg:`${S} precisa de 3 registradores: ${S} rd, rs, rt`});return}let p=d.map(gt),C=p.findIndex(E=>E===null);if(C>=0){e.push({linha:b,msg:`registrador inv\xE1lido: ${d[C]}`});return}r.push(jt(S,p[0],p[1],p[2]))}),r.length>16&&e.push({linha:0,msg:`${r.length} instru\xE7\xF5es: a mem\xF3ria tem 16 palavras`}),e.length)return{ok:!1,erros:e};let s=r.length;for(;r.length<16;)r.push(0);return{ok:!0,res:{rom:r,inicial:n,usadas:s}}}function W(t){if(t===0)return"nop";let e=J(t),r=e.op===0?Z(e.funct):null;return r?`${r} $${e.rd}, $${e.rs}, $${e.rt}`:`.word 0x${l(t,8)}`}var It=(t,e)=>t.padEnd(e),Ft=t=>t?"'1'":"'0'";function xt(t){let e=[],r=t.usadas;for(let d=0;d<r;d++){let p=t.rom[d],C=J(p),E=Z(C.funct),o="0x"+l(d*4,2),x=p===0||!E?`${d} => (others => '0'),`:`${d} => tipo_r(F_${E.toUpperCase()}, ${C.rd}, ${C.rs}, ${C.rt}),`;e.push(`    ${It(x,34)}-- ${o}  ${W(p)}`)}r<16?e.push("    others => (others => '0')        -- nop"):e[r-1]=e[r-1].replace(/\),(\s+--)/,") $1");let n=`  constant ROM : rom_t := (
${e.join(`
`)}
  );`,s=[];t.inicial.forEach((d,p)=>{p&&d&&s.push(`    ${p} => x"${l(d)}",   -- ${M(d)}`)}),s.push('    others => x"0000"');let c=`  constant INICIAL : regs_t := (
${s.join(`
`)}
  );`,f=_(t.rom,t.inicial),b=[];for(let d=0;d<17;d++){let p=F(f),C=[p.zero,p.ovf,p.cout,p.regWrite].map(Ft).join(","),E=d===16?" ":",";b.push(`    (x"${l(p.pc)}", x"${l(p.r)}", ${C})${E}  -- ${W(p.instr)}`)}let v=_(t.rom,t.inicial);for(let d=0;d<16;d++)F(v);let $=[];v.regs.forEach((d,p)=>{d&&$.push(`${p} => x"${l(d)}"`)});let h=[];for(let d=0;d<$.length;d+=5)h.push("    "+$.slice(d,d+5).join(", ")+",");h.push('    others => x"0000");');let S=`  constant ESPERADO : passos_t := (
${b.join(`
`)}
  );

  constant REGS_FINAL : regs_t := (
${h.join(`
`)}`;return{rom:n,inicial:c,tb:S}}var A=t=>document.querySelector(t),m=(t,e,r)=>{let n=document.createElement(t);return e&&(n.className=e),r!=null&&(n.textContent=r),n},y=(t,e,r)=>(t.style.gridColumn=e,t.style.gridRow=r,t),Kt=8,k=1.6,K=8,z=44,rt=8,Y=48,nt=88,L=Kt/2,ot=(t,e,r)=>`${e},${t} ${e+L},${t-L} ${r-L},${t-L} ${r},${t} ${r-L},${t+L} ${e+L},${t+L}`,et=(t,e,r)=>`${t},${e} ${t+L},${e+L} ${t+L},${r-L} ${t},${r} ${t-L},${r-L} ${t-L},${e+L}`,zt=[ot(rt,K+k,z-k),et(z,rt+k,Y-k),et(z,Y+k,nt-k),ot(nt,K+k,z-k),et(K,Y+k,nt-k),et(K,rt+k,Y-k),ot(Y,K+k,z-k)],Yt='<svg viewBox="0 0 64 96" aria-hidden="true"><g transform="translate(9 0) skewX(-6)">'+zt.map(t=>`<polygon class="s" points="${t}"/>`).join("")+'<circle class="s dp" cx="54" cy="88" r="4.2"/></g></svg>',bt={7:1,6:2,5:4,4:5,3:7,2:8,1:9,0:10},Xt={8:{fn:"Clk",tip:"KEY0 apertado (j\xE1 filtrado)"},4:{fn:"Neg",tip:"Negativo, R[15]"},3:{fn:"Wr",tip:"RegWrite"},2:{fn:"Cout",tip:"Carry-out"},1:{fn:"Ovf",tip:"Overflow"},0:{fn:"Zero",tip:"Zero"}},$t={3:{fn:"Ver B",desc:"segure para ver o operando B (rt)"},2:{fn:"Ver A",desc:"segure para ver o operando A (rs)"},1:{fn:"Reset",desc:"reset: PC e registradores voltam ao in\xEDcio"},0:{fn:"Passo",desc:"executa uma instru\xE7\xE3o"}},Zt=[{t:"rt[1:0]",hi:17,lo:16},{t:"rd",hi:15,lo:11},{t:"shamt",hi:10,lo:6},{t:"funct",hi:5,lo:0}],Jt=[{t:"Ver",s:"reg",hi:17,lo:17,dim:!1},{t:"Livres",s:"SW16\u20135",hi:16,lo:5,dim:!0},{t:"N\xBA reg",s:"SW4\u20130",hi:4,lo:0,dim:!1}],st=t=>18-t,ht=(t,e)=>`${st(t)} / ${st(e)+1}`,Qt=t=>t===17?"liga o modo ver registrador":t<=4?`bit ${t} do n\xFAmero do registrador`:"n\xE3o usada",te={add:"A + B",sub:"A \u2212 B",and:"A and B",or:"A or B",xor:"A xor B",nor:"not(A or B)",slt:"A < B ? 1 : 0"},ee={rd:["Reg rd","Resultado da ULA"],rs:["Reg rs","A \xB7 dado de rs (KEY2)"],rt:["Reg rt","B \xB7 dado de rt (KEY3)"],reg:["Reg \xB7 SW4\u20130","Valor do registrador (SW17)"]};function vt(t){let e=[],r=[],n=[],s=[],c=[],f=A("#hexGrid"),b=[m("div","grp top silk","PC"),m("div","grp top silk"),m("div","grp top silk")];y(b[0],"1 / 3","1"),y(b[1],"4 / 6","1"),y(b[2],"7 / 11","1"),f.append(...b);for(let o of[7,6,5,4,3,2,1,0]){let x=y(m("div","digit"),String(bt[o]),"2");x.innerHTML=Yt,e[o]=Array.from(x.querySelectorAll(".s:not(.dp)")),f.append(x,y(m("span","silk n","HEX"+o),String(bt[o]),"3"))}let v=Object.keys(O),$=(o,x,u,g,U="ot-row")=>{let R=m("div",U);return R.append(m("span","code",o),m("span","mn",x),m("span","code",u),m("span","fx",g)),R};A("#otCol0").append($("funct","op","ctl","ULA","ot-row h")),A("#otCol1").append($("funct","op","ctl","ULA","ot-row h")),v.forEach((o,x)=>{let u=O[o];A(x<4?"#otCol0":"#otCol1").append($(u.funct.toString(2).padStart(6,"0"),o.toUpperCase(),u.ctl.toString(2).padStart(3,"0"),te[o]))}),A("#otCol1").append($("outro","NOP","\u2014","RegWrite = 0"));let h=A("#ledgGrid");h.append(y(m("div","grp top silk","KEY0"),"1 / 2","1"),y(m("div","grp top silk","ULA \xB7 controle"),"5 / 10","1"));for(let o=8;o>=0;o--){let x=String(9-o),u=Xt[o],g=y(m("span","led g"),x,"2");g.title=`LEDG${o} \xB7 ${u?u.tip:"n\xE3o usado"}`,n[o]=g,h.append(g,y(m("span","silk n","G"+o),x,"3"),y(m("span","silk fn"+(u?"":" dim"),u?u.fn:"\u2014"),x,"4"))}let S=A("#swGrid");for(let o of Zt)S.append(y(m("div","grp top silk",o.t),ht(o.hi,o.lo),"1"));for(let o=17;o>=0;o--){let x=String(st(o)),u=y(m("span","led r"),x,"2");u.title=`LEDR${o} \xB7 bit ${o} da instru\xE7\xE3o`;let g=y(m("button","sw"),x,"3");g.type="button",g.id="sw"+o,g.setAttribute("aria-label",`SW${o}, ${Qt(o)}`),g.setAttribute("aria-pressed","false"),g.append(m("span","lever")),g.addEventListener("click",()=>t.alternaSw(o)),r[o]=u,s[o]=g,S.append(u,g,y(m("span","silk n","SW"+o),x,"4"))}for(let o of Jt){let x=y(m("div","grp bot silk"+(o.dim?" dimgrp":""),o.t),ht(o.hi,o.lo),"5");x.append(m("small",void 0,o.s)),S.append(x)}let d=A("#keys");for(let o of[3,2,1,0]){let x=m("div","keycomp"),u=m("button","key");u.type="button",u.id="key"+o,u.setAttribute("aria-label",`KEY${o}, ${$t[o].desc}`),u.append(m("span","cap"));let g=!1,U=()=>{g||(g=!0,t.key(o,!0))},R=()=>{g&&(g=!1,t.key(o,!1))};u.addEventListener("pointerdown",i=>{if(i.button===0){try{u.setPointerCapture(i.pointerId)}catch{}U()}}),u.addEventListener("pointerup",R),u.addEventListener("pointercancel",R),u.addEventListener("lostpointercapture",R),u.addEventListener("keydown",i=>{(i.key===" "||i.key==="Enter")&&!i.repeat&&(i.preventDefault(),i.stopPropagation(),U())}),u.addEventListener("keyup",i=>{(i.key===" "||i.key==="Enter")&&(i.preventDefault(),i.stopPropagation(),R())}),u.addEventListener("blur",R),c[o]=u,x.append(u,m("span","silk n","KEY"+o),m("span","silk fn",$t[o].fn)),d.append(x)}let p=A("#power");p.addEventListener("click",()=>{let o=t.power();p.setAttribute("aria-pressed",String(o)),p.setAttribute("aria-label",o?"Bot\xE3o de energia: desligar a placa":"Bot\xE3o de energia: ligar a placa")});let C=A("#board"),E=A("#pwrLed");return{pintar(o,x,u){let g=o!==null;C.classList.toggle("is-off",!g),E.classList.toggle("on",g);for(let i=0;i<8;i++){let Wt=g?o.hex[i]:127;e[i].forEach((Bt,Vt)=>Bt.classList.toggle("on",(Wt>>Vt&1)===0))}for(let i=0;i<18;i++)r[i].classList.toggle("on",g&&(o.ledr>>i&1)===1);for(let i=0;i<9;i++)n[i].classList.toggle("on",g&&(o.ledg>>i&1)===1);for(let i=0;i<18;i++)s[i].setAttribute("aria-pressed",String((x>>i&1)===1));for(let i=0;i<4;i++)c[i].classList.toggle("down",u[i]);let[U,R]=ee[g?o.fonte:"rd"];b[1].textContent=U,b[2].textContent=R}}}function Lt(){return`<svg class="diag" viewBox="0 0 1000 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Datapath com valores atuais">
  <defs>
    <marker id="seta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L8 4L0 8z" class="seta"/>
    </marker>
  </defs>

  <!-- realimenta\xE7\xE3o PC+4 -->
  <path class="fio" data-st="0" d="M262 70H286V22H20V176H38" marker-end="url(#seta)"/>
  <text class="val" id="d-pc4" x="150" y="16" text-anchor="middle">0x0004</text>
  <text class="fio-nome" x="290" y="64">PC + 4</text>

  <!-- PC -->
  <rect class="bloco" x="40" y="140" width="56" height="72" rx="4"/>
  <text class="bloco-nome" x="68" y="182" text-anchor="middle">PC</text>
  <path class="fio" data-st="0" d="M96 176H158" marker-end="url(#seta)"/>
  <path class="fio" data-st="0" d="M120 176V48H206" marker-end="url(#seta)"/>
  <circle class="no" cx="120" cy="176" r="3"/>
  <text class="val" id="d-pc" x="100" y="168">0x0000</text>

  <!-- somador -->
  <polygon class="bloco" points="208,30 262,52 262,88 208,110 208,78 220,70 208,62"/>
  <text class="bloco-nome pequeno" x="242" y="74" text-anchor="middle">+</text>
  <path class="fio" data-st="0" d="M176 92H206" marker-end="url(#seta)"/>
  <text class="val" x="168" y="96" text-anchor="end">4</text>

  <!-- mem\xF3ria de instru\xE7\xF5es -->
  <rect class="bloco" x="160" y="134" width="132" height="104" rx="4"/>
  <text class="bloco-nome" x="226" y="196" text-anchor="middle">Mem\xF3ria de</text>
  <text class="bloco-nome" x="226" y="214" text-anchor="middle">instru\xE7\xF5es</text>
  <text class="porta" x="166" y="172">endere\xE7o</text>

  <!-- barramento da instru\xE7\xE3o -->
  <path class="fio grosso" data-st="1" d="M292 186H390"/>
  <path class="fio grosso" data-st="1" d="M390 42V206"/>
  <text class="val" id="d-instr" x="296" y="178">0x00000000</text>
  <path class="fio" data-st="1" d="M390 42H438" marker-end="url(#seta)"/>
  <path class="fio" data-st="1" d="M390 118H438" marker-end="url(#seta)"/>
  <path class="fio" data-st="1" d="M390 158H438" marker-end="url(#seta)"/>
  <path class="fio" data-st="1" d="M390 206H438" marker-end="url(#seta)"/>
  <text class="fio-nome" x="384" y="34" text-anchor="end">op, funct</text>
  <text class="val" id="d-rs" x="396" y="112">rs 0</text>
  <text class="val" id="d-rt" x="396" y="152">rt 0</text>
  <text class="val" id="d-rd" x="396" y="200">rd 0</text>

  <!-- controle -->
  <rect class="bloco" x="440" y="22" width="172" height="40" rx="4"/>
  <text class="bloco-nome" x="526" y="47" text-anchor="middle">Controle da ULA</text>
  <path class="fio we-fio" data-st="2" d="M526 62V92" marker-end="url(#seta)"/>
  <text class="val ctl-txt" id="d-we" x="532" y="82">RegWrite 1</text>
  <path class="fio" data-st="2" d="M612 42H756V116" marker-end="url(#seta)"/>
  <text class="val ctl-txt" id="d-ctl" x="620" y="36">ULACtl 010 \xB7 ADD</text>

  <!-- banco -->
  <rect class="bloco" x="440" y="94" width="172" height="152" rx="4"/>
  <text class="bloco-nome" x="526" y="182" text-anchor="middle">Registradores</text>
  <text class="porta" x="446" y="122">l\xEA reg 1</text>
  <text class="porta" x="446" y="162">l\xEA reg 2</text>
  <text class="porta" x="446" y="210">escreve reg</text>
  <text class="porta" x="446" y="236">escreve dado</text>
  <text class="porta" x="606" y="140" text-anchor="end">dado 1</text>
  <text class="porta" x="606" y="200" text-anchor="end">dado 2</text>

  <path class="fio" data-st="2" d="M612 136H726" marker-end="url(#seta)"/>
  <path class="fio" data-st="2" d="M612 196H676V216H726" marker-end="url(#seta)"/>
  <text class="val" id="d-a" x="620" y="128">A 0x0000</text>
  <text class="val" id="d-b" x="620" y="188">B 0x0000</text>

  <!-- ULA -->
  <polygon class="bloco" points="728,114 808,144 808,208 728,238 728,190 744,176 728,162"/>
  <text class="bloco-nome" x="784" y="181" text-anchor="middle">ULA</text>

  <!-- resultado e escrita -->
  <path class="fio wb" data-st="3" d="M808 176H872V280H420V232H438" marker-end="url(#seta)"/>
  <circle class="no" cx="872" cy="176" r="3"/>
  <text class="val res" id="d-r" x="816" y="168">R 0x0000</text>
  <text class="val" id="d-wb" x="646" y="274" text-anchor="middle">grava $0 \u2190 0x0000 na pr\xF3xima borda</text>

  <!-- flags -->
  <path class="fio" data-st="3" d="M808 160H892" />
  <g transform="translate(900 128)">
    <circle class="flag" id="d-z" cx="8" cy="8" r="6"/><text class="porta" x="20" y="12">Zero</text>
    <circle class="flag" id="d-v" cx="8" cy="30" r="6"/><text class="porta" x="20" y="34">Overflow</text>
    <circle class="flag" id="d-c" cx="8" cy="52" r="6"/><text class="porta" x="20" y="56">Cout</text>
  </g>
</svg>`}function Mt(t){t.classList.remove("pulso"),t.getBoundingClientRect(),t.classList.add("pulso")}function yt(t,e){let r=(s,c)=>{t.querySelector("#"+s).textContent=c};r("d-pc","0x"+l(e.pc)),r("d-pc4","0x"+l(e.pc4)),r("d-instr","0x"+l(e.instr,8)),r("d-rs",`rs ${e.rs}`),r("d-rt",`rt ${e.rt}`),r("d-rd",`rd ${e.rd}`),r("d-we",`RegWrite ${e.regWrite?1:0}`),r("d-ctl",`ULACtl ${e.ctl.toString(2).padStart(3,"0")} \xB7 ${X[e.ctl]}`),r("d-a",`A 0x${l(e.a)}  (${M(e.a)})`),r("d-b",`B 0x${l(e.b)}  (${M(e.b)})`),r("d-r",`R 0x${l(e.r)}`);let n=e.regWrite&&e.rd!==0;r("d-wb",e.regWrite?n?`na pr\xF3xima borda: $${e.rd} \u2190 0x${l(e.r)}`:"rd = $0: a escrita \xE9 ignorada":"RegWrite = 0: nada \xE9 gravado"),t.querySelector(".wb").classList.toggle("off",!n),t.querySelectorAll(".we-fio").forEach(s=>s.classList.toggle("off",!e.regWrite)),t.querySelector("#d-z").classList.toggle("on",e.zero),t.querySelector("#d-v").classList.toggle("on",e.ovf),t.querySelector("#d-c").classList.toggle("on",e.cout)}var a=t=>document.querySelector(t),At="sim-datapath-de2115:programa",I=j;try{I=localStorage.getItem(At)??j}catch{}var w=oe(I),H=_(w.rom,w.inicial),q=0,T=!1,P=!1,it=0,wt=1800,at=1200,re=150,ne=window.matchMedia("(prefers-reduced-motion: reduce)").matches,N=[!1,!1,!1,!1],B=[],lt=0,dt=null,ut;function oe(t){let e=tt(t);return e.ok?e.res:(I=j,tt(j).res)}function Rt(t=!1){let e=F(H);lt++,dt=e.gravou?e.rd:null,B.push({n:lt,r:e,repique:t}),B.length>200&&(B=B.slice(-200))}function se(){let t=a("#sem-debounce").checked,e=t?1+Math.floor(Math.random()*4):1;for(let r=0;r<e;r++)Rt(t&&r>0);t&&D(e===1?"Sem debounce: dessa vez saiu 1 passo s\xF3.":`Sem debounce: o repique executou ${e} instru\xE7\xF5es num aperto.`)}function pt(){ft(H),B=[],lt=0,dt=null}function G(t,e){if(!T||P){e&&D(P?"Aguarde a inicializa\xE7\xE3o da placa.":"A placa est\xE1 desligada. Aperte POWER.");return}N[t]!==e&&(N[t]=e,e&&t===0&&(se(),Tt()),e&&t===1&&pt(),V())}function ae(){return T=!T,N.fill(!1),it++,T?le():(P=!1,V()),T}function ie(t){let e=c=>({hex:new Array(8).fill(c?0:127),ledr:c?262143:0,ledg:c?511:0,mostraReg:0,mostraValor:0,fonte:"rd"});if(ne)return e(!0);if(t<at)return e(Math.floor(t/re)%2===0);let r=Math.min(.999,(t-at)/(wt-at)),n=e(!1);n.hex[7-Math.floor(r*8)]=0;let s=Math.floor(r*18);for(let c=0;c<3;c++){let f=17-(s-c);f>=0&&f<=17&&(n.ledr|=1<<f)}return n.ledg=1<<8-Math.floor(r*9),n}function le(){P=!0;let t=it,e=performance.now();Ht();let r=n=>{if(t!==it||!T)return;let s=n-e;if(s>=wt){P=!1,pt(),V();return}ut.pintar(ie(s),q,N),requestAnimationFrame(r)};requestAnimationFrame(r)}var Et=0;function Tt(){let t=a(".diag");Mt(t),clearTimeout(Et),Et=window.setTimeout(()=>t.classList.remove("pulso"),1e3)}function ce(){if(!T||P){D(P?"Aguarde a inicializa\xE7\xE3o da placa.":"A placa est\xE1 desligada. Aperte POWER.");return}let t=0;for(;H.pc>>>2<w.usadas&&H.pc<64&&t++<16;)Rt();t===0?D("O PC j\xE1 passou da \xFAltima instru\xE7\xE3o. Aperte KEY1 (reset) para recome\xE7ar."):Tt(),V()}function de(t){q=q&-32|t|1<<17,V()}var kt=0;function D(t){let e=a("#aviso");e.textContent=t,e.hidden=!1,clearTimeout(kt),kt=window.setTimeout(()=>{e.hidden=!0},3200)}var St={add:"+",sub:"\u2212",and:"and",or:"or",xor:"xor",nor:"nor"};function ue(t){let e=W(t.instr),r=e.split(" ")[0],n=`Na pr\xF3xima borda de KEY0: PC \u2190 0x${l(t.pc4)}`;if(!t.regWrite)return[`${e==="nop"?"nop":"funct desconhecido"}: RegWrite = 0, nenhum registrador muda.`,"",n+"."];let s;r==="slt"?s=`Com sinal: (${M(t.a)} < ${M(t.b)}) d\xE1 ${t.r}.`:r==="add"||r==="sub"?s=`Com sinal: ${M(t.a)} ${St[r]} ${M(t.b)} = ${M(t.r)}`+(t.ovf?", que n\xE3o cabe em 16 bits: Overflow = 1.":", cabe em 16 bits (Overflow = 0)."):s=`0x${l(t.a)} ${St[r]} 0x${l(t.b)} = 0x${l(t.r)}.`;let c="";r==="sub"?c=t.cout?"Cout = 1: n\xE3o houve empr\xE9stimo (A \u2265 B sem sinal).":"Cout = 0: houve empr\xE9stimo (A < B sem sinal).":r==="add"&&(c=t.cout?`Sem sinal: ${t.a} + ${t.b} passa de 65535, ent\xE3o Cout = 1.`:`Sem sinal: ${t.a} + ${t.b} = ${t.a+t.b}, sem carry.`);let f=t.rd===0?`${n}. rd = $0, ent\xE3o a escrita \xE9 descartada.`:`${n} e $${t.rd} \u2190 0x${l(t.r)}.`;return[s,c,f]}function pe(t){let e="";for(let r=15;r>=0;r--)e+=`<i class="${t>>r&1?"one":""}">${t>>r&1}</i>`;return e}function fe(t){a("#probe").classList.toggle("live",T&&!P),a("#probeStatus").textContent=T?P?"inicializando":"ao vivo":"sem energia";let r=[["A",`$${t.rs}`,t.a,""],["B",`$${t.rt}`,t.b,""],["R",t.regWrite?`\u2192$${t.rd}`:"",t.r," res"]],n=a("#bus");n.querySelectorAll(".bus-r").forEach(v=>v.remove());for(let[v,$,h,S]of r){let d=document.createElement("div");d.className="bus-r"+S;let p=M(h);d.innerHTML=`<span class="bn">${v}<small>${$}</small></span><span class="bits">${pe(h)}</span><span class="v">0x${l(h)}</span><span class="v">${h}</span><span class="v">${p>0?"+"+p:p}</span>`,n.append(d)}a("#busNote").textContent=`A e B saem das portas de leitura do banco: rs = $${t.rs}, rt = $${t.rt}.`,a("#probeOp").textContent=W(t.instr),a("#probeFx").textContent=`funct ${t.funct.toString(2).padStart(6,"0")} \xB7 ULACtl = ${t.ctl.toString(2).padStart(3,"0")} \xB7 ${X[t.ctl]}`;let s=[["Zero",t.zero],["Overflow",t.ovf],["Cout",t.cout],["RegWrite",t.regWrite]];a("#probeFlags").innerHTML=s.map(([v,$])=>`<span class="flag${$?" on":""}">${v}</span>`).join("");let[c,f,b]=ue(t);a("#ex1").textContent=c,a("#ex2").textContent=f,a("#ex3").textContent=b}function V(){P||ut.pintar(T?mt(H,{sw:q,key:N}):null,q,N),Ht()}function Ht(){let t=Q(H);yt(a(".diag"),t),fe(t),me(t),ge(t),xe()}function me(t){let e=t.pc>>>2&15;a("#rom").innerHTML=H.rom.map((r,n)=>`<tr class="${n===e?"atual":""} ${n>=w.usadas?"vazio":""}">
      <td>${l(n*4,2)}</td><td>${l(r,8)}</td><td>${W(r)}</td></tr>`).join(""),a("#rom-nota").textContent=t.pc>=64?`PC = 0x${l(t.pc)}: s\xF3 PC[5:2] endere\xE7a a ROM, ent\xE3o ela entrega de novo a palavra ${e}.`:""}function ge(t){let e=q>>17&1?q&31:-1;a("#regs").innerHTML=H.regs.map((r,n)=>{let s=[n===t.rs?"rs":"",n===t.rt?"rt":"",t.regWrite&&n===t.rd?"rd":""].filter(Boolean);return`<button type="button" class="${["reg",n===dt?"mudou":"",n===e?"vendo":"",r!==H.inicial[n]?"alt":""].join(" ")}" data-reg="${n}" aria-label="Ver $${n} na placa">
      <span class="reg-n">$${n}</span><span class="reg-tags">${s.map(f=>`<i>${f}</i>`).join("")}</span>
      <span class="reg-hex">${l(r)}</span><span class="reg-dec">${M(r)}</span></button>`}).join("")}var Pt=t=>[t.zero?"Z":"",t.ovf?"V":"",t.cout?"C":""].filter(Boolean).join(" ")||"\u2014";function xe(){let t=a("#log");if(!B.length){t.innerHTML='<tr><td colspan="8" class="log-vazio">Aperte KEY0 (ou Espa\xE7o) para executar a instru\xE7\xE3o do PC atual.</td></tr>';return}t.innerHTML=B.slice().reverse().map(({n:e,r,repique:n})=>`<tr class="${n?"rep":""}">
    <td>${e}</td><td>${l(r.pc,2)}</td><td>${W(r.instr)}</td>
    <td>${l(r.a)}</td><td>${l(r.b)}</td><td>${l(r.r)}</td><td>${Pt(r)}</td>
    <td>${r.gravou?`$${r.rd} \u2190 ${l(r.r)}`:"\u2014"}${n?' <span class="tag-rep">repique</span>':""}</td></tr>`).join("")}function ct(){let t=a("#fonte").value,e=tt(t);if(!e.ok){a("#erros").innerHTML=e.erros.map(r=>`<li>${r.linha?`linha ${r.linha}: `:""}${r.msg}</li>`).join("");return}a("#erros").innerHTML="",I=t,w=e.res;try{localStorage.setItem(At,I)}catch{}H=_(w.rom,w.inicial),pt(),Ot(),D(`Programa montado: ${w.usadas} instru\xE7\xF5es. Placa resetada.`),V()}function be(){let t=(n,s)=>n+Math.floor(Math.random()*(s-n+1)),e=new Array(32).fill(0);e[1]=t(1,120),e[2]=e[1]+t(1,120),e[3]=65536-t(1,500)&65535,e[4]=t(1,500),e[5]=t(1,65534),e[6]=~e[5]&65535&t(1,65535)||~e[5]&65535,e[7]=t(16384,32767),e[8]=t(32768-e[7],32767);let r=["# Valores iniciais sorteados (o resto come\xE7a em 0)"];for(let n=1;n<=8;n++)r.push(`$${n} = 0x${l(e[n])}`);r.push("","# Programa");for(let n=0;n<w.usadas;n++)r.push(W(w.rom[n]));a("#fonte").value=r.join(`
`)+`
`,ct(),D("Valores sorteados. Os blocos de VHDL foram atualizados: cole INICIAL no datapath_board e ESPERADO/REGS_FINAL no datapath_tb.")}function Ot(){let t=xt(w);a("#vhdl-rom").textContent=t.rom,a("#vhdl-ini").textContent=t.inicial,a("#vhdl-tb").textContent=t.tb}async function Ct(t,e){try{await navigator.clipboard.writeText(t),D("Copiado.")}catch{let r=window.getSelection(),n=document.createRange();n.selectNodeContents(e),r?.removeAllRanges(),r?.addRange(n),D("N\xE3o deu para copiar direto. O texto est\xE1 selecionado: use Ctrl+C.")}}function $e(){return[["#","PC","Instru\xE7\xE3o","A","B","R","Flags","Gravou"].join("	"),...B.map(({n:e,r})=>[e,"0x"+l(r.pc,2),W(r.instr),"0x"+l(r.a),"0x"+l(r.b),"0x"+l(r.r),Pt(r),r.gravou?`$${r.rd} \u2190 0x${l(r.r)}`:"\u2014"].join("	"))].join(`
`)}function he(){a("#diag-slot").innerHTML=Lt(),ut=vt({alternaSw:r=>{q^=1<<r,V()},key:G,power:ae}),document.addEventListener("mousedown",r=>{r.target.closest(".board button, .cmds button")&&r.preventDefault()}),a("#btn-passo").addEventListener("click",()=>{G(0,!0),G(0,!1)}),a("#btn-reset").addEventListener("click",()=>{G(1,!0),G(1,!1)}),a("#btn-rodar").addEventListener("click",ce),a("#btn-sortear").addEventListener("click",be),a("#regs").addEventListener("click",r=>{let n=r.target.closest("[data-reg]");n&&de(Number(n.dataset.reg))}),a("#btn-sair-reg").addEventListener("click",()=>{q&=~(1<<17),V()}),a("#editor").addEventListener("toggle",()=>{a("#editor").open&&(a("#fonte").value=I,a("#erros").innerHTML="")}),a("#btn-montar").addEventListener("click",ct),a("#btn-padrao").addEventListener("click",()=>{a("#fonte").value=j,ct()}),document.querySelectorAll("[data-copia]").forEach(r=>r.addEventListener("click",()=>{let n=a(r.dataset.copia);Ct(n.textContent??"",n)})),a("#btn-copiar-log").addEventListener("click",()=>{if(!B.length){D("Execute algumas instru\xE7\xF5es antes de copiar a tabela.");return}Ct($e(),a("#log"))});let t={" ":0,r:1,a:2,b:3},e=r=>r instanceof HTMLElement&&r.closest("input, textarea, select, button, summary")!==null;window.addEventListener("keydown",r=>{if(e(r.target)||r.repeat||r.ctrlKey||r.metaKey||r.altKey)return;let n=t[r.key.toLowerCase()];n!==void 0&&(r.preventDefault(),G(n,!0))}),window.addEventListener("keyup",r=>{let n=t[r.key.toLowerCase()];n!==void 0&&N[n]&&G(n,!1)}),window.addEventListener("blur",()=>{N.forEach((r,n)=>{r&&G(n,!1)})}),Ot(),V()}he();})();
