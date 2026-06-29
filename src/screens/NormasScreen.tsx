import React from 'react';
import { StyleSheet } from 'react-native';
import { MobileScreenScaffold } from '../components/mobile/MobileScreenScaffold';
import { TafCenteredTabHeader } from '../components/mobile/TafTabChrome';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { NormsContentDisplay } from '../components/NormsContentDisplay';
import { CGCFN_108_NORM_CONTENT } from '../data/normasData';

export default function NormasScreen() {
  return (
    <MobileScreenScaffold scroll={false} contentContainerStyle={styles.page}>
      <TafCenteredTabHeader
        title="Normas"
        subtitle="CGCFN-108 · tabelas e regras oficiais"
        footer={<TopActionIcons activeRoute="Normas" inline centered />}
      />
      <NormsContentDisplay normContent={CGCFN_108_NORM_CONTENT} />
    </MobileScreenScaffold>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: 4 },
});
