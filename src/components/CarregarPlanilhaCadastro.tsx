import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Upload } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { ResultadoImportacaoPlanilha } from '../utils/importCadastrosPlanilhaPdf';
import { PREMIUM } from '../theme/premium';
import { tableFullWidthStyle } from '../theme/tableLayout';

type Props = {
  onImportComplete: () => void;
};

export function CarregarPlanilhaCadastro({ onImportComplete }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const inputRef = useRef<unknown>(null);
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacaoPlanilha | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const processarArrayBuffer = useCallback(
    async (buffer: ArrayBuffer) => {
      setCarregando(true);
      setErroGeral(null);
      setResultado(null);
      try {
        const { importarCadastrosDePdf } = await import('../utils/importCadastrosPlanilhaPdf');
        const res = await importarCadastrosDePdf(buffer);
        setResultado(res);
        if (res.importados > 0) onImportComplete();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha ao ler o PDF.';
        setErroGeral(msg);
      } finally {
        setCarregando(false);
      }
    },
    [onImportComplete],
  );

  const processarArquivo = useCallback(
    async (file: File | { uri: string; name?: string }) => {
      if (file instanceof File) {
        const buffer = await file.arrayBuffer();
        await processarArrayBuffer(buffer);
        return;
      }
      const resp = await fetch(file.uri);
      const buffer = await resp.arrayBuffer();
      await processarArrayBuffer(buffer);
    },
    [processarArrayBuffer],
  );

  const abrirSeletor = useCallback(async () => {
    if (carregando) return;

    if (Platform.OS === 'web') {
      (inputRef.current as { click?: () => void } | null)?.click?.();
      return;
    }

    try {
      const DocumentPicker = await import('expo-document-picker');
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      await processarArquivo({ uri: picked.assets[0].uri, name: picked.assets[0].name });
    } catch {
      setErroGeral('Não foi possível abrir o arquivo PDF.');
    }
  }, [carregando, processarArquivo]);

  const onWebFileChange = useCallback(
    async (event: { target: { files?: FileList | null; value: string } }) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        setErroGeral('Selecione um arquivo PDF.');
        return;
      }
      await processarArquivo(file);
    },
    [processarArquivo],
  );

  return (
    <View style={styles.wrap}>
      {Platform.OS === 'web'
        ? React.createElement('input', {
            ref: inputRef,
            type: 'file',
            accept: 'application/pdf,.pdf',
            style: { display: 'none' },
            onChange: onWebFileChange,
          })
        : null}

      <TouchableOpacity
        accessibilityLabel="Carregar Planilha"
        activeOpacity={0.85}
        disabled={carregando}
        onPress={abrirSeletor}
        style={[
          styles.btn,
          {
            backgroundColor: theme.primary,
            borderColor: theme.border,
            opacity: carregando ? 0.7 : 1,
          },
        ]}
      >
        {carregando ? (
          <ActivityIndicator color={theme.text} size="small" />
        ) : (
          <>
            <Upload size={18} color={theme.text} strokeWidth={2.2} />
            <Text style={[ts.caption, styles.btnText, { color: theme.text }]}>Carregar Planilha</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={[ts.caption, styles.hint, { color: theme.textSecondary }]}>
        Importa PDF com colunas Posto/Graduação, NIP e Militar. Data de nascimento em branco se não constar no
        arquivo.
      </Text>

      {erroGeral ? (
        <Text style={[ts.caption, styles.feedback, { color: theme.loss }]}>{erroGeral}</Text>
      ) : null}

      {resultado ? (
        <View style={[styles.feedbackBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <Text style={[ts.caption, { color: theme.text }]}>
            {resultado.importados > 0
              ? `${resultado.importados} militar(es) cadastrado(s).`
              : 'Nenhum cadastro novo foi adicionado.'}
          </Text>
          <Text style={[ts.caption, { color: theme.textSecondary, marginTop: 4 }]}>
            Total no arquivo: {resultado.totalNoArquivo}
            {resultado.ignoradosDuplicados > 0
              ? ` · Ignorados (NIP já existente): ${resultado.ignoradosDuplicados}`
              : ''}
          </Text>
          {resultado.erros.map((msg) => (
            <Text key={msg} style={[ts.caption, { color: theme.loss, marginTop: 4 }]}>
              {msg}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...tableFullWidthStyle,
    marginBottom: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  btnText: {
    fontWeight: '800',
  },
  hint: {
    marginTop: 8,
    lineHeight: 18,
  },
  feedback: {
    marginTop: 8,
  },
  feedbackBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
});
