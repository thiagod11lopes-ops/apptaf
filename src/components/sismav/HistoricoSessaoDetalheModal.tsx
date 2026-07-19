import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Sparkles } from 'lucide-react-native';
import { AppModal } from '../premium/AppModal';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import {
  tituloTipoProva,
  type SessaoAplicacaoTaf,
} from '../../services/resultadosAplicadosIndexedDb';
import type { ResultadoCorridaItem } from '../../navigation/types';
import { formatMsByModality } from '../../taf/tafTimeFormat';
import { PERMANENCIA_TEMPO_PDF_PADRAO } from '../../utils/exportResultadosTafPdf';
import { RubricaCell } from '../RubricaThumb';
import { AplicadorAssinaturaBloco } from '../AplicadorAssinaturaBloco';

type Props = {
  sessao: SessaoAplicacaoTaf | null;
  onClose: () => void;
};

function desempenhoParticipante(
  tipo: SessaoAplicacaoTaf['tipoProva'],
  r: ResultadoCorridaItem,
): string {
  const texto = r.desempenhoTexto?.trim();
  if (texto) return texto;
  if (tipo === 'permanencia') return PERMANENCIA_TEMPO_PDF_PADRAO;
  const mod = tipo === 'natacao' ? 'natacao' : 'corrida';
  return formatMsByModality(mod, r.tempoMs) || '—';
}

function notaParticipante(r: ResultadoCorridaItem): string {
  const t = (r.notaTexto ?? r.noraTexto ?? '').trim();
  return t || '—';
}

function situacaoParticipante(r: ResultadoCorridaItem): { label: string; tone: 'ok' | 'bad' | 'muted' } {
  if (r.reprovacaoTexto?.trim()) return { label: r.reprovacaoTexto.trim(), tone: 'bad' };
  const nota = (r.notaTexto ?? '').trim();
  const upper = nota.toUpperCase();
  if (upper === 'REPROVADO') return { label: 'Reprovado', tone: 'bad' };
  if (nota.toLowerCase() === 'aprovado') return { label: 'Aprovado', tone: 'ok' };
  if (nota.toLowerCase() === 'reprovado') return { label: 'Reprovado', tone: 'bad' };
  if (nota) return { label: 'Aprovado', tone: 'ok' };
  return { label: '—', tone: 'muted' };
}

/** Modal ultramoderno com tabela dos resultados de uma sessão do histórico. */
export function HistoricoSessaoDetalheModal({ sessao, onClose }: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const visible = sessao != null;

  const titulo = sessao ? tituloTipoProva(sessao.tipoProva) : '';
  const colDesempenho =
    sessao?.tipoProva === 'permanencia' || sessao?.resultados.some((r) => r.desempenhoTexto?.trim())
      ? 'Desempenho'
      : 'Tempo';

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(2,6,23,0.72)', 'rgba(15,23,42,0.88)']}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.isDark ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.98)',
              borderColor: theme.isDark ? 'rgba(56,189,248,0.35)' : 'rgba(37,99,235,0.22)',
              ...(Platform.OS === 'web'
                ? ({ boxShadow: '0 28px 70px rgba(2,6,23,0.45)' } as object)
                : null),
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(37,99,235,0.22)', 'rgba(56,189,248,0.06)', 'transparent']}
            style={styles.glow}
          />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.kickerRow}>
                <Sparkles size={12} color="#38bdf8" strokeWidth={2.4} />
                <Text style={styles.kicker}>HISTÓRICO</Text>
              </View>
              <Text style={[styles.title, { color: ui.text }]} numberOfLines={2}>
                {titulo}
              </Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {sessao?.dataAplicacao ?? '—'}
                {sessao
                  ? ` · ${sessao.resultados.length} participante${sessao.resultados.length !== 1 ? 's' : ''}`
                  : ''}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Fechar"
              accessibilityRole="button"
              onPress={onClose}
              style={[
                styles.closeBtn,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : 'rgba(248,250,252,0.9)',
                },
              ]}
            >
              <X size={18} color={theme.textSecondary} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
              <View style={styles.table}>
                <View
                  style={[
                    styles.tr,
                    styles.thead,
                    {
                      borderBottomColor: theme.isDark
                        ? 'rgba(56,189,248,0.28)'
                        : 'rgba(37,99,235,0.18)',
                      backgroundColor: theme.isDark
                        ? 'rgba(14,165,233,0.1)'
                        : 'rgba(37,99,235,0.06)',
                    },
                  ]}
                >
                  <Text style={[styles.th, styles.colNum, { color: theme.textMuted }]}>#</Text>
                  <Text style={[styles.th, styles.colNome, { color: theme.textMuted }]}>Nome</Text>
                  <Text style={[styles.th, styles.colNip, { color: theme.textMuted }]}>NIP</Text>
                  <Text style={[styles.th, styles.colTempo, { color: theme.textMuted }]}>
                    {colDesempenho}
                  </Text>
                  <Text style={[styles.th, styles.colNota, { color: theme.textMuted }]}>Nota</Text>
                  <Text style={[styles.th, styles.colSit, { color: theme.textMuted }]}>Situação</Text>
                  <Text style={[styles.th, styles.colRubrica, { color: theme.textMuted }]}>
                    Rúbrica
                  </Text>
                </View>

                {(sessao?.resultados ?? []).map((r, idx) => {
                  const sit = situacaoParticipante(r);
                  const sitColor =
                    sit.tone === 'ok'
                      ? theme.gain
                      : sit.tone === 'bad'
                        ? theme.loss
                        : theme.textMuted;
                  return (
                    <View
                      key={`${sessao?.id}-${r.corredor}-${idx}`}
                      style={[
                        styles.tr,
                        {
                          borderBottomColor: theme.isDark
                            ? 'rgba(148,163,184,0.12)'
                            : 'rgba(148,163,184,0.2)',
                          backgroundColor:
                            idx % 2 === 0
                              ? 'transparent'
                              : theme.isDark
                                ? 'rgba(2,6,23,0.35)'
                                : 'rgba(248,250,252,0.85)',
                        },
                      ]}
                    >
                      <Text style={[styles.td, styles.colNum, { color: theme.textMuted }]}>
                        {r.corredor || idx + 1}
                      </Text>
                      <Text
                        style={[styles.td, styles.colNome, { color: ui.text }]}
                        numberOfLines={2}
                      >
                        {r.nome?.trim() || '—'}
                      </Text>
                      <Text style={[styles.td, styles.colNip, { color: ui.text }]} numberOfLines={1}>
                        {r.nip?.trim() || '—'}
                      </Text>
                      <Text
                        style={[styles.td, styles.colTempo, { color: ui.text }]}
                        numberOfLines={1}
                      >
                        {sessao ? desempenhoParticipante(sessao.tipoProva, r) : '—'}
                      </Text>
                      <Text style={[styles.td, styles.colNota, { color: ui.text }]} numberOfLines={1}>
                        {notaParticipante(r)}
                      </Text>
                      <Text
                        style={[styles.td, styles.colSit, { color: sitColor, fontWeight: '800' }]}
                        numberOfLines={2}
                      >
                        {sit.label}
                      </Text>
                      <View style={[styles.td, styles.colRubrica, styles.rubricaCell]}>
                        <RubricaCell
                          svgUri={r.rubricaCandidatoSvg}
                          maxWidth={110}
                          maxHeight={44}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {sessao?.aplicadorAssinatura ? (
              <View style={styles.aplicadorWrap}>
                <Text style={[styles.aplicadorLabel, { color: theme.textMuted }]}>
                  ASSINATURA DO APLICADOR
                </Text>
                <AplicadorAssinaturaBloco assinatura={sessao.aplicadorAssinatura} />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 920,
    maxHeight: '92%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: '#38bdf8',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  table: {
    minWidth: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  thead: {
    minHeight: 42,
  },
  th: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  td: {
    fontSize: 13,
    fontWeight: '700',
    paddingRight: 8,
  },
  colNum: { width: 36 },
  colNome: { width: 180 },
  colNip: { width: 100 },
  colTempo: { width: 88 },
  colNota: { width: 72 },
  colSit: { width: 96 },
  colRubrica: { width: 120 },
  rubricaCell: {
    justifyContent: 'center',
    paddingRight: 0,
  },
  aplicadorWrap: {
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.25)',
  },
  aplicadorLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
