# Módulo TAF

## Formatação de tempos

`tafTimeFormat.ts` — `formatMsByModality`, `parseTafPerformanceInput`, etc.

- **Corrida:** exibição `MM:SS`.
- **Natação:** exibição `N S` (segundos inteiros + espaço + `S` maiúsculo, ex.: `60 S`).

## Corrida 2400 m — notas (50 a 100), feminino e masculino

`corrida2400Nota.ts` — tabelas por **faixa etária** (18–25 … 46–50 anos). Os limites numéricos coincidem com a norma em ambos os sexos (faixas “acima de X até Y” no feminino equivalem à mesma classificação por limite superior).

- `textoNotaCorrida(tempoMs, idadeAnos, sexo?)` — `"100"`…`"50"`, `"REPROVADO"` ou `"—"`.
- `notaCorrida2400(tempoMs, idadeAnos)` — resultado estruturado.

Aliases legados: `textoNotaCorridaMasculina`, `notaCorrida2400Masculino`, `faixaEtariaCorridaMasculina`.

Integração: **Aplicar TAF** (coluna Nota + `notaCorrida` no cadastro) e planilha do **Registrador de TAF**.

## Natação — notas (50 a 100), feminino e masculino

`natacaoNota.ts` — duas tabelas (F e M), tempos em **segundos** como limites máximos por nota e faixa etária (18–25 … 46–50). `sexo` indefinido usa a **tabela masculina**.

- `textoNotaNatacao(tempoMs, idadeAnos, sexo)` — `"100"`…`"50"`, `"REPROVADO"` ou `"—"`.
- `notaNatacao(tempoMs, idadeAnos, sexo)` — resultado estruturado.

Aliases legados: `textoNotaNatacaoFeminina`, `notaNatacaoFeminina`.

Integração: **Aplicar TAF** (coluna Nota + `notaNatacao` no cadastro), coluna **Nota nat.** na planilha do Registrador de TAF.
