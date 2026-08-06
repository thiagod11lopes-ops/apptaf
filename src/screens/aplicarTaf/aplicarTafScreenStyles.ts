import { Platform, StyleSheet } from 'react-native';
import type { AppTheme } from '../../theme/premium';
import { PREMIUM } from '../../theme/premium';
import type { UiColors } from '../../theme/uiColors';

export function createAplicarTafStyles(theme: AppTheme, ui: UiColors) {
  return StyleSheet.create({
  safe: { flex: 1, position: 'relative' as const },
  keyboardRoot: { flex: 1 },
  scrollContentCadastro: { paddingVertical: 12 },
  nipsFimAnchor: { height: 1, width: '100%' },
  centerWrap: { flex: 1, alignItems: 'stretch' as const, maxWidth: 720, alignSelf: 'center', width: '100%' },
  section: { width: '100%' },
  identTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    width: '100%',
  },
  identTopBack: {
    flex: 1,
    minWidth: 0,
  },
  preCadastroVazio: {
    marginBottom: 16,
    textAlign: 'center',
  },
  preCadastroActions: {
    gap: 12,
    marginTop: 4,
  },
  nomeCodigoBox: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    padding: 12,
    marginBottom: 12,
  },
  nomeCodigoLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  nomeCodigoSelectList: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nomeCodigoSelectRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalTempoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalFuturisticCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: PREMIUM.radiusLg + 4,
    backgroundColor: theme.isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
    padding: 22,
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(148, 163, 184, 0.22)' : theme.border,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 64px rgba(15,23,42,0.28)' } as object)
      : {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.25,
          shadowRadius: 28,
          elevation: 12,
        }),
  },
  modalFuturisticStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  modalTempoMensagemCadastro: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    color: ui.text,
    lineHeight: 24,
    marginTop: 6,
  },
  modalTempoParcialCadastro: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: ui.text,
    textAlign: 'center',
    lineHeight: 19,
  },
  btnIniciarDisabled: {
    opacity: 0.72,
  },
  erroText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: theme.isDark ? ui.text : '#B91C1C',
  },
  campoVoltasInput: {
    width: '100%',
    marginBottom: 16,
  },
  tabelaScrollHorizontal: {
    width: '100%',
    marginBottom: 4,
  },
  tabelaCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabelaHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: ui.headerBorder,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: ui.tableHeaderBg,
  },
  tabelaHeaderCell: {
    fontSize: 12,
    fontWeight: '900',
    color: ui.text,
  },
  tabelaHeaderVolta: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  tabelaDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  tabelaCell: {
    justifyContent: 'center',
  },
  tabelaCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: ui.text,
  },
  tabelaColCorredor: {
    width: 56,
    minWidth: 56,
    paddingRight: 4,
  },
  tabelaColNome: {
    flex: 1,
    minWidth: 100,
    paddingRight: 4,
  },
  tabelaGrupoNomeVoltas: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  tabelaColNomeInline: {
    width: 128,
    minWidth: 96,
    maxWidth: 160,
    paddingRight: 4,
  },
  tabelaColChegadaInline: {
    width: 40,
    minWidth: 40,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  tabelaHeaderChegada: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: -0.2,
    textAlign: 'center',
    width: 52,
    minWidth: 52,
  },
  tabelaColMarcarChegada: {
    width: 128,
    minWidth: 128,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tabelaColVolta: {
    width: 40,
    minWidth: 40,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  tabelaColTempo: {
    width: 82,
    minWidth: 82,
    textAlign: 'center',
  },
  tabelaColNota: {
    width: 64,
    minWidth: 64,
    textAlign: 'center',
  },
  tabelaNotaText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tabelaNotaRepro: {
    color: theme.isDark ? ui.text : '#B91C1C',
    fontSize: 9,
  },
  tabelaCelulaTempo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabelaTempoText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  tabelaCelulaCheck: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkVoltaOuter: {
    padding: 2,
  },
  checkVoltaBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  checkVoltaBoxOff: {
    borderColor: theme.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(17,24,39,0.25)',
    backgroundColor: 'transparent',
  },
  checkVoltaBoxOn: {
    borderColor: '#15803D',
    backgroundColor: '#15803D',
  },
  tabelaNumeroVerde: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.isDark ? ui.text : theme.success,
  },
  modalPermanenciaFinalTitulo: {
    fontSize: 18,
    fontWeight: '900',
    color: ui.text,
    textAlign: 'center',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
  },
  modalPermanenciaFinalSub: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 8,
  },
  });
}
