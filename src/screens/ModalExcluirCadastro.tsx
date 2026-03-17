import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';

const coresPadrao = {
  cardBg: '#FFFFFF',
  text: '#111111',
  textSecondary: '#666666',
  border: '#E0E0E0',
  error: '#C62828',
};

interface Props {
  visible: boolean;
  nomeCadastro: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  /** Opcional: cores do tema (evita depender de ThemeContext e quebrar a abertura do app) */
  theme?: typeof coresPadrao;
}

/**
 * Modal de confirmação antes de excluir um cadastro.
 */
export function ModalExcluirCadastro({
  visible,
  nomeCadastro,
  onConfirmar,
  onCancelar,
  theme: themeProp,
}: Props) {
  const theme = themeProp ?? coresPadrao;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <Pressable style={styles.backdrop} onPress={onCancelar}>
        <Pressable style={[styles.box, { backgroundColor: theme.cardBg }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.titulo, { color: theme.text }]}>Excluir cadastro</Text>
          <Text style={[styles.mensagem, { color: theme.textSecondary }]}>
            Tem certeza que deseja excluir o cadastro de {nomeCadastro}?
          </Text>
          <View style={[styles.botoes, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancelar, { borderColor: theme.border }]}
              onPress={onCancelar}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnCancelarText, { color: theme.text }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnExcluir, { backgroundColor: theme.error }]}
              onPress={onConfirmar}
              activeOpacity={0.8}
            >
              <Text style={styles.btnExcluirText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
      default: { elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
    }),
  },
  titulo: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  mensagem: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  botoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  btnCancelar: { borderWidth: 1, marginRight: 12 },
  btnCancelarText: { fontSize: 15, fontWeight: '600' },
  btnExcluir: {},
  btnExcluirText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
