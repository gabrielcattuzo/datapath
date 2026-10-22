-- =====================================================================
-- Lab 05 - Datapath (inicio) | Arquitetura de Sistemas Computacionais
-- Grupo: <NOME 1>, <NOME 2>, <NOME 3>, <NOME 4>
-- Arquivo: datapath_board.vhd - Datapath de ciclo unico + top-level DE2-115
-- =====================================================================
-- Este arquivo tem, nesta ordem: pc, somador_pc, mem_instrucoes,
-- banco_registradores, controle_ula, debounce, datapath e o top-level
-- datapath_board. Usa tambem ula.vhd e hex7seg.vhd.
-- Top-level no Quartus: datapath_board
-- =====================================================================

-- ---------------------------------------------------------------------
-- PC - contador de programa (16 bits, enable, reset assincrono)
-- Atualiza na borda de subida de clk quando en = '1'.
-- rst assincrono leva o PC para 0x0000.
-- ---------------------------------------------------------------------
library ieee;
use ieee.std_logic_1164.all;

entity pc is
  port (
    clk, rst, en : in  std_logic;
    pc_in        : in  std_logic_vector(15 downto 0);
    pc_out       : out std_logic_vector(15 downto 0)
  );
end entity;

architecture rtl of pc is
  signal q : std_logic_vector(15 downto 0) := (others => '0');
begin
  process (clk, rst)
  begin
    if rst = '1' then
      q <= (others => '0');
    elsif rising_edge(clk) then
      if en = '1' then
        q <= pc_in;
      end if;
    end if;
  end process;
  pc_out <= q;
end architecture;

-- ---------------------------------------------------------------------
-- SOMADOR_PC - bloco "Adiciona" do diagrama (PC + 4)
-- ---------------------------------------------------------------------
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity somador_pc is
  port (
    a : in  std_logic_vector(15 downto 0);
    s : out std_logic_vector(15 downto 0)
  );
end entity;

architecture rtl of somador_pc is
begin
  s <= std_logic_vector(unsigned(a) + 4);
end architecture;

-- ---------------------------------------------------------------------
-- MEM_INSTRUCOES - ROM 16 x 32 bits com o programa de teste
-- Instrucoes de 32 bits no formato tipo R do MIPS:
--   | op (6) | rs (5) | rt (5) | rd (5) | shamt (5) | funct (6) |
-- O endereco e em bytes (PC); a palavra lida e PC(5 downto 2).
-- So os bits 5..2 do PC enderecam a ROM: em 0x40 a memoria volta a
-- entregar a palavra 0 e o programa recomeca (com os registradores ja
-- alterados). Use o reset (KEY1) para recomecar do estado inicial.
-- Palavras nao usadas = 0x00000000 (nop: escreveria em $0, que e fixo).
-- ---------------------------------------------------------------------
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity mem_instrucoes is
  port (
    endereco  : in  std_logic_vector(15 downto 0);
    instrucao : out std_logic_vector(31 downto 0)
  );
end entity;

architecture rtl of mem_instrucoes is
  constant F_ADD : std_logic_vector(5 downto 0) := "100000";
  constant F_SUB : std_logic_vector(5 downto 0) := "100010";
  constant F_AND : std_logic_vector(5 downto 0) := "100100";
  constant F_OR  : std_logic_vector(5 downto 0) := "100101";
  constant F_XOR : std_logic_vector(5 downto 0) := "100110";
  constant F_NOR : std_logic_vector(5 downto 0) := "100111";
  constant F_SLT : std_logic_vector(5 downto 0) := "101010";

  -- Monta uma instrucao tipo R: funct rd, rs, rt
  function tipo_r(funct : std_logic_vector(5 downto 0);
                  rd, rs, rt : natural) return std_logic_vector is
  begin
    return "000000"
         & std_logic_vector(to_unsigned(rs, 5))
         & std_logic_vector(to_unsigned(rt, 5))
         & std_logic_vector(to_unsigned(rd, 5))
         & "00000"
         & funct;
  end function;

  type rom_t is array (0 to 15) of std_logic_vector(31 downto 0);
  constant ROM : rom_t := (
    --                                  PC    instrucao            esperado
    0  => tipo_r(F_ADD,  9, 1, 2),   -- 0x00  add $9,  $1, $2   -> 0x000C
    1  => tipo_r(F_SUB, 10, 1, 2),   -- 0x04  sub $10, $1, $2   -> 0xFFFE
    2  => tipo_r(F_AND, 11, 5, 6),   -- 0x08  and $11, $5, $6   -> 0x0000 (Zero)
    3  => tipo_r(F_OR,  12, 5, 6),   -- 0x0C  or  $12, $5, $6   -> 0x0FFF
    4  => tipo_r(F_SLT, 13, 3, 4),   -- 0x10  slt $13, $3, $4   -> 0x0001
    5  => tipo_r(F_SLT, 14, 4, 3),   -- 0x14  slt $14, $4, $3   -> 0x0000 (Zero)
    6  => tipo_r(F_NOR, 15, 0, 0),   -- 0x18  nor $15, $0, $0   -> 0xFFFF
    7  => tipo_r(F_ADD, 16, 7, 8),   -- 0x1C  add $16, $7, $8   -> 0x8000 (Overflow)
    8  => tipo_r(F_SUB, 17, 1, 1),   -- 0x20  sub $17, $1, $1   -> 0x0000 (Zero, Cout)
    9  => tipo_r(F_ADD, 18, 9, 10),  -- 0x24  add $18, $9, $10  -> 0x000A (usa resultados)
    10 => tipo_r(F_XOR, 19, 5, 6),   -- 0x28  xor $19, $5, $6   -> 0x0FFF
    11 => tipo_r(F_ADD,  1, 1, 1),   -- 0x2C  add $1,  $1, $1   -> 0x000A (sobrescreve)
    12 => tipo_r(F_ADD,  0, 1, 2),   -- 0x30  add $0,  $1, $2   -> 0x0011 ($0 nao muda)
    13 => tipo_r(F_ADD, 20, 0, 1),   -- 0x34  add $20, $0, $1   -> 0x000A
    others => (others => '0')        -- 0x38, 0x3C: nop
  );
begin
  instrucao <= ROM(to_integer(unsigned(endereco(5 downto 2))));
end architecture;

-- ---------------------------------------------------------------------
-- BANCO_REGISTRADORES - 32 x 16 bits
-- 2 portas de leitura combinacionais (rs, rt), 1 porta de escrita
-- sincrona (rd, na borda de subida quando en = RegWrite = '1').
-- $0 e sempre zero. Porta extra de depuracao para ver qualquer
-- registrador na placa. rst recarrega os valores iniciais (nao ha LW).
-- ---------------------------------------------------------------------
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity banco_registradores is
  port (
    clk, rst, en   : in  std_logic;
    RegWrite       : in  std_logic;
    le_reg1        : in  std_logic_vector(4 downto 0);
    le_reg2        : in  std_logic_vector(4 downto 0);
    escreve_reg    : in  std_logic_vector(4 downto 0);
    escreve_dado   : in  std_logic_vector(15 downto 0);
    le_dado1       : out std_logic_vector(15 downto 0);
    le_dado2       : out std_logic_vector(15 downto 0);
    dbg_reg        : in  std_logic_vector(4 downto 0);
    dbg_dado       : out std_logic_vector(15 downto 0)
  );
end entity;

architecture rtl of banco_registradores is
  type regs_t is array (0 to 31) of std_logic_vector(15 downto 0);
  constant INICIAL : regs_t := (
    1 => x"0005",   --  5
    2 => x"0007",   --  7
    3 => x"FFFB",   -- -5
    4 => x"000C",   -- 12
    5 => x"00F0",   -- mascara
    6 => x"0F0F",   -- mascara
    7 => x"7FFF",   -- maior positivo (16 bits com sinal)
    8 => x"0001",   --  1
    others => x"0000"
  );
  signal regs : regs_t := INICIAL;
begin
  process (clk, rst)
  begin
    if rst = '1' then
      regs <= INICIAL;
    elsif rising_edge(clk) then
      if en = '1' and RegWrite = '1' and escreve_reg /= "00000" then
        regs(to_integer(unsigned(escreve_reg))) <= escreve_dado;
      end if;
    end if;
  end process;

  le_dado1 <= regs(to_integer(unsigned(le_reg1)));
  le_dado2 <= regs(to_integer(unsigned(le_reg2)));
  dbg_dado <= regs(to_integer(unsigned(dbg_reg)));
end architecture;

-- ---------------------------------------------------------------------
-- CONTROLE_ULA - funct -> ULACtl e RegWrite
-- Por enquanto so ha instrucoes tipo R (opcode 000000).
-- funct desconhecido (ex.: 000000) vira nop: RegWrite = '0'.
-- ---------------------------------------------------------------------
library ieee;
use ieee.std_logic_1164.all;

entity controle_ula is
  port (
    opcode   : in  std_logic_vector(5 downto 0);
    funct    : in  std_logic_vector(5 downto 0);
    ULACtl   : out std_logic_vector(2 downto 0);
    RegWrite : out std_logic
  );
end entity;

architecture rtl of controle_ula is
  signal valido : std_logic;
begin
  process (funct)
  begin
    valido <= '1';
    case funct is
      when "100000" => ULACtl <= "010";  -- add
      when "100010" => ULACtl <= "100";  -- sub
      when "100100" => ULACtl <= "000";  -- and
      when "100101" => ULACtl <= "001";  -- or
      when "100110" => ULACtl <= "011";  -- xor
      when "100111" => ULACtl <= "111";  -- nor
      when "101010" => ULACtl <= "110";  -- slt
      when others   => ULACtl <= "010"; valido <= '0';
    end case;
  end process;

  RegWrite <= valido when opcode = "000000" else '0';
end architecture;

-- ---------------------------------------------------------------------
-- DEBOUNCE - filtro dos botoes KEY
-- Sincroniza o botao com CLOCK_50 (2 flip-flops), so aceita mudanca de
-- nivel estavel por 2^20 ciclos (~21 ms) e gera um pulso de 1 ciclo
-- quando o botao e apertado. Os KEY da DE2-115 sao ativos em nivel baixo.
-- ---------------------------------------------------------------------
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity debounce is
  generic (N : natural := 20);
  port (
    clk     : in  std_logic;
    key_n   : in  std_logic;   -- botao cru (0 = apertado)
    nivel   : out std_logic;   -- 1 enquanto apertado (filtrado)
    pulso   : out std_logic    -- 1 por um ciclo ao apertar
  );
end entity;

architecture rtl of debounce is
  signal s1, s2   : std_logic := '0';
  signal estavel  : std_logic := '0';
  signal anterior : std_logic := '0';
  signal cont     : unsigned(N - 1 downto 0) := (others => '0');
begin
  process (clk)
  begin
    if rising_edge(clk) then
      s1 <= not key_n;
      s2 <= s1;
      if s2 = estavel then
        cont <= (others => '0');
      else
        cont <= cont + 1;
        if cont = (cont'range => '1') then
          estavel <= s2;
        end if;
      end if;
      anterior <= estavel;
    end if;
  end process;

  nivel <= estavel;
  pulso <= estavel and not anterior;
end architecture;

-- ---------------------------------------------------------------------
-- DATAPATH - ciclo unico, so tipo R (liga os blocos acima + ula)
--  PC -> memoria de instrucoes -> banco (rs, rt) -> ULA -> banco (rd)
--  PC -> +4 -> PC
-- A cada borda de subida de clk com en = '1' uma instrucao e executada:
-- o resultado e gravado em rd e o PC avanca, no mesmo ciclo.
-- ---------------------------------------------------------------------
library ieee;
use ieee.std_logic_1164.all;

entity datapath is
  port (
    clk, rst, en  : in  std_logic;
    dbg_reg       : in  std_logic_vector(4 downto 0);
    pc_atual      : out std_logic_vector(15 downto 0);
    instrucao     : out std_logic_vector(31 downto 0);
    dado1, dado2  : out std_logic_vector(15 downto 0);
    resultado     : out std_logic_vector(15 downto 0);
    zero          : out std_logic;
    overflow      : out std_logic;
    cout          : out std_logic;
    regwrite      : out std_logic;
    dbg_dado      : out std_logic_vector(15 downto 0)
  );
end entity;

architecture estrutural of datapath is
  signal s_pc, s_pc4       : std_logic_vector(15 downto 0);
  signal s_instr           : std_logic_vector(31 downto 0);
  signal s_d1, s_d2, s_res : std_logic_vector(15 downto 0);
  signal s_ctl             : std_logic_vector(2 downto 0);
  signal s_we              : std_logic;
begin
  u_pc : entity work.pc
    port map (clk => clk, rst => rst, en => en, pc_in => s_pc4, pc_out => s_pc);

  u_soma : entity work.somador_pc
    port map (a => s_pc, s => s_pc4);

  u_mem : entity work.mem_instrucoes
    port map (endereco => s_pc, instrucao => s_instr);

  u_ctl : entity work.controle_ula
    port map (opcode => s_instr(31 downto 26), funct => s_instr(5 downto 0),
              ULACtl => s_ctl, RegWrite => s_we);

  u_regs : entity work.banco_registradores
    port map (clk => clk, rst => rst, en => en, RegWrite => s_we,
              le_reg1     => s_instr(25 downto 21),   -- rs
              le_reg2     => s_instr(20 downto 16),   -- rt
              escreve_reg => s_instr(15 downto 11),   -- rd
              escreve_dado => s_res,
              le_dado1 => s_d1, le_dado2 => s_d2,
              dbg_reg => dbg_reg, dbg_dado => dbg_dado);

  u_ula : entity work.ula
    port map (A => s_d1, B => s_d2, ULACtl => s_ctl, R => s_res,
              Zero => zero, Overflow => overflow, Cout => cout);

  pc_atual  <= s_pc;
  instrucao <= s_instr;
  dado1     <= s_d1;
  dado2     <= s_d2;
  resultado <= s_res;
  regwrite  <= s_we;
end architecture;

-- ---------------------------------------------------------------------
-- DATAPATH_BOARD - top-level para a DE2-115
-- Entradas
--   KEY0       : executa 1 instrucao (clock manual, com debounce)
--   KEY1       : reset (PC = 0, registradores voltam ao valor inicial)
--   KEY2 (seg.): HEX3-0 mostra o dado de rs (operando A)
--   KEY3 (seg.): HEX3-0 mostra o dado de rt (operando B)
--   SW17       : 1 = modo "ver registrador" (escolhido em SW4-0)
--   SW16       : 1 = clock automatico (2 instrucoes por segundo)
--   SW15       : 1 = HEX7-0 mostram a instrucao inteira (32 bits)
--   SW14       : 1 = HEX3-0 mostra o operando A (igual a segurar KEY2)
--   SW13       : 1 = HEX3-0 mostra o operando B (igual a segurar KEY3)
--   SW4-0      : numero do registrador a ver no modo SW17 = 1
--   Prioridade nos displays: SW15 > SW17 > KEY2/SW14 > KEY3/SW13
-- Saidas
--   HEX7-6     : PC (byte, 00, 04, 08 ...)
--   HEX5-4     : numero do registrador mostrado (rd, rs, rt ou SW4-0)
--   HEX3-0     : resultado da ULA da instrucao atual (o que sera gravado
--                em rd no proximo KEY0), ou o valor escolhido acima
--   LEDG0..4   : Zero, Overflow, Cout, RegWrite, Negativo (R(15))
--   LEDG8      : acende enquanto KEY0 esta apertado (ja filtrado)
--   LEDR17..0  : bits 17..0 da instrucao atual (rd, shamt, funct)
-- O datapath roda em CLOCK_50 e o KEY0 vira um enable de 1 ciclo. Assim
-- cada aperto executa exatamente uma instrucao, mesmo com bouncing.
-- ---------------------------------------------------------------------
library ieee;
use ieee.std_logic_1164.all;

entity datapath_board is
  port (
    CLOCK_50 : in  std_logic;
    KEY      : in  std_logic_vector(3 downto 0);
    SW       : in  std_logic_vector(17 downto 0);
    HEX0, HEX1, HEX2, HEX3, HEX4, HEX5, HEX6, HEX7
             : out std_logic_vector(6 downto 0);
    LEDR     : out std_logic_vector(17 downto 0);
    LEDG     : out std_logic_vector(8 downto 0)
  );
end entity;

architecture rtl of datapath_board is
  signal passo, passo_nivel : std_logic;
  signal rst_s1, rst        : std_logic := '1';
  signal pc_v               : std_logic_vector(15 downto 0);
  signal instr              : std_logic_vector(31 downto 0);
  signal d1, d2, res, dbg   : std_logic_vector(15 downto 0);
  signal z, ov, co, we      : std_logic;
  signal mostra_valor       : std_logic_vector(15 downto 0);
  signal mostra_reg         : std_logic_vector(4 downto 0);
  signal reg8               : std_logic_vector(7 downto 0);
  signal hexv               : std_logic_vector(31 downto 0);  -- HEX7..HEX0
  -- clock automatico (SW16): pulso de 1 ciclo a cada 0,5 s
  constant DIV_AUTO         : natural := 25_000_000;
  signal cont_auto          : natural range 0 to DIV_AUTO - 1 := 0;
  signal tique, en_dp       : std_logic := '0';
begin
  u_db : entity work.debounce
    port map (clk => CLOCK_50, key_n => KEY(0), nivel => passo_nivel, pulso => passo);

  -- reset sincronizado (KEY1 ativo em nivel baixo)
  process (CLOCK_50)
  begin
    if rising_edge(CLOCK_50) then
      rst_s1 <= not KEY(1);
      rst    <= rst_s1;
    end if;
  end process;

  -- divisor do clock automatico: conta sempre, so gera o pulso com SW16 = 1
  process (CLOCK_50)
  begin
    if rising_edge(CLOCK_50) then
      tique <= '0';
      if cont_auto = DIV_AUTO - 1 then
        cont_auto <= 0;
        tique     <= SW(16);
      else
        cont_auto <= cont_auto + 1;
      end if;
    end if;
  end process;

  -- KEY0 continua funcionando junto com o clock automatico
  en_dp <= passo or tique;

  u_dp : entity work.datapath
    port map (clk => CLOCK_50, rst => rst, en => en_dp,
              dbg_reg => SW(4 downto 0),
              pc_atual => pc_v, instrucao => instr,
              dado1 => d1, dado2 => d2, resultado => res,
              zero => z, overflow => ov, cout => co, regwrite => we,
              dbg_dado => dbg);

  -- selecao do que aparece nos displays
  process (SW, KEY, instr, d1, d2, res, dbg)
  begin
    if SW(17) = '1' then
      mostra_reg <= SW(4 downto 0);      mostra_valor <= dbg;
    elsif KEY(2) = '0' or SW(14) = '1' then
      mostra_reg <= instr(25 downto 21); mostra_valor <= d1;
    elsif KEY(3) = '0' or SW(13) = '1' then
      mostra_reg <= instr(20 downto 16); mostra_valor <= d2;
    else
      mostra_reg <= instr(15 downto 11); mostra_valor <= res;
    end if;
  end process;

  reg8 <= "000" & mostra_reg;

  -- SW15 = 1: os 8 displays mostram a instrucao; senao PC | reg | valor
  hexv <= instr when SW(15) = '1' else pc_v(7 downto 0) & reg8 & mostra_valor;

  h0 : entity work.hex7seg port map (hexv(3 downto 0),   HEX0);
  h1 : entity work.hex7seg port map (hexv(7 downto 4),   HEX1);
  h2 : entity work.hex7seg port map (hexv(11 downto 8),  HEX2);
  h3 : entity work.hex7seg port map (hexv(15 downto 12), HEX3);
  h4 : entity work.hex7seg port map (hexv(19 downto 16), HEX4);
  h5 : entity work.hex7seg port map (hexv(23 downto 20), HEX5);
  h6 : entity work.hex7seg port map (hexv(27 downto 24), HEX6);
  h7 : entity work.hex7seg port map (hexv(31 downto 28), HEX7);

  LEDG(0) <= z;
  LEDG(1) <= ov;
  LEDG(2) <= co;
  LEDG(3) <= we;
  LEDG(4) <= res(15);                    -- Negativo
  LEDG(7 downto 5) <= (others => '0');
  LEDG(8) <= passo_nivel;
  LEDR    <= instr(17 downto 0);
end architecture;
