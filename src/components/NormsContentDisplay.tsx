import React, { useMemo } from 'react';

import {

  View,

  Text,

  ScrollView,

  StyleSheet,

  Platform,

  useWindowDimensions,

} from 'react-native';

import { useTheme } from '../contexts/ThemeContext';

import { PREMIUM } from '../theme/premium';
import { tableAvailableWidth } from '../theme/tableLayout';

import { fontFamily } from '../theme/typography';

import {

  parseNormasCgcfn108,

  formatNormasPath,

  isDisplayableNormasNote,

  type NormasTable,

  type NormasTableRow,

} from '../utils/parseNormasCgcfn108';



type Props = {

  normContent: string;

};



function NormasModernTable({ table }: { table: NormasTable }) {

  const { theme, fontsLoaded } = useTheme();

  const { width: screenWidth } = useWindowDimensions();

  const mono = theme.monoFont;

  const colCount = table.columns.length;

  const colMin = colCount <= 4 ? 88 : 72;

  const minContentWidth = 108 + Math.max(colCount - 1, 0) * colMin;

  const tableWidth = Math.max(tableAvailableWidth(screenWidth), minContentWidth);



  const headerBg = theme.isDark ? 'rgba(107, 124, 255, 0.22)' : theme.primary;

  const headerInk = theme.isDark ? theme.text : '#FFFFFF';

  const zebraA = theme.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)';

  const zebraB = theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';



  const renderCell = (value: string, isHeader: boolean, rowIndex: number, colIndex: number) => (

    <View

      key={`${rowIndex}-${colIndex}`}

      style={[

        styles.dataCell,

        {
          flex: 1,
          minWidth: colIndex === 0 ? 108 : colMin,
        },

        colIndex > 0 && styles.dataCellDivider,

        colIndex > 0 && { borderLeftColor: theme.borderSubtle },

      ]}

    >

      <Text

        style={[

          isHeader ? styles.headerCellText : styles.bodyCellText,

          {

            color: isHeader ? headerInk : theme.text,

            fontFamily: colIndex > 0 ? mono : fontFamily('semibold', fontsLoaded),

            fontWeight: isHeader ? '800' : colIndex === 0 ? '700' : '600',

          },

        ]}

        numberOfLines={2}

      >

        {value}

      </Text>

    </View>

  );



  const renderRow = (row: NormasTableRow, rowIndex: number) => {

    const cells = [row.idade, ...row.valores];

    const bg = rowIndex % 2 === 0 ? zebraA : zebraB;



    return (

      <View

        key={`row-${rowIndex}`}

        style={[styles.dataRow, { backgroundColor: bg, borderBottomColor: theme.borderSubtle }]}

      >

        {cells.map((cell, colIndex) => renderCell(cell, false, rowIndex, colIndex))}

      </View>

    );

  };



  return (

    <View

      style={[

        styles.tableShell,

        {

          backgroundColor: theme.cardBg,

          borderColor: theme.border,

        },

        Platform.OS === 'web'

          ? ({

              boxShadow: theme.isDark

                ? '0 12px 40px rgba(0,0,0,0.35)'

                : '0 8px 32px rgba(15,23,42,0.08)',

            } as object)

          : { elevation: 4 },

      ]}

    >

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        bounces={false}
        style={styles.tableScroll}
        contentContainerStyle={{ minWidth: tableWidth }}
      >

        <View style={{ width: tableWidth }}>

          <View style={[styles.headerRow, { backgroundColor: headerBg }]}>

            {table.columns.map((col, colIndex) => renderCell(col, true, -1, colIndex))}

          </View>

          {table.rows.map((row, idx) => renderRow(row, idx))}

        </View>

      </ScrollView>

    </View>

  );

}



export function NormsContentDisplay({ normContent }: Props) {

  const { theme } = useTheme();

  const ts = theme.textStyles;



  const parsed = useMemo(() => parseNormasCgcfn108(normContent), [normContent]);



  const displayNotes = useMemo(

    () => parsed.notes.filter(isDisplayableNormasNote),

    [parsed.notes],

  );



  return (

    <View style={styles.container}>

      <View style={styles.hero}>

        <Text style={[ts.caption, { color: theme.textSecondary }]}>CGCFN-108</Text>

        <Text style={[ts.h2, styles.heroTitle]}>Planilha de Consulta</Text>

        <Text style={[ts.bodySecondary, styles.heroDesc]}>

          Índices de avaliação física — pontuação por idade e modalidade

        </Text>

      </View>



      <ScrollView

        contentContainerStyle={styles.scrollContent}

        showsVerticalScrollIndicator={false}

      >

        {parsed.tables.map((table) => (

          <View key={table.id} style={styles.section}>

            <View style={styles.sectionHead}>

              <Text style={[ts.label, { color: theme.primary }]}>

                {formatNormasPath(table.path) || parsed.title}

              </Text>

              {table.caption ? (

                <Text style={[ts.caption, { color: theme.textMuted, marginTop: 4 }]}>{table.caption}</Text>

              ) : null}

            </View>

            <NormasModernTable table={table} />

          </View>

        ))}



        {displayNotes.map((note) => (

          <View

            key={note.id}

            style={[

              styles.noteCard,

              { backgroundColor: theme.backgroundSecondary, borderColor: theme.borderSubtle },

            ]}

          >

            <Text style={[ts.caption, { color: theme.textMuted, marginBottom: 6 }]}>

              {formatNormasPath(note.path)}

            </Text>

            <Text style={[ts.bodySecondary, { color: theme.text, lineHeight: 20 }]}>{note.text}</Text>

          </View>

        ))}



        <View style={{ height: 32 }} />

      </ScrollView>

    </View>

  );

}



const styles = StyleSheet.create({

  container: {

    flex: 1,

    paddingHorizontal: 16,

  },

  hero: {

    marginBottom: 16,

    paddingTop: 4,

  },

  heroTitle: {

    marginTop: 4,

    marginBottom: 6,

  },

  heroDesc: {

    lineHeight: 20,

  },

  scrollContent: {

    paddingBottom: 24,

    gap: 20,

  },

  section: {

    gap: 12,

    marginBottom: 8,

  },

  sectionHead: {

    paddingHorizontal: 2,

  },

  tableShell: {

    width: '100%',

    maxWidth: '100%',

    alignSelf: 'stretch',

    borderRadius: PREMIUM.radiusXl,

    borderWidth: 1,

    overflow: 'hidden',

  },

  tableScroll: {

    width: '100%',

    maxWidth: '100%',

  },

  headerRow: {

    flexDirection: 'row',

    alignItems: 'stretch',

    paddingVertical: 12,

  },

  dataRow: {

    flexDirection: 'row',

    alignItems: 'stretch',

    borderBottomWidth: StyleSheet.hairlineWidth,

    paddingVertical: 10,

  },

  dataCell: {

    paddingHorizontal: 12,

    justifyContent: 'center',

    paddingVertical: 4,

  },

  dataCellDivider: {

    borderLeftWidth: StyleSheet.hairlineWidth,

  },

  headerCellText: {

    fontSize: 11,

    letterSpacing: 0.6,

    textTransform: 'uppercase',

  },

  bodyCellText: {

    fontSize: 13,

    lineHeight: 18,

  },

  noteCard: {

    borderRadius: PREMIUM.radiusLg,

    borderWidth: 1,

    padding: 14,

    marginTop: 4,

  },

});


