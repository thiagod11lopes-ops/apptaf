import { postoGradExibicaoAssinatura, type AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import { celulaRubricaHtml } from './rubricaHtml';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function blocoAplicadorAssinaturaHtml(assinatura?: AplicadorAssinaturaResumo): string {
  if (!assinatura?.nome?.trim()) return '';
  const postoGrad = escapeHtml(postoGradExibicaoAssinatura(assinatura));
  const svg = assinatura.rubricaSvg?.trim();
  const rubricaHtml = svg
    ? `<div class="aplicador-rubrica">${celulaRubricaHtml(svg)}</div>`
    : `<div class="aplicador-rubrica aplicador-rubrica-vazia" aria-hidden="true"></div>`;
  return `<div class="aplicador-assinatura">
    ${rubricaHtml}
    <hr class="aplicador-linha"/>
    <p class="aplicador-identificacao">
      <span class="aplicador-posto-grad">${postoGrad}</span>
      <span class="aplicador-nome">${escapeHtml(assinatura.nome)}</span>
    </p>
    <p class="aplicador-nip">NIP ${escapeHtml(assinatura.nip || '—')}</p>
  </div>`;
}

export function blocosAplicadorAssinaturaHtml(assinaturas?: AplicadorAssinaturaResumo[]): string {
  if (!assinaturas?.length) return '';
  return assinaturas.map((a) => blocoAplicadorAssinaturaHtml(a)).join('');
}

export const PDF_APLICADOR_ASSINATURA_STYLES = `
  .aplicador-assinatura {
    margin: 0;
    padding: 0;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .aplicador-rubrica {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 28px;
    margin-bottom: 2px;
  }
  .aplicador-rubrica-vazia {
    min-height: 28px;
  }
  .aplicador-rubrica img,
  .aplicador-rubrica svg {
    max-height: 36px;
    width: auto;
  }
  .aplicador-linha {
    width: 72%;
    max-width: 420px;
    margin: 0 auto 4px;
    border: none;
    border-top: 1px solid #374151;
  }
  .aplicador-identificacao {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
    margin: 0 0 2px;
  }
  .aplicador-posto-grad {
    font-size: 13px;
    font-weight: 700;
    color: #6B7280;
  }
  .aplicador-nome {
    font-size: 15px;
    font-weight: 800;
    color: #111827;
  }
  .aplicador-nip {
    font-size: 12px;
    font-weight: 600;
    color: #6B7280;
    margin: 0;
    line-height: 1.1;
  }
`;
