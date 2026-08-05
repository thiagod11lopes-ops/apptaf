import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Platform,
  ActivityIndicator,
  ScrollView,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { AppModal } from '../premium/AppModal';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getAllAplicadores,
  type AplicadorItemPersist,
} from '../../services/aplicadoresIndexedDb';
import { ensureAplicadoresFromCloud } from '../../services/aplicadoresCloudPull';
import { subscribeDataChanged } from '../../offline-first/sync/SyncEngine';
import { createTrailingDebounce } from '../../utils/trailingDebounce';
import { isModoDemonstracaoAtivo } from '../../services/modoDemonstracao';
import {
  postoGradAplicador,
  type AplicadorAssinaturaResumo,
} from '../../types/aplicadorAssinatura';
import {
  buildRubricaSvgDataUrl,
  buildStrokePath,
  type RubricaStroke,
} from '../../utils/rubricaSvgBuilder';
import { rubricaParaPersistencia } from '../../utils/rubricaRasterPersist';
import { RUBRICA_COR_TRACO } from '../../utils/rubricaSvgNormalize';
import { compareByNomePtBr } from '../../utils/compareNomePtBr';
import { formatNomeComPosto } from '../../utils/formatNomeComPosto';
import { RUBRICA_NATIVA_ALTURA } from '../../utils/rubricaConstants';
import {
  AssinaturaFuturistaOverlay,
  AssinaturaFuturistaScroll,
  AssinaturaFuturistaCard,
  AssinaturaFuturistaHeader,
  AssinaturaFuturistaMetaChip,
  AssinaturaFuturistaCanvas,
  AssinaturaFuturistaError,
  AssinaturaFuturistaBtnRow,
  AssinaturaFuturistaBtnGhost,
  AssinaturaFuturistaBtnPrimary,
  AssinaturaFuturistaFieldLabel,
  AssinaturaFuturistaSelectList,
} from '../assinatura/AssinaturaFuturistaUi';

function labelAplicador(item: AplicadorItemPersist): string {
  const nip = item.nip?.trim();
  const nome = formatNomeComPosto(item);
  return nip ? `${nome} (${nip})` : nome;
}

function resumoAssinatura(
  aplicador: AplicadorItemPersist,
  rubricaSvg: string,
): AplicadorAssinaturaResumo {
  return {
    aplicadorId: aplicador.id,
    nome: aplicador.nome,
    nip: aplicador.nip,
    categoria: aplicador.categoria,
    postoGrad: postoGradAplicador(aplicador),
    rubricaSvg,
  };
}

type Props = {
  visible: boolean;
  onConcluir: (assinatura: AplicadorAssinaturaResumo) => void;
  onCancelar?: () => void;
};

/**
 * Assinatura do aplicador: escolher o aplicador e desenhar a rúbrica em toda prova.
 * Sem senha e sem reutilizar/salvar rúbrica no cadastro.
 */
export function FluxoAssinaturaAplicadorModal({ visible, onConcluir, onCancelar }: Props) {
  const { theme } = useTheme();
  const [aplicadores, setAplicadores] = useState<AplicadorItemPersist[]>([]);
  const [carregandoAplicadores, setCarregandoAplicadores] = useState(false);
  const [aplicadorSelecionadoId, setAplicadorSelecionadoId] = useState('');
  const [rubricaStrokes, setRubricaStrokes] = useState<RubricaStroke[]>([]);
  const [rubricaStrokeAtual, setRubricaStrokeAtual] = useState<RubricaStroke>([]);
  const [canvasWidth, setCanvasWidth] = useState(420);
  const [erro, setErro] = useState('');
  const [concluindo, setConcluindo] = useState(false);

  const aplicadorSelecionado = useMemo(
    () => aplicadores.find((a) => a.id === aplicadorSelecionadoId) ?? null,
    [aplicadores, aplicadorSelecionadoId],
  );

  const resetFluxo = useCallback(() => {
    setAplicadorSelecionadoId('');
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
    setErro('');
    setConcluindo(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    resetFluxo();

    let cancelled = false;
    const includeDemo = isModoDemonstracaoAtivo();
    const applyLista = (lista: AplicadorItemPersist[]) => {
      if (!cancelled) setAplicadores([...lista].sort(compareByNomePtBr));
    };
    setCarregandoAplicadores(true);
    void ensureAplicadoresFromCloud({ includeDemo })
      .then(applyLista)
      .catch(() => applyLista([]))
      .finally(() => {
        if (!cancelled) setCarregandoAplicadores(false);
      });
    const debounce = createTrailingDebounce(400);
    const unsub = subscribeDataChanged(
      () => {
        debounce.schedule(() => {
          void getAllAplicadores({ includeDemo })
            .then(applyLista)
            .catch(() => applyLista([]));
        });
      },
      { scopes: ['aplicadores'] },
    );
    return () => {
      cancelled = true;
      debounce.cancel();
      unsub();
    };
  }, [visible, resetFluxo]);

  const selecionarAplicador = useCallback((id: string) => {
    setAplicadorSelecionadoId(id);
    setErro('');
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
  }, []);

  const iniciarRubricaStroke = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setRubricaStrokeAtual([{ x: locationX, y: locationY }]);
    setErro('');
  }, []);

  const moverRubricaStroke = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setRubricaStrokeAtual((prev) => [...prev, { x: locationX, y: locationY }]);
  }, []);

  const finalizarRubricaStroke = useCallback(() => {
    if (rubricaStrokeAtual.length === 0) return;
    setRubricaStrokes((prev) => [...prev, rubricaStrokeAtual]);
    setRubricaStrokeAtual([]);
  }, [rubricaStrokeAtual]);

  const limparRubrica = useCallback(() => {
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
    setErro('');
  }, []);

  const temTracoRubrica =
    rubricaStrokes.some((s) => s.length > 0) || rubricaStrokeAtual.length > 0;

  const montarSvgRubricaAtual = useCallback((): string | null => {
    const todos: RubricaStroke[] = [
      ...rubricaStrokes.filter((s) => s.length > 0),
      ...(rubricaStrokeAtual.length > 0 ? [rubricaStrokeAtual] : []),
    ];
    if (todos.length === 0) return null;
    const svg = buildRubricaSvgDataUrl(todos, canvasWidth, RUBRICA_NATIVA_ALTURA);
    return rubricaParaPersistencia(svg) ?? svg;
  }, [canvasWidth, rubricaStrokeAtual, rubricaStrokes]);

  const concluirAssinatura = useCallback(() => {
    if (!aplicadorSelecionado) {
      setErro('Selecione o aplicador.');
      return;
    }
    const rubricaSvg = montarSvgRubricaAtual();
    if (!rubricaSvg) {
      setErro('Desenhe a rúbrica do aplicador antes de concluir.');
      return;
    }
    setConcluindo(true);
    setErro('');
    try {
      onConcluir(resumoAssinatura(aplicadorSelecionado, rubricaSvg));
    } finally {
      setConcluindo(false);
    }
  }, [aplicadorSelecionado, montarSvgRubricaAtual, onConcluir]);

  const selectWebStyle = useMemo(
    () =>
      ({
        width: '100%',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: theme.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : 'rgba(255,255,255,0.65)',
        color: theme.text,
      }) as object,
    [theme],
  );

  const canvasResponderProps = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: iniciarRubricaStroke,
    onResponderMove: moverRubricaStroke,
    onResponderRelease: finalizarRubricaStroke,
    onResponderTerminate: finalizarRubricaStroke,
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancelar ?? (() => {})}
      accessibilityViewIsModal
    >
      <AssinaturaFuturistaOverlay>
        <AssinaturaFuturistaScroll>
          <AssinaturaFuturistaCard accent="violet">
            <AssinaturaFuturistaHeader
              kicker="APLICADOR"
              title="Assinatura do aplicador"
              subtitle="Selecione o aplicador e desenhe a rúbrica desta aplicação. A rúbrica não fica salva para a próxima prova."
              accent="violet"
            />

            <AssinaturaFuturistaFieldLabel>Aplicador</AssinaturaFuturistaFieldLabel>
            {carregandoAplicadores ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginBottom: 12 }} />
            ) : aplicadores.length === 0 ? (
              <AssinaturaFuturistaError message="Nenhum aplicador cadastrado. Cadastre no menu Aplicador." />
            ) : Platform.OS === 'web' ? (
              <select
                value={aplicadorSelecionadoId}
                onChange={(e) => selecionarAplicador(e.target.value)}
                style={selectWebStyle}
              >
                <option value="">Selecione o aplicador</option>
                {aplicadores.map((item) => (
                  <option key={item.id} value={item.id}>
                    {labelAplicador(item)}
                  </option>
                ))}
              </select>
            ) : (
              <AssinaturaFuturistaSelectList>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                  {aplicadores.map((item) => {
                    const active = item.id === aplicadorSelecionadoId;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => selecionarAplicador(item.id)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          backgroundColor: active ? theme.primary : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '600',
                            color: active ? theme.tokens.textOnPrimary : theme.textSecondary,
                          }}
                        >
                          {labelAplicador(item)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </AssinaturaFuturistaSelectList>
            )}

            {aplicadorSelecionado ? (
              <AssinaturaFuturistaMetaChip
                label="Identificação"
                value={`${formatNomeComPosto(aplicadorSelecionado)} · NIP ${aplicadorSelecionado.nip || '—'}`}
              />
            ) : null}

            <AssinaturaFuturistaFieldLabel>Rúbrica</AssinaturaFuturistaFieldLabel>
            <AssinaturaFuturistaCanvas
              accent="violet"
              height={RUBRICA_NATIVA_ALTURA}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0) setCanvasWidth(w);
              }}
              canvasProps={canvasResponderProps}
            >
              <Svg width="100%" height={RUBRICA_NATIVA_ALTURA}>
                {rubricaStrokes.map((stroke, idx) => (
                  <SvgPath
                    key={`stroke-${idx}`}
                    d={buildStrokePath(stroke)}
                    stroke={RUBRICA_COR_TRACO}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {rubricaStrokeAtual.length > 0 ? (
                  <SvgPath
                    d={buildStrokePath(rubricaStrokeAtual)}
                    stroke={RUBRICA_COR_TRACO}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </Svg>
            </AssinaturaFuturistaCanvas>

            {erro ? <AssinaturaFuturistaError message={erro} /> : null}

            <AssinaturaFuturistaBtnRow>
              {onCancelar ? (
                <AssinaturaFuturistaBtnGhost label="Cancelar" onPress={onCancelar} flex />
              ) : null}
              <AssinaturaFuturistaBtnGhost label="Limpar" onPress={limparRubrica} flex />
              <AssinaturaFuturistaBtnPrimary
                label={concluindo ? 'Concluindo…' : 'Concluir'}
                onPress={concluirAssinatura}
                disabled={
                  concluindo ||
                  aplicadores.length === 0 ||
                  !aplicadorSelecionadoId ||
                  !temTracoRubrica
                }
                loading={concluindo}
                accent="violet"
                flex
              />
            </AssinaturaFuturistaBtnRow>
          </AssinaturaFuturistaCard>
        </AssinaturaFuturistaScroll>
      </AssinaturaFuturistaOverlay>
    </AppModal>
  );
}
