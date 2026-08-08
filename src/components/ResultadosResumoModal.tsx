import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, X, BarChart3 } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { AppModal } from './premium/AppModal';
import { getAplicarTafGlass } from './taf/aplicar/aplicarTafTheme';
import { PREMIUM } from '../theme/premium';
import { getUiColors } from '../theme/uiColors';
import {
  tituloTipoProva,
  type SessaoAplicacaoTaf,
  type TipoProvaAplicada,
} from '../services/resultadosAplicadosIndexedDb';
import {
  gradeCalendarioMes,
  sessoesDoDiaIso,
  tituloMesAno,
  isoHojeLocal,
  mapaSessoesPorDiaIso,
} from '../utils/historicoPorDia';
import { inferNormaSessao } from '../utils/normaTafResultados';
import { isDemoSessaoId } from '../utils/gatherSystemBackupData';

/* ─── tipos ─── */
type NormaKey = 'armada' | 'cfn';

const MODALIDADES_ARMADA: TipoProvaAplicada[] = ['corrida', 'caminhada', 'natacao', 'permanencia'];
const MODALIDADES_CFN: TipoProvaAplicada[] = [
  'flexao_barra',
  'flexao_solo',
  'abdominal_remador',
  'abdominal_prancha',
  'natacao',
  'permanencia',
];

/* ─── helpers ─── */
function contarParticipantes(sessoes: SessaoAplicacaoTaf[]): number {
  const nips = new Set<string>();
  for (const s of sessoes) {
    for (const r of s.resultados) {
      const chave = (r.nip ?? '').trim() || (r.nome ?? '').trim().toLowerCase();
      if (chave) nips.add(chave);
    }
  }
  return nips.size;
}

function primeiroIsoComSessao(sessoes: SessaoAplicacaoTaf[]): string | null {
  const isos: string[] = [];
  for (const s of sessoes) {
    const iso = isoFromBr(s.dataAplicacao);
    if (iso) isos.push(iso);
  }
  isos.sort();
  return isos[0] ?? null;
}

function ultimoIsoComSessao(sessoes: SessaoAplicacaoTaf[]): string | null {
  const isos: string[] = [];
  for (const s of sessoes) {
    const iso = isoFromBr(s.dataAplicacao);
    if (iso) isos.push(iso);
  }
  isos.sort();
  return isos[isos.length - 1] ?? null;
}

function isoFromBr(dataBr: string): string | null {
  if (!dataBr) return null;
  const p = dataBr.split('/');
  if (p.length !== 3) return null;
  return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
}

function anoMesDe(iso: string): { ano: number; mes: number } {
  const [y, m] = iso.split('-').map(Number);
  return { ano: y, mes: m - 1 };
}

function isoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}`;
}

/* ─── sub-componente: bloco por modalidade ─── */
function ModalidadeRow({
  tipo,
  sessoes,
  accentColor,
}: {
  tipo: TipoProvaAplicada;
  sessoes: SessaoAplicacaoTaf[];
  accentColor: string;
}) {
  const { theme } = useTheme();
  const glass = getAplicarTafGlass(theme);
  const filtradas = sessoes.filter((s) => s.tipoProva === tipo);
  if (filtradas.length === 0) return null;
  const participantes = contarParticipantes(filtradas);
  return (
    <View style={[styles.modalidadeRow, { borderColor: glass.border }]}>
      <View style={[styles.modalidadeAccent, { backgroundColor: accentColor }]} />
      <View style={styles.modalidadeInfo}>
        <Text style={[styles.modalidadeLabel, { color: theme.textSecondary }]}>
          {tituloTipoProva(tipo)}
        </Text>
        <View style={styles.modalidadeNums}>
          <Text style={[styles.modalidadeNum, { color: theme.text }]}>
            {participantes}
            <Text style={[styles.modalidadeNumUnit, { color: theme.textMuted }]}>
              {' '}
              {participantes === 1 ? 'participante' : 'participantes'}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ─── sub-componente: bloco por norma ─── */
function NormaSection({
  norma,
  sessoes,
}: {
  norma: NormaKey;
  sessoes: SessaoAplicacaoTaf[];
}) {
  const { theme } = useTheme();
  const glass = getAplicarTafGlass(theme);
  const isCfn = norma === 'cfn';
  const accentColor = isCfn ? '#F59E0B' : theme.primary;
  const totalPart = contarParticipantes(sessoes);
  const modalidades = isCfn ? MODALIDADES_CFN : MODALIDADES_ARMADA;

  return (
    <View style={[styles.normaSection, { borderColor: accentColor + '55' }]}>
      <View style={[styles.normaSectionHeader, { borderBottomColor: glass.border }]}>
        <View style={[styles.normaBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.normaBadgeText}>{isCfn ? 'CFN' : 'ARMADA'}</Text>
        </View>
        <View style={styles.normaTotals}>
          <Text style={[styles.normaTotalNum, { color: theme.text }]}>
            {totalPart}
            <Text style={[styles.normaTotalUnit, { color: theme.textMuted }]}>
              {' '}{totalPart === 1 ? 'participante único' : 'participantes únicos'}
            </Text>
          </Text>
        </View>
      </View>
      <View style={styles.modalidadesList}>
        {modalidades.map((tipo) => (
          <ModalidadeRow
            key={tipo}
            tipo={tipo}
            sessoes={sessoes}
            accentColor={accentColor}
          />
        ))}
      </View>
    </View>
  );
}

/* ─── sub-componente: calendário ─── */
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function CalendarioResumo({
  sessoes,
  sessoesCfn,
  sessoesArmada,
}: {
  sessoes: SessaoAplicacaoTaf[];
  sessoesArmada: SessaoAplicacaoTaf[];
  sessoesCfn: SessaoAplicacaoTaf[];
}) {
  const { theme } = useTheme();
  const glass = getAplicarTafGlass(theme);
  const ui = getUiColors(theme);

  const hoje = isoHojeLocal();
  const [diaAtivo, setDiaAtivo] = useState<string | null>(null);

  const defaultMes = useMemo(() => {
    const ultimo = ultimoIsoComSessao(sessoes);
    if (ultimo) return anoMesDe(ultimo);
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  }, [sessoes]);

  const [{ ano, mes }, setMes] = useState(defaultMes);

  const mapaAll = useMemo(() => mapaSessoesPorDiaIso(sessoes), [sessoes]);
  const mapaArmada = useMemo(() => mapaSessoesPorDiaIso(sessoesArmada), [sessoesArmada]);
  const mapaCfn = useMemo(() => mapaSessoesPorDiaIso(sessoesCfn), [sessoesCfn]);

  const grade = useMemo(() => gradeCalendarioMes(ano, mes), [ano, mes]);

  const primIso = useMemo(() => primeiroIsoComSessao(sessoes), [sessoes]);
  const ultIso = useMemo(() => ultimoIsoComSessao(sessoes), [sessoes]);

  const podeAnterior = useMemo(() => {
    if (!primIso) return false;
    const prim = anoMesDe(primIso);
    return isoMes(ano, mes) > isoMes(prim.ano, prim.mes);
  }, [ano, mes, primIso]);

  const podePosterior = useMemo(() => {
    const limiteIso = ultIso ?? hoje;
    const lim = anoMesDe(limiteIso);
    const limMes = isoMes(lim.ano, lim.mes) > isoHojeLocal().slice(0, 7)
      ? isoMes(lim.ano, lim.mes)
      : isoHojeLocal().slice(0, 7);
    return isoMes(ano, mes) < limMes;
  }, [ano, mes, ultIso, hoje]);

  const irAnterior = () => {
    if (mes === 0) setMes({ ano: ano - 1, mes: 11 });
    else setMes({ ano, mes: mes - 1 });
    setDiaAtivo(null);
  };
  const irPosterior = () => {
    if (mes === 11) setMes({ ano: ano + 1, mes: 0 });
    else setMes({ ano, mes: mes + 1 });
    setDiaAtivo(null);
  };

  const sessoesAtivas = useMemo(
    () => (diaAtivo ? sessoesDoDiaIso(sessoes, diaAtivo) : []),
    [sessoes, diaAtivo],
  );

  return (
    <View>
      {/* cabeçalho do mês */}
      <View style={styles.calHeader}>
        <TouchableOpacity
          onPress={irAnterior}
          disabled={!podeAnterior}
          style={[styles.calNavBtn, { borderColor: glass.border, opacity: podeAnterior ? 1 : 0.3 }]}
        >
          <ChevronLeft size={16} color={theme.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={[styles.calTitulo, { color: theme.text }]}>
          {tituloMesAno(ano, mes)}
        </Text>
        <TouchableOpacity
          onPress={irPosterior}
          disabled={!podePosterior}
          style={[styles.calNavBtn, { borderColor: glass.border, opacity: podePosterior ? 1 : 0.3 }]}
        >
          <ChevronRight size={16} color={theme.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* cabeçalho dias da semana */}
      <View style={styles.calDiasSemana}>
        {DIAS_SEMANA.map((d, i) => (
          <Text key={i} style={[styles.calDiaSemLabel, { color: theme.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* grade */}
      <View style={styles.calGrade}>
        {grade.map((cel, i) => {
          if (!cel.iso) return <View key={i} style={styles.calCell} />;
          const temArmada = (mapaArmada.get(cel.iso)?.length ?? 0) > 0;
          const temCfn = (mapaCfn.get(cel.iso)?.length ?? 0) > 0;
          const temTeste = temArmada || temCfn;
          const selecionado = cel.iso === diaAtivo;
          const ehHoje = cel.iso === hoje;

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.calCell,
                ehHoje && { backgroundColor: theme.primary + '22' },
                selecionado && { backgroundColor: theme.primary + '44' },
              ]}
              onPress={() => {
                if (temTeste) setDiaAtivo(selecionado ? null : cel.iso);
              }}
              activeOpacity={temTeste ? 0.7 : 1}
            >
              <Text
                style={[
                  styles.calDiaNum,
                  { color: temTeste ? ui.text : theme.textMuted },
                  selecionado && { color: theme.primary, fontWeight: '800' },
                ]}
              >
                {cel.dia}
              </Text>
              {temTeste ? (
                <View style={styles.calDots}>
                  {temArmada ? (
                    <View style={[styles.calDot, { backgroundColor: theme.primary }]} />
                  ) : null}
                  {temCfn ? (
                    <View style={[styles.calDot, { backgroundColor: '#F59E0B' }]} />
                  ) : null}
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* legenda */}
      <View style={styles.calLegenda}>
        <View style={styles.calLegItem}>
          <View style={[styles.calDot, { backgroundColor: theme.primary }]} />
          <Text style={[styles.calLegLabel, { color: theme.textMuted }]}>Armada</Text>
        </View>
        <View style={styles.calLegItem}>
          <View style={[styles.calDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[styles.calLegLabel, { color: theme.textMuted }]}>CFN</Text>
        </View>
      </View>

      {/* detalhe do dia */}
      {diaAtivo && sessoesAtivas.length > 0 ? (
        <View style={[styles.diaDetalhe, { backgroundColor: glass.highlight, borderColor: glass.border }]}>
          <Text style={[styles.diaDetalheHeader, { color: theme.primary }]}>
            {diaAtivo.split('-').reverse().join('/')}
          </Text>
          {sessoesAtivas.map((s) => {
            const norma = inferNormaSessao(s);
            const cor = norma === 'cfn' ? '#F59E0B' : theme.primary;
            const qtd = s.resultados.length;
            return (
              <View key={s.id} style={[styles.diaDetalheItem, { borderColor: glass.border }]}>
                <View style={[styles.diaDetalheNormaTag, { backgroundColor: cor + '22', borderColor: cor + '55' }]}>
                  <Text style={[styles.diaDetalheNormaText, { color: cor }]}>
                    {norma === 'cfn' ? 'CFN' : 'ARMADA'}
                  </Text>
                </View>
                <View style={styles.diaDetalheTexto}>
                  <Text style={[styles.diaDetalheTipoProva, { color: ui.text }]}>
                    {tituloTipoProva(s.tipoProva)}
                  </Text>
                  <Text style={[styles.diaDetalheQtd, { color: theme.textMuted }]}>
                    {qtd} participante{qtd !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* hint */}
      {(mapaAll.size === 0) ? (
        <Text style={[styles.calSemDados, { color: theme.textMuted }]}>
          Nenhum teste registrado ainda.
        </Text>
      ) : null}
    </View>
  );
}

/* ─── componente principal: modal ─── */
type Props = {
  visible: boolean;
  onClose: () => void;
  sessoes: SessaoAplicacaoTaf[];
};

export function ResultadosResumoModal({ visible, onClose, sessoes }: Props) {
  const { theme } = useTheme();
  const glass = getAplicarTafGlass(theme);

  const sessoesReais = useMemo(
    () => sessoes.filter((s) => !isDemoSessaoId(s.id)),
    [sessoes],
  );

  const sessoesArmada = useMemo(
    () => sessoesReais.filter((s) => inferNormaSessao(s) === 'armada'),
    [sessoesReais],
  );

  const sessoesCfn = useMemo(
    () => sessoesReais.filter((s) => inferNormaSessao(s) === 'cfn'),
    [sessoesReais],
  );

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
          {/* cabeçalho */}
          <View style={[styles.modalHeader, { borderBottomColor: glass.border }]}>
            <BarChart3 size={18} color={theme.primary} strokeWidth={2.4} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Resumo dos Testes</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: glass.border }]}
              accessibilityLabel="Fechar resumo"
            >
              <X size={20} color={theme.textSecondary} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {sessoesArmada.length > 0 ? (
              <NormaSection norma="armada" sessoes={sessoesArmada} />
            ) : (
              <View style={[styles.normaVazia, { borderColor: glass.border }]}>
                <Text style={[styles.normaVaziaText, { color: theme.textMuted }]}>
                  Nenhum teste TAF Armada registrado.
                </Text>
              </View>
            )}

            {sessoesCfn.length > 0 ? (
              <NormaSection norma="cfn" sessoes={sessoesCfn} />
            ) : (
              <View style={[styles.normaVazia, { borderColor: glass.border }]}>
                <Text style={[styles.normaVaziaText, { color: theme.textMuted }]}>
                  Nenhum teste TAF CFN registrado.
                </Text>
              </View>
            )}

            <View style={[styles.calContainer, { backgroundColor: glass.highlight, borderColor: glass.border }]}>
              <Text style={[styles.calSectionTitle, { color: theme.primary }]}>Calendário de Testes</Text>
              <CalendarioResumo
                sessoes={sessoesReais}
                sessoesArmada={sessoesArmada}
                sessoesCfn={sessoesCfn}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </AppModal>
  );
}

/* ─── estilos ─── */
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...Platform.select({
      web: {
        minHeight: '100%' as unknown as number,
        maxHeight: '100dvh' as unknown as number,
      } as object,
      default: {},
    }),
  },
  card: {
    width: '100%',
    maxWidth: 540,
    maxHeight: Platform.OS === 'web' ? ('88vh' as unknown as number) : 600,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
    borderRadius: PREMIUM.radiusSm,
    borderWidth: 1,
  },
  scrollContent: { flex: 1 },
  scrollInner: { padding: 16, gap: 14, paddingBottom: 32 },

  /* norma section */
  normaSection: {
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  normaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  normaBadge: {
    borderRadius: PREMIUM.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  normaBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  normaTotals: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  normaTotalNum: { fontSize: 14, fontWeight: '700' },
  normaTotalUnit: { fontSize: 13, fontWeight: '400' },
  normaTotalSep: { fontSize: 13 },
  modalidadesList: { padding: 10, gap: 8 },
  modalidadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: PREMIUM.radiusSm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalidadeAccent: { width: 4, alignSelf: 'stretch' },
  modalidadeInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  modalidadeLabel: { fontSize: 13, fontWeight: '700' },
  modalidadeNums: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalidadeNum: { fontSize: 13, fontWeight: '600' },
  modalidadeNumUnit: { fontSize: 12, fontWeight: '400' },
  modalidadeNumSep: { fontSize: 12 },

  normaVazia: {
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  normaVaziaText: { fontSize: 13, textAlign: 'center' },

  /* calendário */
  calContainer: {
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  calSectionTitle: { fontSize: 14, fontWeight: '800' },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calNavBtn: {
    padding: 6,
    borderRadius: PREMIUM.radiusSm,
    borderWidth: 1,
  },
  calTitulo: { fontSize: 15, fontWeight: '700' },
  calDiasSemana: {
    flexDirection: 'row',
    marginTop: 8,
  },
  calDiaSemLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  calGrade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  calCell: {
    width: `${100 / 7}%` as `${number}%`,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: PREMIUM.radiusSm,
  },
  calDiaNum: { fontSize: 13, fontWeight: '500' },
  calDots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  calDot: { width: 5, height: 5, borderRadius: 3 },
  calLegenda: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
    justifyContent: 'center',
  },
  calLegItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calLegLabel: { fontSize: 11, fontWeight: '600' },
  calSemDados: { textAlign: 'center', fontSize: 13, marginTop: 8 },

  /* detalhe do dia */
  diaDetalhe: {
    marginTop: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  diaDetalheHeader: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  diaDetalheItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  diaDetalheNormaTag: {
    borderRadius: PREMIUM.radiusSm,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  diaDetalheNormaText: { fontSize: 10, fontWeight: '800' },
  diaDetalheTexto: { flex: 1 },
  diaDetalheTipoProva: { fontSize: 13, fontWeight: '700' },
  diaDetalheQtd: { fontSize: 12 },
});
