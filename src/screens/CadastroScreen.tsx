import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, Image, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/Card';
import { ChevronLeft } from 'lucide-react-native';
import { LabelNip } from '../components/LabelNip';

export default function CadastroScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [categoria, setCategoria] = useState<'Oficiais' | 'Praças' | ''>('');
  const [oficialSelecionado, setOficialSelecionado] = useState<string>('');
  const [nip, setNip] = useState<string>('');
  const [nome, setNome] = useState<string>('');
  const [dataNascimento, setDataNascimento] = useState<string>('');

  const datePlaceholder = useMemo(() => '00/00/0000', []);

  function formatDateInput(value: string) {
    // Mantém apenas dígitos e força no formato DD/MM/AAAA.
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);

    if (digits.length <= 2) return dd;
    if (digits.length <= 4) return `${dd}/${mm}`;
    return `${dd}/${mm}/${yyyy}`;
  }

  function formatNipInput(value: string) {
    // Formato: 00.0000.00
    const digits = value.replace(/\D/g, '').slice(0, 8); // 2 + 4 + 2
    const a = digits.slice(0, 2);
    const b = digits.slice(2, 6);
    const c = digits.slice(6, 8);

    if (digits.length <= 2) return a;
    if (digits.length <= 6) return `${a}.${digits.slice(2)}`;
    return `${a}.${b}.${c}`;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Image source={require('../../Fundo.png')} style={styles.fundo} resizeMode="cover" />

      <View style={styles.foreground}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Home' as never)}
            style={styles.backBtn}
            accessibilityLabel="Voltar para Home"
          >
            <ChevronLeft size={28} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.pageTitle}>Cadastro</Text>

          <Card glass>
            <Text style={[styles.label, { color: 'rgba(255,255,255,0.92)' }]}>Categoria</Text>
            <View style={[styles.segmented, { borderColor: theme.border }]}>
              <TouchableOpacity
                onPress={() => {
                  setOficialSelecionado('');
                  setCategoria('Oficiais');
                }}
                style={[
                  styles.segmentBtn,
                  categoria === 'Oficiais' ? { backgroundColor: theme.primary } : { backgroundColor: 'rgba(255,255,255,0.12)' },
                ]}
              >
                <Text style={categoria === 'Oficiais' ? styles.segmentBtnTextSelected : styles.segmentBtnText}>
                  Oficiais
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setOficialSelecionado('');
                  setCategoria('Praças');
                }}
                style={[
                  styles.segmentBtn,
                  categoria === 'Praças' ? { backgroundColor: theme.primary } : { backgroundColor: 'rgba(255,255,255,0.12)' },
                ]}
              >
                <Text style={categoria === 'Praças' ? styles.segmentBtnTextSelected : styles.segmentBtnText}>
                  Praças
                </Text>
              </TouchableOpacity>
            </View>

            {categoria === 'Oficiais' ? (
              <>
                <Text style={[styles.label, { color: 'rgba(255,255,255,0.92)', marginTop: 4 }]}>Oficial</Text>
                <View style={[styles.optionGrid, { borderColor: theme.border, marginBottom: 8 }]}>
                  {['GM', '2°TEN', '1°TEN', 'CT', 'CC', 'CF', 'CMG'].map((opt) => {
                    const active = oficialSelecionado === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => setOficialSelecionado(opt)}
                        style={[
                          styles.optionBtn,
                          active ? { backgroundColor: theme.primary } : { backgroundColor: 'rgba(255,255,255,0.12)' },
                        ]}
                      >
                        <Text style={active ? styles.segmentBtnTextSelected : styles.segmentBtnText}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={styles.subtitle}>Tela de cadastro (em construção).</Text>

            <View style={{ marginBottom: 10 }}>
              <LabelNip color="rgba(255,255,255,0.92)" />
            </View>
            <TextInput
              value={nip}
              onChangeText={(t) => setNip(formatNipInput(t))}
              placeholder=""
              placeholderTextColor="rgba(0,0,0,0.45)"
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: 'rgba(255,255,255,0.22)' }]}
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
              name="nip"
              textContentType="none"
              keyboardType="numeric"
              maxLength={10}
            />

            <Text style={[styles.label, { color: 'rgba(255,255,255,0.92)' }]}>Nome</Text>
            <TextInput
              value={nome}
              onChangeText={(t) => setNome(t)}
              placeholder="Nome"
              placeholderTextColor="rgba(0,0,0,0.45)"
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: 'rgba(255,255,255,0.22)' }]}
            />

            <Text style={[styles.label, { color: 'rgba(255,255,255,0.92)' }]}>Data de nascimento</Text>
            <TextInput
              value={dataNascimento}
              onChangeText={(t) => setDataNascimento(formatDateInput(t))}
              placeholder={datePlaceholder}
              placeholderTextColor="rgba(0,0,0,0.45)"
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: 'rgba(255,255,255,0.22)' }]}
              keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
              maxLength={10}
            />
          </Card>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: '100%',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' } : null),
  },
  fundo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  foreground: { flex: 1, zIndex: 1, position: 'relative' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'web' ? 12 : 48,
    minHeight: 56,
  },
  backBtn: { padding: 8, marginRight: 4 },
  content: { padding: 20, flex: 1, justifyContent: 'flex-start' },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
    ...(Platform.OS === 'web' && { textShadow: '0 3px 8px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8)' }),
  },
  subtitle: { color: 'rgba(255,255,255,0.92)', fontSize: 14, marginBottom: 16 },
  label: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    ...(Platform.OS === 'web' && {
      textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.9)',
    }),
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.08)',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionBtn: {
    flexBasis: '33%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  segmentBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B1B1B',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  segmentBtnTextSelected: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
});

