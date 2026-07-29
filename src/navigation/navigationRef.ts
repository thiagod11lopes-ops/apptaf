import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateTab<Name extends keyof RootStackParamList>(
  name: Name,
  params?: RootStackParamList[Name],
) {
  if (!navigationRef.isReady()) return;
  if (params !== undefined) {
    (
      navigationRef.navigate as (
        n: Name,
        p: RootStackParamList[Name],
      ) => void
    )(name, params);
  } else {
    navigationRef.navigate(name as never);
  }
}

export function getCurrentRouteName(): keyof RootStackParamList {
  const name = navigationRef.getCurrentRoute()?.name;
  return (name ?? 'Home') as keyof RootStackParamList;
}
