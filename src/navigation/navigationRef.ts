import {
  createNavigationContainerRef,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import {
  isMainTabRoute,
  type AppRouteName,
  type MainTabParamList,
  type RootStackParamList,
} from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateTab<Name extends AppRouteName>(
  name: Name,
  params?: Name extends keyof MainTabParamList
    ? MainTabParamList[Name]
    : Name extends keyof RootStackParamList
      ? RootStackParamList[Name]
      : never,
) {
  if (!navigationRef.isReady()) return;

  if (isMainTabRoute(name)) {
    const tabName = name as keyof MainTabParamList;
    const tabParams = params as MainTabParamList[typeof tabName] | undefined;
    const nested: NavigatorScreenParams<MainTabParamList> =
      tabParams !== undefined
        ? ({ screen: tabName, params: tabParams } as NavigatorScreenParams<MainTabParamList>)
        : ({ screen: tabName } as NavigatorScreenParams<MainTabParamList>);
    navigationRef.navigate('MainTabs', nested);
    return;
  }

  if (params !== undefined) {
    (
      navigationRef.navigate as (
        n: Exclude<Name, keyof MainTabParamList>,
        p: RootStackParamList[Exclude<Name, keyof MainTabParamList>],
      ) => void
    )(name as Exclude<Name, keyof MainTabParamList>, params as never);
  } else {
    navigationRef.navigate(name as never);
  }
}

/** Nome da rota folha (aba ou stack) — usado pela chrome. */
export function getCurrentRouteName(): AppRouteName {
  const name = navigationRef.getCurrentRoute()?.name;
  return (name ?? 'Home') as AppRouteName;
}
