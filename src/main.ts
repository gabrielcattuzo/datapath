// Estado da página, entradas (mouse/teclado) e painéis.
import { Comb, Maquina, Registro, Saidas, ULA_OPS, avaliar, hex, novaMaquina, passo, reset, s16, saidasPlaca } from "./hw";
import { Montado, PROGRAMA_PADRAO, desmontar, montar, paraVhdl } from "./asm";
import { Placa, montarPlaca } from "./board";
import { pintarDiagrama, pulsoDiagrama, svgDiagrama } from "./diagram";

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const CHAVE_LS = "sim-datapath-de2115:programa";

// ------------------------------------------------------------ estado
let fonte = PROGRAMA_PADRAO;
try { fonte = localStorage.getItem(CHAVE_LS) ?? PROGRAMA_PADRAO; } catch { /* sem storage */ }
let mo: Montado = montarOuPadrao(fonte);
let m: Maquina = novaMaquina(mo.rom, mo.inicial);
let sw = 0;
let ligada = false;
let ligando = false;            // animação de inicialização em curso
let bootId = 0;
const BOOT_MS = 1800, PISCA_ATE = 1200, PISCA_MS = 150;
const reduzMov = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const keys: [boolean, boolean, boolean, boolean] = [false, false, false, false];
interface Linha { n: number; r: Registro; repique: boolean }
let log: Linha[] = [];
let contador = 0;
let ultimoGravado: number | null = null;
let placa: Placa;

function montarOuPadrao(txt: string): Montado {
  const r = montar(txt);
  if (r.ok) return r.res;
  fonte = PROGRAMA_PADRAO;
  return (montar(PROGRAMA_PADRAO) as { ok: true; res: Montado }).res;
}

// ------------------------------------------------------------ ações
function executar(repique = false): void {
  const r = passo(m);
  contador++;
  ultimoGravado = r.gravou ? r.rd : null;
  log.push({ n: contador, r, repique });
  if (log.length > 200) log = log.slice(-200);
}

function apertaKey0(): void {
  const semDebounce = $<HTMLInputElement>("#sem-debounce").checked;
  const n = semDebounce ? 1 + Math.floor(Math.random() * 4) : 1;
  for (let i = 0; i < n; i++) executar(semDebounce && i > 0);
  if (semDebounce) aviso(n === 1 ? "Sem debounce: dessa vez saiu 1 passo só." : `Sem debounce: o repique executou ${n} instruções num aperto.`);
}

function fazReset(): void {
  reset(m);
  log = []; contador = 0; ultimoGravado = null;
}

function key(i: number, apertado: boolean): void {
  if (!ligada || ligando) { if (apertado) aviso(ligando ? "Aguarde a inicialização da placa." : "A placa está desligada. Aperte POWER."); return; }
  if (keys[i] === apertado) return;
  keys[i] = apertado;
  if (apertado && i === 0) { apertaKey0(); pulso(); }
  if (apertado && i === 1) fazReset();
  render();
}

function alternaPower(): boolean {
  ligada = !ligada;
  keys.fill(false);
  bootId++;
  if (ligada) iniciarBoot();
  else { ligando = false; render(); }
  return ligada;
}

// Ao ligar: displays e LEDs piscam, depois uma varredura; então o FPGA
// "carrega a configuração" (PC = 0 e registradores iniciais) e a placa opera.
function quadroBoot(t: number): Saidas {
  const tudo = (on: boolean): Saidas => ({ hex: new Array(8).fill(on ? 0 : 0x7f), ledr: on ? 0x3ffff : 0, ledg: on ? 0x1ff : 0, mostraReg: 0, mostraValor: 0, fonte: "rd" });
  if (reduzMov) return tudo(true);
  if (t < PISCA_ATE) return tudo(Math.floor(t / PISCA_MS) % 2 === 0);
  const p = Math.min(0.999, (t - PISCA_ATE) / (BOOT_MS - PISCA_ATE));
  const q = tudo(false);
  q.hex[7 - Math.floor(p * 8)] = 0;                       // um display por vez, da esquerda para a direita
  const pos = Math.floor(p * 18);
  for (let j = 0; j < 3; j++) { const i = 17 - (pos - j); if (i >= 0 && i <= 17) q.ledr |= 1 << i; }
  q.ledg = 1 << (8 - Math.floor(p * 9));
  return q;
}

function iniciarBoot(): void {
  ligando = true;
  const id = bootId, t0 = performance.now();
  renderPaineis();
  const quadro = (agora: number) => {
    if (id !== bootId || !ligada) return;
    const t = agora - t0;
    if (t >= BOOT_MS) {
      ligando = false;
      fazReset();
      render();
      return;
    }
    placa.pintar(quadroBoot(t), sw, keys);
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}

let pulsoTimer = 0;
function pulso(): void {
  const d = $<SVGSVGElement>(".diag");
  pulsoDiagrama(d);
  clearTimeout(pulsoTimer);
  pulsoTimer = window.setTimeout(() => d.classList.remove("pulso"), 1000);
}

function rodarAteOFim(): void {
  if (!ligada || ligando) { aviso(ligando ? "Aguarde a inicialização da placa." : "A placa está desligada. Aperte POWER."); return; }
  let k = 0;
  while ((m.pc >>> 2) < mo.usadas && m.pc < 0x40 && k++ < 16) executar();
  if (k === 0) aviso("O PC já passou da última instrução. Aperte KEY1 (reset) para recomeçar.");
  else pulso();
  render();
}

function verRegistrador(r: number): void {
  sw = (sw & ~31) | r | (1 << 17);   // SW17 = 1, SW4-0 = r
  render();
}

let avisoTimer = 0;
function aviso(txt: string): void {
  const el = $("#aviso");
  el.textContent = txt;
  el.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = window.setTimeout(() => { el.hidden = true; }, 3200);
}

// ------------------------------------------------------------ sonda
const OPS_TXT: Record<string, string> = { add: "+", sub: "−", and: "and", or: "or", xor: "xor", nor: "nor" };

function explicar(c: Comb): [string, string, string] {
  const mn = desmontar(c.instr);
  const nome = mn.split(" ")[0];
  const prox = `Na próxima borda de KEY0: PC ← 0x${hex(c.pc4)}`;
  if (!c.regWrite) return [`${mn === "nop" ? "nop" : "funct desconhecido"}: RegWrite = 0, nenhum registrador muda.`, "", prox + "."];
  let conta: string;
  if (nome === "slt") conta = `Com sinal: (${s16(c.a)} < ${s16(c.b)}) dá ${c.r}.`;
  else if (nome === "add" || nome === "sub") {
    conta = `Com sinal: ${s16(c.a)} ${OPS_TXT[nome]} ${s16(c.b)} = ${s16(c.r)}` +
      (c.ovf ? `, que não cabe em 16 bits: Overflow = 1.` : `, cabe em 16 bits (Overflow = 0).`);
  } else conta = `0x${hex(c.a)} ${OPS_TXT[nome]} 0x${hex(c.b)} = 0x${hex(c.r)}.`;
  let notas = "";
  if (nome === "sub") notas = c.cout ? "Cout = 1: não houve empréstimo (A ≥ B sem sinal)." : "Cout = 0: houve empréstimo (A < B sem sinal).";
  else if (nome === "add") notas = c.cout ? `Sem sinal: ${c.a} + ${c.b} passa de 65535, então Cout = 1.` : `Sem sinal: ${c.a} + ${c.b} = ${c.a + c.b}, sem carry.`;
  const wb = c.rd === 0 ? `${prox}. rd = $0, então a escrita é descartada.` : `${prox} e $${c.rd} ← 0x${hex(c.r)}.`;
  return [conta, notas, wb];
}

function bits(v: number): string {
  let s = "";
  for (let i = 15; i >= 0; i--) s += `<i class="${(v >> i) & 1 ? "one" : ""}">${(v >> i) & 1}</i>`;
  return s;
}

function renderSonda(c: Comb): void {
  const probe = $("#probe");
  probe.classList.toggle("live", ligada && !ligando);
  $("#probeStatus").textContent = !ligada ? "sem energia" : ligando ? "inicializando" : "ao vivo";
  const linhas: [string, string, number, string][] = [
    ["A", `$${c.rs}`, c.a, ""], ["B", `$${c.rt}`, c.b, ""], ["R", c.regWrite ? `→$${c.rd}` : "", c.r, " res"],
  ];
  const bus = $("#bus");
  bus.querySelectorAll(".bus-r").forEach(e => e.remove());
  for (const [n, sub, v, cls] of linhas) {
    const r = document.createElement("div");
    r.className = "bus-r" + cls;
    const sg = s16(v);
    r.innerHTML = `<span class="bn">${n}<small>${sub}</small></span><span class="bits">${bits(v)}</span>` +
      `<span class="v">0x${hex(v)}</span><span class="v">${v}</span><span class="v">${sg > 0 ? "+" + sg : sg}</span>`;
    bus.append(r);
  }
  $("#busNote").textContent = `A e B saem das portas de leitura do banco: rs = $${c.rs}, rt = $${c.rt}.`;
  $("#probeOp").textContent = desmontar(c.instr);
  $("#probeFx").textContent = `funct ${c.funct.toString(2).padStart(6, "0")} · ULACtl = ${c.ctl.toString(2).padStart(3, "0")} · ${ULA_OPS[c.ctl]}`;
  const flags: [string, boolean][] = [["Zero", c.zero], ["Overflow", c.ovf], ["Cout", c.cout], ["RegWrite", c.regWrite]];
  $("#probeFlags").innerHTML = flags.map(([n, on]) => `<span class="flag${on ? " on" : ""}">${n}</span>`).join("");
  const [e1, e2, e3] = explicar(c);
  $("#ex1").textContent = e1; $("#ex2").textContent = e2; $("#ex3").textContent = e3;
}

// ------------------------------------------------------------ render
function render(): void {
  if (!ligando) placa.pintar(ligada ? saidasPlaca(m, { sw, key: keys }) : null, sw, keys);
  renderPaineis();
}

function renderPaineis(): void {
  const c = avaliar(m);
  pintarDiagrama($<SVGSVGElement>(".diag"), c);
  renderSonda(c);
  renderRom(c);
  renderRegs(c);
  renderLog();
}

function renderRom(c: Comb): void {
  const atual = (c.pc >>> 2) & 15;
  $("#rom").innerHTML = m.rom.map((w, i) => `<tr class="${i === atual ? "atual" : ""} ${i >= mo.usadas ? "vazio" : ""}">
      <td>${hex(i * 4, 2)}</td><td>${hex(w, 8)}</td><td>${desmontar(w)}</td></tr>`).join("");
  $("#rom-nota").textContent = c.pc >= 0x40
    ? `PC = 0x${hex(c.pc)}: só PC[5:2] endereça a ROM, então ela entrega de novo a palavra ${atual}.`
    : "";
}

function renderRegs(c: Comb): void {
  const vendo = (sw >> 17) & 1 ? sw & 31 : -1;
  $("#regs").innerHTML = m.regs.map((v, r) => {
    const tags = [r === c.rs ? "rs" : "", r === c.rt ? "rt" : "", c.regWrite && r === c.rd ? "rd" : ""].filter(Boolean);
    const cls = ["reg", r === ultimoGravado ? "mudou" : "", r === vendo ? "vendo" : "", v !== m.inicial[r] ? "alt" : ""].join(" ");
    return `<button type="button" class="${cls}" data-reg="${r}" aria-label="Ver $${r} na placa">
      <span class="reg-n">$${r}</span><span class="reg-tags">${tags.map(t => `<i>${t}</i>`).join("")}</span>
      <span class="reg-hex">${hex(v)}</span><span class="reg-dec">${s16(v)}</span></button>`;
  }).join("");
}

const flagsTxt = (r: Registro) => [r.zero ? "Z" : "", r.ovf ? "V" : "", r.cout ? "C" : ""].filter(Boolean).join(" ") || "—";
function renderLog(): void {
  const corpo = $("#log");
  if (!log.length) {
    corpo.innerHTML = `<tr><td colspan="8" class="log-vazio">Aperte KEY0 (ou Espaço) para executar a instrução do PC atual.</td></tr>`;
    return;
  }
  corpo.innerHTML = log.slice().reverse().map(({ n, r, repique }) => `<tr class="${repique ? "rep" : ""}">
    <td>${n}</td><td>${hex(r.pc, 2)}</td><td>${desmontar(r.instr)}</td>
    <td>${hex(r.a)}</td><td>${hex(r.b)}</td><td>${hex(r.r)}</td><td>${flagsTxt(r)}</td>
    <td>${r.gravou ? `$${r.rd} ← ${hex(r.r)}` : "—"}${repique ? ' <span class="tag-rep">repique</span>' : ""}</td></tr>`).join("");
}

// ------------------------------------------------------------ editor
function aplicarFonte(): void {
  const txt = $<HTMLTextAreaElement>("#fonte").value;
  const r = montar(txt);
  if (!r.ok) {
    $("#erros").innerHTML = r.erros.map(e => `<li>${e.linha ? `linha ${e.linha}: ` : ""}${e.msg}</li>`).join("");
    return;
  }
  $("#erros").innerHTML = "";
  fonte = txt; mo = r.res;
  try { localStorage.setItem(CHAVE_LS, fonte); } catch { /* ok */ }
  m = novaMaquina(mo.rom, mo.inicial);
  fazReset();
  gerarVhdl();
  aviso(`Programa montado: ${mo.usadas} instruções. Placa resetada.`);
  render();
}

// Sorteia novos valores iniciais para $1–$8 mantendo o que cada instrução
// do programa do lab testa (negativo no sub, slt nos dois sentidos, Zero no
// and, Overflow no add). O programa continua o mesmo.
function valoresAleatorios(): void {
  const r = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
  const v = new Array(32).fill(0);
  v[1] = r(1, 120);                      // $1 < $2: sub dá negativo
  v[2] = v[1] + r(1, 120);
  v[3] = (0x10000 - r(1, 500)) & 0xffff; // $3 negativo
  v[4] = r(1, 500);                      // $4 positivo
  v[5] = r(1, 0xfffe);                   // $5 e $6 sem bits em comum: and = 0
  v[6] = (~v[5] & 0xffff) & r(1, 0xffff) || (~v[5] & 0xffff);
  v[7] = r(0x4000, 0x7fff);              // $7 + $8 passa de 0x7FFF: Overflow
  v[8] = r(0x8000 - v[7], 0x7fff);
  const linhas = ["# Valores iniciais sorteados (o resto começa em 0)"];
  for (let i = 1; i <= 8; i++) linhas.push(`$${i} = 0x${hex(v[i])}`);
  linhas.push("", "# Programa");
  for (let i = 0; i < mo.usadas; i++) linhas.push(desmontar(mo.rom[i]));
  $<HTMLTextAreaElement>("#fonte").value = linhas.join("\n") + "\n";
  aplicarFonte();
  aviso("Valores sorteados. Os blocos de VHDL foram atualizados: cole INICIAL no datapath_board e ESPERADO/REGS_FINAL no datapath_tb.");
}

function gerarVhdl(): void {
  const v = paraVhdl(mo);
  $("#vhdl-rom").textContent = v.rom;
  $("#vhdl-ini").textContent = v.inicial;
  $("#vhdl-tb").textContent = v.tb;
}

async function copiar(texto: string, alvo: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    aviso("Copiado.");
  } catch {
    const sel = window.getSelection();
    const rg = document.createRange();
    rg.selectNodeContents(alvo);
    sel?.removeAllRanges(); sel?.addRange(rg);
    aviso("Não deu para copiar direto. O texto está selecionado: use Ctrl+C.");
  }
}

function tabelaLog(): string {
  const cab = ["#", "PC", "Instrução", "A", "B", "R", "Flags", "Gravou"].join("\t");
  return [cab, ...log.map(({ n, r }) => [n, "0x" + hex(r.pc, 2), desmontar(r.instr), "0x" + hex(r.a), "0x" + hex(r.b), "0x" + hex(r.r), flagsTxt(r), r.gravou ? `$${r.rd} ← 0x${hex(r.r)}` : "—"].join("\t"))].join("\n");
}

// ------------------------------------------------------------ init
function init(): void {
  $("#diag-slot").innerHTML = svgDiagrama();
  placa = montarPlaca({ alternaSw: i => { sw ^= 1 << i; render(); }, key, power: alternaPower });

  // Clique de mouse na placa ou nos comandos não deixa o foco preso no botão:
  // assim o Espaço continua sendo o KEY0 mesmo depois de mexer numa chave.
  document.addEventListener("mousedown", ev => {
    if ((ev.target as HTMLElement).closest(".board button, .cmds button")) ev.preventDefault();
  });
  $("#btn-passo").addEventListener("click", () => { key(0, true); key(0, false); });
  $("#btn-reset").addEventListener("click", () => { key(1, true); key(1, false); });
  $("#btn-rodar").addEventListener("click", rodarAteOFim);
  $("#btn-sortear").addEventListener("click", valoresAleatorios);
  $("#regs").addEventListener("click", ev => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-reg]");
    if (b) verRegistrador(Number(b.dataset.reg));
  });
  $("#btn-sair-reg").addEventListener("click", () => { sw &= ~(1 << 17); render(); });

  $("#editor").addEventListener("toggle", () => {
    if ($<HTMLDetailsElement>("#editor").open) { $<HTMLTextAreaElement>("#fonte").value = fonte; $("#erros").innerHTML = ""; }
  });
  $("#btn-montar").addEventListener("click", aplicarFonte);
  $("#btn-padrao").addEventListener("click", () => { $<HTMLTextAreaElement>("#fonte").value = PROGRAMA_PADRAO; aplicarFonte(); });
  document.querySelectorAll<HTMLButtonElement>("[data-copia]").forEach(b =>
    b.addEventListener("click", () => { const alvo = $(b.dataset.copia!); copiar(alvo.textContent ?? "", alvo); }));
  $("#btn-copiar-log").addEventListener("click", () => {
    if (!log.length) { aviso("Execute algumas instruções antes de copiar a tabela."); return; }
    copiar(tabelaLog(), $("#log"));
  });

  // teclado: Espaço = KEY0, R = KEY1, A = KEY2, B = KEY3 (segurar)
  const MAPA: Record<string, number> = { " ": 0, r: 1, a: 2, b: 3 };
  const ignora = (t: EventTarget | null) => t instanceof HTMLElement && t.closest("input, textarea, select, button, summary") !== null;
  window.addEventListener("keydown", ev => {
    if (ignora(ev.target) || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = MAPA[ev.key.toLowerCase()];
    if (k === undefined) return;
    ev.preventDefault();
    key(k, true);
  });
  window.addEventListener("keyup", ev => {
    const k = MAPA[ev.key.toLowerCase()];
    if (k !== undefined && keys[k]) key(k, false);
  });
  window.addEventListener("blur", () => { keys.forEach((v, i) => { if (v) key(i, false); }); });

  gerarVhdl();
  render();
}

init();
