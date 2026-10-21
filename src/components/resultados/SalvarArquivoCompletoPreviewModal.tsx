import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Download, FileText, History, Search, X } from 'lucide-react-native';
import { ModernModal } from '../sismav/ModernModal';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import type { ResultadosTafPdfBloco } from '../../utils/resultadosTafPdfPorAplicador';
import type { ResultadoTafLinha } from '../../utils/resultadoTafCadastro';
import {
  colunasDistanciaPdfVisiveis,
  valoresCorridaCaminhadaParaPdf,
} from '../../utils/corridaCaminhadaExcludente';
import { HistoricoResultadosSubstituidosModal } from './HistoricoResultadosSubstituidosModal';
import { nipDigitos } from '../../utils/nipFormat';

type Props = {
  visible: boolean;
  onClose: () => void;
  blocos: ResultadosTafPdfBloco[];
  subtitulo: string;
  salvando?: boolean;
  onConfirmarSalvar: () => void;
};

function celula(v: string | undefined): string {
  const t = (v ?? '').trim();
  return t || '—';
}

function PreviewRow({
  linha,
  mostrarCorrida,
  mostrarCaminhada,
  theme,
  onHistorico,
}: {
  linha: ResultadoTafLinha;
  mostrarCorrida: boolean;
  mostrarCaminhada: boolean;
  theme: ReturnType<typeof useTheme>['theme'];
  onHistorico: (linha: ResultadoTafLinha) => void;
}) {
  const dist = valoresCorridaCaminhadaParaPdf(linha);
  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.nome, { color: theme.text }]} numberOfLines={2}>
            {celula(linha.nome)}
          </Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {celula(linha.postoGrad)} · NIP {celula(linha.nip)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onHistorico(linha)}
          style={[styles.histBtn, { borderColor: theme.border }]}
          accessibilityLabel={`Histórico substituído de ${linha.nome}`}
        >
          <History size={15} color={theme.primary} strokeWidth={2.4} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {mostrarCorrida ? (
          <Text style={[styles.cell, { color: theme.text }]}>
            Corrida: {celula(dist.notaCorrida)} · {celula(dist.situacaoCorrida)}
            {dist.tempoCorrida ? ` · ${dist.tempoCorrida}` : ''}
          </Text>
        ) : null}
        {mostrarCaminhada ? (
          <Text style={[styles.cell, { color: theme.text }]}>
            Caminhada: {celula(dist.notaCaminhada)} · {celula(dist.situacaoCaminhada)}
            {dist.tempoCaminhada ? ` · ${dist.tempoCaminhada}` : ''}
          </Text>
        ) : null}
        <Text style={[styles.cell, { color: theme.text }]}>
          Natação: {celula(linha.notaNatacao)} · {celula(linha.situacaoNatacao)}
          {linha.tempoNatacao ? ` · ${linha.tempoNatacao}` : ''}
        </Text>
        <Text style={[styles.cell, { color: theme.text }]}>
          Permanência: {celula(linha.situacaoPermanencia)}
          {linha.permanenciaTempo ? ` · ${linha.permanenciaTempo}` : ''}
        </Text>
      </View>
    </View>
  );
}

function isBuscaPorNip(busca: string): boolean {
  const raw = busca.trim();
  if (!raw) return false;
  const digits = nipDigitos(raw);
  if (digits.length < 2) return false;
  // NIP é só dígitos (com ou sem pontos/espaços) — não mistura com nome.
  return /^[\d.\s-]+$/.test(raw);
}

function temValorResultado(valor: string | undefined): boolean {
  const t = (valor || '').trim();
  return !!t && t !== '—';
}

/** Quantos resultados de prova (modalidades) a linha traz para o militar. */
function contarResultadosNaLinha(linha: ResultadoTafLinha): number {
  let n = 0;
  if (temValorResultado(linha.notaCorrida) || temValorResultado(linha.situacaoCorrida)) n += 1;
  if (temValorResultado(linha.notaCaminhada) || temValorResultado(linha.situacaoCaminhada)) n += 1;
  if (temValorResultado(linha.notaNatacao) || temValorResultado(linha.situacaoNatacao)) n += 1;
  if (
    temValorResultado(linha.situacaoPermanencia) ||
    temValorResultado(linha.permanenciaTempo)
  ) {
    n += 1;
  }
  if (temValorResultado(linha.notaFlexaoBarra) || temValorResultado(linha.situacaoFlexaoBarra)) {
    n += 1;
  }
  if (temValorResultado(linha.notaFlexaoSolo) || temValorResultado(linha.situacaoFlexaoSolo)) {
    n += 1;
  }
  if (
    temValorResultado(linha.notaAbdominalRemador) ||
    temValorResultado(linha.situacaoAbdominalRemador)
  ) {
    n += 1;
  }
  if (
    temValorResultado(linha.notaAbdominalPrancha) ||
    temValorResultado(linha.situacaoAbdominalPrancha)
  ) {
    n += 1;
  }
  return n;
}

function linhaCombinaBusca(
  linha: ResultadoTafLinha,
  q: string,
  qDigits: string,
  porNip: boolean,
): boolean {
  if (!q) return true;
  const nip = nipDigitos(linha.nip);
  if (porNip) {
    if (!qDigits || !nip) return false;
    // NIP completo: só o militar daquele NIP.
    if (qDigits.length >= 8) return nip === qDigits.slice(0, 8) || nip === qDigits;
    return nip.includes(qDigits);
  }
  const nome = (linha.nome || '').toLowerCase();
  const posto = (linha.postoGrad || '').toLowerCase();
  return nome.includes(q) || posto.includes(q);
}

export function SalvarArquivoCompletoPreviewModal({
  visible,
  onClose,
  blocos,
  subtitulo,
  salvando = false,
  onConfirmarSalvar,
}: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const ts = theme.textStyles;
  const [busca, setBusca] = useState('');
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [focoHistorico, setFocoHistorico] = useState<{
    nip?: string;
    cadastroId?: string;
    nome?: string;
  } | null>(null);

  useEffect(() => {
    if (!visible) setBusca('');
  }, [visible]);

  const todasLinhas = useMemo(() => blocos.flatMap((b) => b.linhas), [blocos]);
  const { mostrarCorrida, mostrarCaminhada } = useMemo(
    () => colunasDistanciaPdfVisiveis(todasLinhas),
    [todasLinhas],
  );

  const buscaPorNip = useMemo(() => isBuscaPorNip(busca), [busca]);

  const blocosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDigits = nipDigitos(busca);
    if (!q) return blocos;
    return blocos
      .map((bloco) => ({
        ...bloco,
        linhas: bloco.linhas.filter((linha) =>
          linhaCombinaBusca(linha, q, qDigits, buscaPorNip),
        ),
      }))
      .filter((bloco) => bloco.linhas.length > 0);
  }, [blocos, busca, buscaPorNip]);

  const resumoBusca = useMemo(() => {
    if (!busca.trim()) return null;
    const linhas = blocosFiltrados.flatMap((b) => b.linhas);
    if (linhas.length === 0) {
      return buscaPorNip
        ? 'Nenhum resultado encontrado para esse NIP.'
        : 'Nenhum militar encontrado para essa pesquisa.';
    }

    const porNip = new Map<string, ResultadoTafLinha[]>();
    for (const linha of linhas) {
      const key = nipDigitos(linha.nip) || linha.id;
      const list = porNip.get(key) ?? [];
      list.push(linha);
      porNip.set(key, list);
    }

    // Um NIP = um militar: conta resultados de prova desse militar.
    if (porNip.size === 1) {
      const militarLinhas = Array.from(porNip.values())[0]!;
      const totalResultados = militarLinhas.reduce(
        (acc, linha) => acc + contarResultadosNaLinha(linha),
        0,
      );
      const qtd = totalResultados > 0 ? totalResultados : militarLinhas.length;
      const nome = (militarLinhas[0]?.nome || '').trim();
      const nipFmt = (militarLinhas[0]?.nip || '').trim();
      const quem =
        nome && nome !== '—'
          ? nome
          : nipFmt
            ? `NIP ${nipFmt}`
            : 'esse militar';
      return `${qtd} resultado${qtd !== 1 ? 's' : ''} encontrado${qtd !== 1 ? 's' : ''} para ${quem}`;
    }

    return `${porNip.size} militares encontrados`;
  }, [blocosFiltrados, busca, buscaPorNip]);

  const abrirHistoricoGeral = useCallback(() => {
    setFocoHistorico(null);
    setHistoricoAberto(true);
  }, []);

  const abrirHistoricoMilitar = useCallback((linha: ResultadoTafLinha) => {
    setFocoHistorico({ nip: linha.nip, cadastroId: linha.id, nome: linha.nome });
    setHistoricoAberto(true);
  }, []);

  const footer = (
    <View style={styles.footerCol}>
      <TouchableOpacity
        onPress={abrirHistoricoGeral}
        disabled={salvando}
        style={[styles.secondaryBtn, { borderColor: theme.border, opacity: salvando ? 0.55 : 1 }]}
        accessibilityLabel="Ver histórico de resultados substituídos"
      >
        <History size={16} color={theme.primary} strokeWidth={2.4} />
        <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>
          Histórico de cada militar
        </Text>
      </TouchableOpacity>
      <View style={styles.footerRow}>
        <TouchableOpacity
          onPress={onClose}
          disabled={salvando}
          style={[styles.ghostBtn, { borderColor: theme.border, opacity: salvando ? 0.55 : 1 }]}
        >
          <Text style={[styles.ghostBtnText, { color: theme.textSecondary }]}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onConfirmarSalvar}
          disabled={salvando || blocos.length === 0}
          activeOpacity={0.88}
          style={[styles.saveOuter, { opacity: salvando || blocos.length === 0 ? 0.65 : 1 }]}
          accessibilityLabel="Salvar PDF do arquivo completo"
        >
          <LinearGradient
            colors={[...theme.tokens.gradientPrimaryBtn]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtn}
          >
            {salvando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Download size={16} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.saveBtnText}>Salvar PDF</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <ModernModal
        visible={visible}
        onClose={() => {
          if (!salvando) onClose();
        }}
        title="Pré-visualização do arquivo completo"
        icon={<FileText size={20} color="#FFFFFF" strokeWidth={2.2} />}
        footer={footer}
        fullScreen
        dismissable={!salvando}
      >
        <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 10 }]}>
          {subtitulo}
        </Text>
        <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 12 }]}>
          Confira a tabela que será impressa no PDF. Use o histórico para ver resultados anteriores
          que foram substituídos.
        </Text>

        {blocos.length > 0 ? (
          <View
            style={[
              styles.buscaWrap,
              { backgroundColor: theme.cardBg, borderColor: ui.inputBorder },
            ]}
          >
            <Search size={16} color={theme.textMuted} strokeWidth={2.2} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Pesquisar por NIP ou nome do militar"
              placeholderTextColor={theme.textMuted}
              style={[styles.buscaInput, { color: ui.text }]}
              accessibilityLabel="Pesquisar por NIP ou nome do militar"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {busca.trim() ? (
              <TouchableOpacity
                onPress={() => setBusca('')}
                accessibilityLabel="Limpar pesquisa"
                hitSlop={8}
              >
                <X size={16} color={theme.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {resumoBusca ? (
          <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 10 }]}>
            {resumoBusca}
          </Text>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {blocos.length === 0 ? (
            <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center' }]}>
              Não há resultados para exportar.
            </Text>
          ) : blocosFiltrados.length === 0 ? (
            <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center' }]}>
              Nenhum militar encontrado para essa pesquisa.
            </Text>
          ) : (
            blocosFiltrados.map((bloco, bi) => (
              <View key={`${bloco.rotuloAplicador}-${bi}`} style={styles.bloco}>
                <View
                  style={[
                    styles.blocoHeader,
                    { backgroundColor: theme.primary + '18', borderColor: theme.primary + '44' },
                  ]}
                >
                  <Text style={[styles.blocoTitle, { color: theme.primary }]}>
                    {bloco.rotuloAplicador}
                  </Text>
                  <Text style={[ts.caption, { color: theme.textMuted }]}>
                    {bloco.linhas.length} militar{bloco.linhas.length !== 1 ? 'es' : ''}
                  </Text>
                </View>
                {bloco.linhas.map((linha) => (
                  <PreviewRow
                    key={`${bloco.rotuloAplicador}-${linha.id}-${linha.nip}`}
                    linha={linha}
                    mostrarCorrida={mostrarCorrida}
                    mostrarCaminhada={mostrarCaminhada}
                    theme={theme}
                    onHistorico={abrirHistoricoMilitar}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </ModernModal>

      <HistoricoResultadosSubstituidosModal
        visible={historicoAberto}
        onClose={() => {
          setHistoricoAberto(false);
          setFocoHistorico(null);
        }}
        foco={focoHistorico}
      />
    </>
  );
}

const styles = StyleSheet.create({
  buscaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  buscaInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  scroll: { flexGrow: 0, maxHeight: Platform.OS === 'web' ? 560 : 480 },
  scrollContent: { paddingBottom: 8, gap: 14 },
  bloco: { gap: 8 },
  blocoHeader: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  blocoTitle: { fontSize: 14, fontWeight: '800' },
  row: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 12,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  nome: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  histBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { gap: 3 },
  cell: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  footerCol: { width: '100%', gap: 10 },
  footerRow: { flexDirection: 'row', gap: 10, width: '100%' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '800' },
  ghostBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '700' },
  saveOuter: { flex: 1.3, borderRadius: 12, overflow: 'hidden' },
  saveBtn: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
