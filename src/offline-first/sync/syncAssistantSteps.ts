export type SyncAssistantStep =
  | 'OFFLINE'
  | 'CONNECTING'
  | 'LOGIN'
  | 'VALIDATING'
  | 'BACKUP'
  | 'CLOCK_CHECK'
  | 'COMPARING'
  | 'REPORT'
  | 'SYNCING'
  | 'AUDIT'
  | 'DONE';

export type SyncAssistantProgress = {
  step: SyncAssistantStep;
  stepIndex: number;
  totalSteps: number;
  message: string;
};

export const SYNC_ASSISTANT_STEPS: SyncAssistantStep[] = [
  'CONNECTING',
  'LOGIN',
  'VALIDATING',
  'BACKUP',
  'CLOCK_CHECK',
  'COMPARING',
  'REPORT',
  'SYNCING',
  'AUDIT',
  'DONE',
];

export function progressForStep(step: SyncAssistantStep, message: string): SyncAssistantProgress {
  const idx = SYNC_ASSISTANT_STEPS.indexOf(step);
  return {
    step,
    stepIndex: idx >= 0 ? idx + 1 : 0,
    totalSteps: SYNC_ASSISTANT_STEPS.length,
    message,
  };
}
