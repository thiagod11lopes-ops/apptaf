import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { AppModal } from '../../premium/AppModal';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { formatNipInput } from '../../../utils/nipFormat';

export const FATORES_RISCO_LARANJA = '#ea580c';

type Props = {
  visible: boolean;
  nome: string;
  nip: string;
  fatores: string[];
  onClose: () => void;
};

export function FatoresRiscoInfoModal({ visible, nome, nip, fatores, onClose }: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const ts = theme.textStyles;

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.isDark ? 'rgba(234,88,12,0.45)' : 'rgba(234,88,12,0.35)',
            },
          ]}
        >
          <View style={styles.header}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: theme.isDark ? 'rgba(234,88,12,0.2)' : 'rgba(254,215,170,0.65)',
                },
              ]}
            >
              <AlertTriangle size={22} color={FATORES_RISCO_LARANJA} strokeWidth={2.4} />
            </View>
            <View style={styles.headerText}>
              <Text style={[ts.caption, styles.kicker, { color: FATORES_RISCO_LARANJA }]}>
                FATORES DE RISCO
              </Text>
              <Text style={[styles.title, { color: ui.text }]} numberOfLines={2}>
                {nome || 'Militar'}
              </Text>
              {nip ? (
                <Text style={[ts.caption, { color: theme.textSecondary }]}>
                  NIP {formatNipInput(nip)}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              accessibilityLabel="Fechar"
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[ts.caption, styles.lead, { color: theme.textSecondary }]}>
            Itens marcados com Sim para este militar:
          </Text>

          <ScrollView style={styles.lista} nestedScrollEnabled>
            {fatores.length === 0 ? (
              <Text style={[ts.body, { color: theme.textMuted }]}>Nenhum fator marcado com Sim.</Text>
            ) : (
              fatores.map((label) => (
                <View
                  key={label}
                  style={[
                    styles.item,
                    {
                      borderColor: theme.isDark ? 'rgba(234,88,12,0.35)' : 'rgba(234,88,12,0.22)',
                      backgroundColor: theme.isDark
                        ? 'rgba(234,88,12,0.1)'
                        : 'rgba(255,247,237,0.9)',
                    },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: FATORES_RISCO_LARANJA }]} />
                  <Text style={[styles.itemText, { color: ui.text }]}>{label}</Text>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity
            accessibilityLabel="Fechar fatores de risco"
            onPress={onClose}
            activeOpacity={0.88}
            style={[styles.okBtn, { backgroundColor: FATORES_RISCO_LARANJA }]}
          >
            <Text style={styles.okBtnText}>Entendi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  kicker: {
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  closeBtn: {
    padding: 4,
  },
  lead: {
    marginBottom: 10,
  },
  lista: {
    maxHeight: 260,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  okBtn: {
    marginTop: 12,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
