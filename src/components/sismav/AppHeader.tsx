import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PressableScale } from '../premium/PressableScale';
import { FONT_BRAND, FONT_BRAND_SUB } from '../../theme/typography';
import { PREMIUM } from '../../theme/premium';
import { CloudUserLoadIndicator } from './CloudUserLoadIndicator';
import { useCloudSyncHeaderStatus } from '../../hooks/useCloudSyncHeaderStatus';
import { getMobileAppGlass } from '../mobile/mobileAppTheme';
import { useMobileLayout } from '../mobile/useMobileLayout';

export type CloudUserLoadProps = {
  /** @deprecated Preferir rótulo automático via useAccountCloudLabel no AppHeader. */
  label?: string;
  percent: number;
  loading: boolean;
};

type Props = {
  title: string;
  subtitle?: string;
  /** Usuário logado com barra de progresso do carregamento na nuvem. */
  cloudLoad?: CloudUserLoadProps;
  right?: React.ReactNode;
  darkHero?: boolean;
  onBack?: () => void;
};

export function AppHeader({ title, subtitle, cloudLoad, right, darkHero, onBack }: Props) {
  const { theme, isDark } = useTheme();
  const t = theme.tokens;
  const { isNativeMobile, isNarrowPhone } = useMobileLayout();
  const glass = getMobileAppGlass(theme);
  const {
    accountLabel,
    statusSuffix,
    loading: statusLoading,
    percent: statusPercent,
    uploading,
    syncing,
    receivingFromCloudOnly,
    statusHint,
    cloudDiffFlashMessage,
  } = useCloudSyncHeaderStatus(cloudLoad);

  if (isNativeMobile && !darkHero) {
    return (
      <View style={styles.mobileHeaderOuter}>
        <LinearGradient
          colors={[theme.primary, '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.mobileStripe}
        />
        <View
          style={[
            styles.mobileCard,
            {
              backgroundColor: glass.bg,
              borderColor: glass.border,
            },
            Platform.OS === 'web' ? null : {
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: theme.isDark ? 0.3 : 0.08,
              shadowRadius: 20,
              elevation: 6,
            },
          ]}
        >
          <View style={styles.mobileRow}>
            {onBack ? (
              <PressableScale onPress={onBack} style={styles.mobileSide} accessibilityLabel="Voltar">
                <View style={[styles.backCircle, { borderColor: glass.border, backgroundColor: glass.highlight }]}>
                  <ChevronLeft size={20} color={theme.text} strokeWidth={2.5} />
                </View>
              </PressableScale>
            ) : (
              <View style={styles.mobileSide} />
            )}
            <View style={styles.mobileTextCol}>
              <Text style={[styles.mobileKicker, { color: theme.primary }]}>SISTEMA TAF</Text>
              <Text
                style={[
                  styles.mobileTitle,
                  { color: theme.text, fontSize: isNarrowPhone ? 22 : 24 },
                ]}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.mobileSub, { color: theme.textSecondary }]}>{subtitle}</Text>
              ) : null}
              {accountLabel ? (
                <View style={styles.cloudBlock}>
                  <CloudUserLoadIndicator
                    accountName={accountLabel}
                    statusSuffix={statusSuffix}
                    percent={statusPercent}
                    loading={statusLoading && accountLabel !== 'Offline'}
                    uploading={uploading}
                    syncing={syncing}
                    receivingFromCloudOnly={receivingFromCloudOnly}
                    statusHint={statusHint}
                    cloudDiffFlashMessage={cloudDiffFlashMessage}
                  />
                </View>
              ) : null}
            </View>
            <View style={styles.mobileSide}>{right}</View>
          </View>
        </View>
      </View>
    );
  }

  if (darkHero) {
    return (
      <LinearGradient
        colors={[...t.gradientHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroRow}>
          {onBack ? (
            <PressableScale onPress={onBack} style={styles.sideSlot} accessibilityLabel="Voltar">
              <View style={[styles.backCircle, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.25)' }]}>
                <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            </PressableScale>
          ) : (
            <View style={styles.sideSlot} />
          )}
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, { fontFamily: FONT_BRAND }]}>{title}</Text>
            <View style={[styles.rule, styles.ruleCentered, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
            {subtitle ? (
              <Text style={[styles.heroSub, { fontFamily: FONT_BRAND_SUB }]}>{subtitle}</Text>
            ) : null}
            {accountLabel ? (
              <View style={styles.cloudBlock}>
                <CloudUserLoadIndicator
                  accountName={accountLabel}
                  statusSuffix={statusSuffix}
                  percent={statusPercent}
                  loading={statusLoading && accountLabel !== 'Offline'}
                  uploading={uploading}
                  syncing={syncing}
                  receivingFromCloudOnly={receivingFromCloudOnly}
                  statusHint={statusHint}
                  cloudDiffFlashMessage={cloudDiffFlashMessage}
                />
              </View>
            ) : null}
          </View>
          <View style={styles.sideSlot}>{right}</View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.wrap}>
      {onBack ? (
        <PressableScale onPress={onBack} style={styles.sideSlot} accessibilityLabel="Voltar">
          <View style={[styles.backCircle, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <ChevronLeft size={20} color={theme.text} strokeWidth={2.5} />
          </View>
        </PressableScale>
      ) : (
        <View style={styles.sideSlot} />
      )}
      <View style={styles.textCol}>
        <Text style={[theme.textStyles.brandTitle, styles.titleCenter, isDark && styles.titleOnDark]}>
          {title}
        </Text>
        <LinearGradient
          colors={[t.primary600, t.primary300]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.rule, styles.ruleCentered]}
        />
        {subtitle ? (
          <Text style={[theme.textStyles.brandSubtitle, styles.subtitleCenter]}>{subtitle}</Text>
        ) : null}
        {accountLabel ? (
          <View style={styles.cloudBlock}>
            <CloudUserLoadIndicator
              accountName={accountLabel}
              statusSuffix={statusSuffix}
              percent={statusPercent}
              loading={statusLoading && accountLabel !== 'Offline'}
              uploading={uploading}
              syncing={syncing}
              receivingFromCloudOnly={receivingFromCloudOnly}
              statusHint={statusHint}
              cloudDiffFlashMessage={cloudDiffFlashMessage}
            />
          </View>
        ) : null}
      </View>
      <View style={styles.sideSlot}>{right}</View>
    </View>
  );
}

const SIDE_SLOT = PREMIUM.minTouch;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    width: '100%',
  },
  sideSlot: {
    width: SIDE_SLOT,
    minHeight: SIDE_SLOT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  titleCenter: { textAlign: 'center', width: '100%' },
  subtitleCenter: {
    textAlign: 'center',
    width: '100%',
    marginTop: 6,
  },
  cloudBlock: {
    width: '100%',
    marginTop: 8,
  },
  titleOnDark: { color: '#f1f5f9' },
  rule: {
    width: 28,
    height: 2,
    borderRadius: 2,
    marginTop: 5,
    marginBottom: 0,
  },
  ruleCentered: { alignSelf: 'center' },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 10,
    width: '100%',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  heroText: { flex: 1, alignItems: 'center' },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textAlign: 'center',
    width: '100%',
  },
  heroSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: 6,
    textAlign: 'center',
    width: '100%',
  },
  mobileHeaderOuter: {
    width: '100%',
    marginBottom: 14,
    borderRadius: PREMIUM.radiusLg + 4,
    overflow: 'hidden',
  },
  mobileStripe: {
    height: 3,
    width: '100%',
  },
  mobileCard: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: PREMIUM.radiusLg + 4,
    borderBottomRightRadius: PREMIUM.radiusLg + 4,
    padding: 16,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  mobileSide: {
    width: SIDE_SLOT,
    minHeight: SIDE_SLOT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  mobileTextCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
  },
  mobileKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  mobileTitle: {
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
    lineHeight: 28,
  },
  mobileSub: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 2,
  },
});
