import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'lucide-react-native';
import { PressableScale } from '../../premium/PressableScale';
import { capturarESalvarPrintPagina } from '../../../utils/capturarPrintPagina';

type Props = {
  compact?: boolean;
};

/** Captura/salva print da prova ativa (botão câmera). */
export function ProvaAtivaPrintButton({ compact = false }: Props) {
  const [capturandoPrint, setCapturandoPrint] = useState(false);

  const onPrintPagina = useCallback(async () => {
    if (capturandoPrint) return;
    setCapturandoPrint(true);
    try {
      const modo = await capturarESalvarPrintPagina();
      if (modo === 'downloaded') {
        Alert.alert('Print salvo', 'A foto da prova ativa foi baixada no dispositivo.');
      }
    } catch (e) {
      const msg =
        e instanceof Error && e.name === 'AbortError'
          ? null
          : e instanceof Error
            ? e.message
            : 'Não foi possível capturar a tela.';
      if (msg) Alert.alert('Print', msg);
    } finally {
      setCapturandoPrint(false);
    }
  }, [capturandoPrint]);

  const printBtnGlow =
    '0 8px 28px rgba(37, 99, 235, 0.45), 0 0 0 1px rgba(96, 165, 250, 0.4)';

  return (
    <View
      {...(Platform.OS === 'web'
        ? ({ 'data-taf-skip-capture': '1' } as object)
        : null)}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Print da prova ativa"
        accessibilityHint="Captura a tela e salva a foto no dispositivo"
        onPress={() => void onPrintPagina()}
        disabled={capturandoPrint}
        style={[
          compact ? styles.printOuterCompact : styles.printOuter,
          Platform.OS === 'web' ? ({ boxShadow: printBtnGlow } as object) : null,
          capturandoPrint ? { opacity: 0.75 } : null,
        ]}
      >
        <LinearGradient
          colors={['#60a5fa', '#2563eb', '#1d4ed8']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={compact ? styles.printGradientCompact : styles.printGradient}
        >
          {capturandoPrint ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Camera
              size={compact ? 18 : 22}
              color="#FFFFFF"
              strokeWidth={2.6}
              accessibilityElementsHidden
            />
          )}
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  printOuter: {
    borderRadius: 18,
    overflow: 'hidden',
    width: 56,
    flexShrink: 0,
  },
  printOuterCompact: {
    borderRadius: 14,
    overflow: 'hidden',
    width: 48,
    flexShrink: 0,
  },
  printGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    width: 56,
    borderRadius: 18,
    overflow: 'hidden',
  },
  printGradientCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: 48,
    borderRadius: 14,
    overflow: 'hidden',
  },
});
