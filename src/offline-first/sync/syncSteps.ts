export type SyncStepId =
  | 'login_google'
  | 'validate_permissions'
  | 'local_backup'
  | 'comparing'
  | 'uploading'
  | 'downloading'
  | 'updating_local'
  | 'finalizing';

export type SyncStepStatus = 'pending' | 'running' | 'done' | 'error';

export type SyncStepState = {
  id: SyncStepId;
  label: string;
  status: SyncStepStatus;
};

const STEP_LABELS: Record<SyncStepId, string> = {
  login_google: 'Verificando sessão Google',
  validate_permissions: 'Validando permissões',
  local_backup: 'Criando backup local',
  comparing: 'Comparando registros',
  uploading: 'Enviando alterações',
  downloading: 'Baixando alterações',
  updating_local: 'Atualizando banco local',
  finalizing: 'Finalizando',
};

export const SYNC_STEP_ORDER: SyncStepId[] = [
  'login_google',
  'validate_permissions',
  'local_backup',
  'comparing',
  'downloading',
  'updating_local',
  'uploading',
  'finalizing',
];

export function createInitialSyncSteps(): SyncStepState[] {
  return SYNC_STEP_ORDER.map((id) => ({
    id,
    label: STEP_LABELS[id],
    status: 'pending' as SyncStepStatus,
  }));
}

export function stepIcon(status: SyncStepStatus): string {
  if (status === 'done') return '✓';
  if (status === 'running') return '⟳';
  if (status === 'error') return '⚠';
  return '⏳';
}

export function setStepStatus(
  steps: SyncStepState[],
  stepId: SyncStepId,
  status: SyncStepStatus,
): SyncStepState[] {
  return steps.map((s) => {
    if (s.id !== stepId) return s;
    return { ...s, status };
  });
}

export function advanceStep(
  steps: SyncStepState[],
  activeId: SyncStepId,
): SyncStepState[] {
  const activeIdx = SYNC_STEP_ORDER.indexOf(activeId);
  return steps.map((s, idx) => {
    const stepIdx = SYNC_STEP_ORDER.indexOf(s.id);
    if (stepIdx < activeIdx) return { ...s, status: 'done' as SyncStepStatus };
    if (s.id === activeId) return { ...s, status: 'running' as SyncStepStatus };
    return s;
  });
}

export function markStepsDoneThrough(steps: SyncStepState[], throughId: SyncStepId): SyncStepState[] {
  const throughIdx = SYNC_STEP_ORDER.indexOf(throughId);
  return steps.map((s) => {
    const idx = SYNC_STEP_ORDER.indexOf(s.id);
    if (idx <= throughIdx) return { ...s, status: 'done' as SyncStepStatus };
    return s;
  });
}

export function markStepError(steps: SyncStepState[], stepId: SyncStepId): SyncStepState[] {
  return steps.map((s) => (s.id === stepId ? { ...s, status: 'error' as SyncStepStatus } : s));
}

export function stepLabel(stepId: SyncStepId): string {
  return STEP_LABELS[stepId];
}
