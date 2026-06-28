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
  const rubricaHtml = assinatura.rubricaSvg
    ? `<div class="aplicador-rubrica">${celulaRubricaHtml(assinatura.rubricaSvg)}</div>`
    : '';
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
    margin-top: 28px;
    text-align: center;
    page-break-inside: avoid;
  }
  .aplicador-rubrica {
    display: flex;
    justify-content: center;
    margin-bottom: 8px;
  }
  .aplicador-linha {
    width: 72%;
    max-width: 420px;
    margin: 0 auto 12px;
    border: none;
    border-top: 1px solid #374151;
  }
  .aplicador-identificacao {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
    margin: 0 0 4px;
  }
  .aplicador-posto-grad {
    font-size: 14px;
    font-weight: 700;
    color: #6B7280;
  }
  .aplicador-nome {
    font-size: 16px;
    font-weight: 800;
    color: #111827;
  }
  .aplicador-nip {
    font-size: 13px;
    font-weight: 600;
    color: #6B7280;
    margin: 0;
  }
`;
