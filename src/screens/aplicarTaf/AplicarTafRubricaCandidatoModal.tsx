import React from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { AppModal } from '../../components/premium/AppModal';
import {
  AssinaturaFuturistaOverlay,
  AssinaturaFuturistaScroll,
  AssinaturaFuturistaCard,
  AssinaturaFuturistaHeader,
  AssinaturaFuturistaNav,
  AssinaturaFuturistaMetaChip,
  AssinaturaFuturistaCanvas,
  AssinaturaFuturistaError,
  AssinaturaFuturistaBtnRow,
  AssinaturaFuturistaBtnGhost,
  AssinaturaFuturistaBtnPrimary,
} from '../../components/assinatura/AssinaturaFuturistaUi';
import { RubricaCell } from '../../components/RubricaThumb';
import type { ResultadoCorridaItem } from '../../navigation/types';
import { formatMsByModality } from '../../taf/tafTimeFormat';
import { normalizarRubricaSvgDataUrl, RUBRICA_COR_TRACO } from '../../utils/rubricaSvgNormalize';
import { RUBRICA_NATIVA_ALTURA } from '../../utils/rubricaConstants';
import {
  buildStrokePath,
  textoNotaRubricaModal,
  type RubricaStroke,
} from './aplicarTafScreenHelpers';

export type AplicarTafRubricaCandidatoModalProps = {
  visible: boolean;
  horizontalPad: number;
  paddingBottom: number;
  lista: ResultadoCorridaItem[] | null;
  indice: number;
  rubricaStrokes: RubricaStroke[];
  rubricaStrokeAtual: RubricaStroke;
  /** SVG já confirmado do participante atual (lido de ref — sem re-render da lista inteira). */
  svgSalvoAtual?: string | null;
  rubricaCanvasWidth: number;
  erro: string;
  onRequestClose: () => void;
  onVoltar: () => void;
  onCancelarFluxo: () => void;
  onIrParaIndex: (index: number) => void;
  onCanvasWidth: (width: number) => void;
  onStartStroke: (event: GestureResponderEvent) => void;
  onMoveStroke: (event: GestureResponderEvent) => void;
  onEndStroke: () => void;
  onLimpar: () => void;
  onConfirmar: () => void;
};

export function AplicarTafRubricaCandidatoModal({
  visible,
  horizontalPad,
  paddingBottom,
  lista,
  indice,
  rubricaStrokes,
  rubricaStrokeAtual,
  svgSalvoAtual,
  rubricaCanvasWidth,
  erro,
  onRequestClose,
  onVoltar,
  onCancelarFluxo,
  onIrParaIndex,
  onCanvasWidth,
  onStartStroke,
  onMoveStroke,
  onEndStroke,
  onLimpar,
  onConfirmar,
}: AplicarTafRubricaCandidatoModalProps) {
  const participanteAtual = lista?.[indice];
  const totalLista = lista?.length ?? 0;

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      accessibilityViewIsModal
    >
      <AssinaturaFuturistaOverlay
        style={{
          paddingHorizontal: horizontalPad,
          paddingBottom,
        }}
      >
        <AssinaturaFuturistaScroll>
          {!participanteAtual ? (
            <AssinaturaFuturistaCard accent="cyan">
              <AssinaturaFuturistaHeader
                kicker="CANDIDATO"
                title="Assinatura do candidato"
                subtitle="Não foi possível carregar o participante."
                accent="cyan"
                onBack={onCancelarFluxo}
                backLabel="Voltar"
              />
              <AssinaturaFuturistaBtnRow>
                <AssinaturaFuturistaBtnPrimary
                  label="Voltar à prova"
                  onPress={onCancelarFluxo}
                  accent="cyan"
                  flex
                />
              </AssinaturaFuturistaBtnRow>
            </AssinaturaFuturistaCard>
          ) : (
            (() => {
              const modProva = participanteAtual.prova ?? 'corrida';
              const tituloModalidade =
                modProva === 'natacao'
                  ? 'Natação'
                  : modProva === 'permanencia'
                    ? 'Permanência'
                    : modProva === 'caminhada'
                      ? 'Caminhada'
                      : 'Corrida';
              const temTracoRubrica =
                rubricaStrokes.some((s) => s.length > 0) || rubricaStrokeAtual.length > 0;
              const svgSalvoUri = normalizarRubricaSvgDataUrl(svgSalvoAtual);
              const temRubricaSalva = Boolean(svgSalvoUri);
              const podeAvancar = temTracoRubrica || temRubricaSalva;
              const tempoStr = formatMsByModality(
                modProva === 'natacao' ? 'natacao' : 'corrida',
                participanteAtual.tempoMs,
              );

              return (
                <AssinaturaFuturistaCard key={`rubrica-participante-${indice}`} accent="cyan">
                  <AssinaturaFuturistaHeader
                    kicker="CANDIDATO"
                    title="Assinatura do candidato"
                    subtitle={`Participante ${indice + 1} de ${totalLista} · ${tituloModalidade}`}
                    accent="cyan"
                    onBack={onVoltar}
                    backLabel={indice === 0 ? 'Voltar à prova' : 'Anterior'}
                  />

                  {totalLista > 1 ? (
                    <AssinaturaFuturistaNav
                      current={indice + 1}
                      total={totalLista}
                      accent="cyan"
                      onPrev={indice > 0 ? () => onIrParaIndex(indice - 1) : undefined}
                      onNext={
                        indice + 1 < totalLista && podeAvancar
                          ? () => onIrParaIndex(indice + 1)
                          : undefined
                      }
                    />
                  ) : null}

                  <AssinaturaFuturistaMetaChip
                    label="Militar"
                    value={`${participanteAtual.nome} · NIP ${participanteAtual.nip || '—'}`}
                  />
                  <AssinaturaFuturistaMetaChip
                    label="Resultado"
                    value={`Tempo ${tempoStr} · Nota ${textoNotaRubricaModal(participanteAtual)}`}
                  />

                  <AssinaturaFuturistaCanvas
                    accent="cyan"
                    height={RUBRICA_NATIVA_ALTURA}
                    onLayout={(e) => {
                      const w = e.nativeEvent.layout.width;
                      if (w > 0) onCanvasWidth(w);
                    }}
                    canvasProps={{
                      onStartShouldSetResponder: () => true,
                      onMoveShouldSetResponder: () => true,
                      onResponderTerminationRequest: () => false,
                      onResponderGrant: (e) => onStartStroke(e as GestureResponderEvent),
                      onResponderMove: (e) => onMoveStroke(e as GestureResponderEvent),
                      onResponderRelease: onEndStroke,
                      onResponderTerminate: onEndStroke,
                    }}
                  >
                    {!temTracoRubrica && svgSalvoUri ? (
                      <View
                        style={{
                          width: '100%',
                          height: RUBRICA_NATIVA_ALTURA,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        pointerEvents="none"
                      >
                        <RubricaCell
                          svgUri={svgSalvoUri}
                          maxWidth={rubricaCanvasWidth || 420}
                          maxHeight={RUBRICA_NATIVA_ALTURA}
                        />
                      </View>
                    ) : (
                      <Svg width="100%" height={RUBRICA_NATIVA_ALTURA}>
                        {rubricaStrokes.map((stroke, idx) => (
                          <SvgPath
                            key={`stroke-${indice}-${idx}`}
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
                    )}
                  </AssinaturaFuturistaCanvas>

                  {erro ? <AssinaturaFuturistaError message={erro} /> : null}

                  <AssinaturaFuturistaBtnRow>
                    <AssinaturaFuturistaBtnGhost label="Limpar" onPress={onLimpar} />
                    <AssinaturaFuturistaBtnPrimary
                      label={indice + 1 < totalLista ? 'Próximo' : 'Finalizar'}
                      onPress={onConfirmar}
                      disabled={!podeAvancar}
                      accent="cyan"
                      flex
                    />
                  </AssinaturaFuturistaBtnRow>
                </AssinaturaFuturistaCard>
              );
            })()
          )}
        </AssinaturaFuturistaScroll>
      </AssinaturaFuturistaOverlay>
    </AppModal>
  );
}
