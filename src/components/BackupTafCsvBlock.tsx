import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Download, FolderDown, Upload } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  exportarBackupTafCsv,
  exportarBackupTafCsvNaPasta,
  importarBackupTafCsv,
  readBackupCsvFile,
  type ResultadoImportacaoBackupCsv,
} from '../utils/backupTafCsv';
import { PREMIUM } from '../theme/premium';

export function BackupTafCsvBlock() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const { isAuthenticated } = useAuth();
  const inputRef = useRef<unknown>(null);
  const [exportando, setExportando] = useState(false);
  const [salvandoPasta, setSalvandoPasta] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ResultadoImportacaoBackupCsv | null>(null);

  const handleExport = useCallback(async () => {
    if (salvandoPasta) return;
    setExportando(true);
    setErro(null);
    setExportMsg(null);
    try {
      const result = await exportarBackupTafCsv();
      setExportMsg(
        `${result.mensagem} (${result.filename}): ${result.cadastros.toLocaleString('pt-BR')} cadastros e ${result.sessoes.toLocaleString('pt-BR')} sessões de TAF (backup completo v2).`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao gerar backup CSV.';
      if (!/cancelad/i.test(msg)) setErro(msg);
    } finally {
      setExportando(false);
    }
  }, [salvandoPasta]);

  const handleSalvarNaPasta = useCallback(async () => {
    if (exportando || importando) return;
    setSalvandoPasta(true);
    setErro(null);
    setExportMsg(null);
    try {
      const result = await exportarBackupTafCsvNaPasta();
      setExportMsg(
        `${result.mensagem} (${result.filename}): ${result.cadastros.toLocaleString('pt-BR')} cadastros e ${result.sessoes.toLocaleString('pt-BR')} sessões.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao salvar backup CSV na pasta.';
      if (!/cancelad/i.test(msg)) setErro(msg);
    } finally {
      setSalvandoPasta(false);
    }
  }, [exportando, importando]);

  const processarArquivo = useCallback(async (file: File | { uri: string }) => {
    setImportando(true);
    setErro(null);
    setImportResult(null);
    try {
      const text = await readBackupCsvFile(file);
      const result = await importarBackupTafCsv(text);
      setImportResult(result);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar backup CSV.');
    } finally {
      setImportando(false);
    }
  }, []);

  const abrirSeletor = useCallback(async () => {
    if (importando) return;

    if (Platform.OS === 'web') {
      (inputRef.current as { click?: () => void } | null)?.click?.();
      return;
    }

    try {
      const DocumentPicker = await import('expo-document-picker');
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      await processarArquivo({ uri: picked.assets[0].uri });
    } catch {
      setErro('Não foi possível abrir o arquivo CSV.');
    }
  }, [importando, processarArquivo]);

  const onWebFileChange = useCallback(
    async (event: { target: { files?: FileList | null; value: string } }) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const name = file.name.toLowerCase();
      if (!name.endsWith('.csv') && !name.endsWith('.txt')) {
        setErro('Selecione um arquivo .csv de backup do TAF.');
        return;
      }
      await processarArquivo(file);
    },
    [processarArquivo],
  );

  const busy = exportando || importando || salvandoPasta;

  return (
    <View style={styles.wrap}>
      {Platform.OS === 'web'
        ? React.createElement('input', {
            ref: inputRef,
            type: 'file',
            accept: '.csv,text/csv,text/plain',
            style: { display: 'none' },
            onChange: onWebFileChange,
          })
        : null}

      <TouchableOpacity
        accessibilityLabel="Backup em CSV"
        activeOpacity={0.85}
        disabled={busy}
        onPress={handleExport}
        style={[
          styles.btn,
          { backgroundColor: theme.primary, borderColor: theme.border, opacity: busy ? 0.7 : 1 },
        ]}
      >
        {exportando ? (
          <ActivityIndicator color={theme.text} size="small" />
        ) : (
          <>
            <Download size={18} color={theme.text} strokeWidth={2.2} />
            <Text style={[ts.caption, styles.btnText, { color: theme.text }]}>Backup em CSV</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityLabel="Salvar backup CSV na pasta escolhida"
        activeOpacity={0.85}
        disabled={busy}
        onPress={() => void handleSalvarNaPasta()}
        style={[
          styles.btn,
          styles.btnSecondary,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border,
            opacity: busy ? 0.7 : 1,
          },
        ]}
      >
        {salvandoPasta ? (
          <ActivityIndicator color={theme.primary} size="small" />
        ) : (
          <>
            <FolderDown size={18} color={theme.primary} strokeWidth={2.2} />
            <Text style={[ts.caption, styles.btnText, { color: theme.primary }]}>
              Salvar backup na pasta…
            </Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityLabel="Carregar dados CSV"
        activeOpacity={0.85}
        disabled={busy}
        onPress={abrirSeletor}
        style={[
          styles.btn,
          styles.btnSecondary,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border,
            opacity: busy ? 0.7 : 1,
          },
        ]}
      >
        {importando ? (
          <ActivityIndicator color={theme.primary} size="small" />
        ) : (
          <>
            <Upload size={18} color={theme.primary} strokeWidth={2.2} />
            <Text style={[ts.caption, styles.btnText, { color: theme.primary }]}>
              Carregar dados CSV
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={[ts.caption, styles.hint, { color: theme.textSecondary }]}>
        Exporta e restaura cadastros, resultados, aplicadores, pré-cadastros, e-mails autorizados, fila de
        sync e metadados em um único arquivo CSV. “Backup em CSV” salva na pasta Downloads; no iPhone use
        Compartilhar → Salvar em Arquivos. “Salvar backup na pasta…” permite escolher outra pasta.
        {isAuthenticated ? ' Com login ativo, os dados são gravados na nuvem.' : ''}
      </Text>

      {exportMsg ? (
        <Text style={[ts.caption, styles.feedback, { color: theme.gain }]}>{exportMsg}</Text>
      ) : null}

      {importResult ? (
        <View
          style={[
            styles.feedbackBox,
            { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
          ]}
        >
          <Text style={[ts.caption, { color: theme.text }]}>
            Restauração concluída: {importResult.cadastrosImportados.toLocaleString('pt-BR')} cadastros,{' '}
            {importResult.sessoesImportadas.toLocaleString('pt-BR')} sessões,{' '}
            {importResult.aplicadoresImportados.toLocaleString('pt-BR')} aplicadores,{' '}
            {importResult.preCadastrosImportados.toLocaleString('pt-BR')} pré-cadastros.
          </Text>
          {(importResult.emailsAutorizadosImportados > 0 ||
            importResult.syncQueueImportados > 0 ||
            importResult.appMetaImportados > 0) && (
            <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>
              Também: {importResult.emailsAutorizadosImportados} e-mail(s) autorizado(s),{' '}
              {importResult.syncQueueImportados} item(ns) na fila de sync, {importResult.appMetaImportados}{' '}
              metadado(s).
            </Text>
          )}
          {importResult.erros.slice(0, 5).map((msg) => (
            <Text key={msg} style={[ts.caption, { color: theme.loss, marginTop: 4 }]}>
              {msg}
            </Text>
          ))}
        </View>
      ) : null}

      {erro ? <Text style={[ts.caption, styles.feedback, { color: theme.loss }]}>{erro}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    marginBottom: 10,
  },
  btnSecondary: {},
  btnText: { fontWeight: '800' },
  hint: { lineHeight: 18 },
  feedback: { marginTop: 8 },
  feedbackBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
});
