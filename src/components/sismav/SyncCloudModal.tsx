import React from 'react';
import { CloudUpload } from 'lucide-react-native';
import { ModernModal } from './ModernModal';
import { SyncStatusBar } from './SyncStatusBar';
import { useOfflineSyncState } from '../../contexts/OfflineSyncContext';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SyncCloudModal({ visible, onClose }: Props) {
  const { syncUi } = useOfflineSyncState();

  return (
    <ModernModal
      visible={visible}
      onClose={onClose}
      title="Sincronização com a nuvem"
      dismissable={!syncUi.isSyncing}
      maxBodyHeight={560}
      icon={<CloudUpload size={20} color="#FFFFFF" strokeWidth={2.2} />}
    >
      <SyncStatusBar embedded />
    </ModernModal>
  );
}
