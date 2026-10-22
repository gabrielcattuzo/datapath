// Diagrama do datapath (mesmo desenho do enunciado) com os valores de cada fio.
import { Comb, ULA_OPS, hex, s16 } from "./hw";

export function svgDiagrama(): string {
  return `<svg class="diag" viewBox="0 0 1000 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Datapath com valores atuais">
  <defs>
    <marker id="seta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L8 4L0 8z" class="seta"/>
    </marker>
  </defs>

  <!-- realimentação PC+4 -->
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

  <!-- memória de instruções -->
  <rect class="bloco" x="160" y="134" width="132" height="104" rx="4"/>
  <text class="bloco-nome" x="226" y="196" text-anchor="middle">Memória de</text>
  <text class="bloco-nome" x="226" y="214" text-anchor="middle">instruções</text>
  <text class="porta" x="166" y="172">endereço</text>

  <!-- barramento da instrução -->
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
  <text class="val ctl-txt" id="d-ctl" x="620" y="36">ULACtl 010 · ADD</text>

  <!-- banco -->
  <rect class="bloco" x="440" y="94" width="172" height="152" rx="4"/>
  <text class="bloco-nome" x="526" y="182" text-anchor="middle">Registradores</text>
  <text class="porta" x="446" y="122">lê reg 1</text>
  <text class="porta" x="446" y="162">lê reg 2</text>
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
  <text class="val" id="d-wb" x="646" y="274" text-anchor="middle">grava $0 ← 0x0000 na próxima borda</text>

  <!-- flags -->
  <path class="fio" data-st="3" d="M808 160H892" />
  <g transform="translate(900 128)">
    <circle class="flag" id="d-z" cx="8" cy="8" r="6"/><text class="porta" x="20" y="12">Zero</text>
    <circle class="flag" id="d-v" cx="8" cy="30" r="6"/><text class="porta" x="20" y="34">Overflow</text>
    <circle class="flag" id="d-c" cx="8" cy="52" r="6"/><text class="porta" x="20" y="56">Cout</text>
  </g>
</svg>`;
}

/** Anima o caminho dos dados depois de uma borda de clock: PC → ROM → banco → ULA → escrita. */
export function pulsoDiagrama(raiz: SVGSVGElement): void {
  raiz.classList.remove("pulso");
  void raiz.getBoundingClientRect();          // reinicia a animação
  raiz.classList.add("pulso");
}

export function pintarDiagrama(raiz: SVGSVGElement, c: Comb): void {
  const t = (id: string, s: string) => { raiz.querySelector("#" + id)!.textContent = s; };
  t("d-pc", "0x" + hex(c.pc));
  t("d-pc4", "0x" + hex(c.pc4));
  t("d-instr", "0x" + hex(c.instr, 8));
  t("d-rs", `rs ${c.rs}`);
  t("d-rt", `rt ${c.rt}`);
  t("d-rd", `rd ${c.rd}`);
  t("d-we", `RegWrite ${c.regWrite ? 1 : 0}`);
  t("d-ctl", `ULACtl ${c.ctl.toString(2).padStart(3, "0")} · ${ULA_OPS[c.ctl]}`);
  t("d-a", `A 0x${hex(c.a)}  (${s16(c.a)})`);
  t("d-b", `B 0x${hex(c.b)}  (${s16(c.b)})`);
  t("d-r", `R 0x${hex(c.r)}`);
  const grava = c.regWrite && c.rd !== 0;
  t("d-wb", !c.regWrite ? "RegWrite = 0: nada é gravado"
    : grava ? `na próxima borda: $${c.rd} ← 0x${hex(c.r)}`
      : "rd = $0: a escrita é ignorada");
  raiz.querySelector(".wb")!.classList.toggle("off", !grava);
  raiz.querySelectorAll(".we-fio").forEach(e => e.classList.toggle("off", !c.regWrite));
  raiz.querySelector("#d-z")!.classList.toggle("on", c.zero);
  raiz.querySelector("#d-v")!.classList.toggle("on", c.ovf);
  raiz.querySelector("#d-c")!.classList.toggle("on", c.cout);
}
