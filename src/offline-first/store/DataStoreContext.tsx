import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dataStore } from './store/DataStore';
import { connectivityMonitor, getConnectivityState } from './sync/ConnectivityMonitor';
import { syncEngine } from './sync/SyncEngine';
import type { ConnectivityState } from './types';

type DataStoreContextValue = {
  connectivity: ConnectivityState;
  pendingCount: number;
  refresh: () => Promise<void>;
  forceSync: () => Promise<void>;
};

const DataStoreContext = createContext<DataStoreContextValue | null>(null);

export function DataStoreProvider({
  children,
  ownerUid,
}: {
  children: ReactNode;
  ownerUid: string | null;
}) {
  const [connectivity, setConnectivity] = useState<ConnectivityState>(getConnectivityState());
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = async () => {
    if (!ownerUid) {
      setPendingCount(0);
      return;
    }
    setPendingCount(await dataStore.pendingCount(ownerUid));
  };

  useEffect(() => {
    return connectivityMonitor.subscribe(setConnectivity);
  }, []);

  useEffect(() => {
    if (!ownerUid) return;
    void refresh();
    return dataStore.subscribe(() => void refresh());
  }, [ownerUid]);

  const value = useMemo(
    () => ({
      connectivity,
      pendingCount,
      refresh,
      forceSync: async () => {
        await syncEngine.forceSync();
        await refresh();
      },
    }),
    [connectivity, pendingCount, ownerUid],
  );

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}

export function useDataStoreState(): DataStoreContextValue {
  const ctx = useContext(DataStoreContext);
  if (!ctx) {
    return {
      connectivity: getConnectivityState(),
      pendingCount: 0,
      refresh: async () => undefined,
      forceSync: async () => undefined,
    };
  }
  return ctx;
}
