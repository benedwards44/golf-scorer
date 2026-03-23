import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { HoleConfig, Game } from '../utils/types';
import { loadGame, saveGame } from '../utils/storage';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';

export default function HoleSetupScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [holes, setHoles] = useState<HoleConfig[]>([]);

  useEffect(() => {
    if (gameId) {
      loadGame(gameId).then((g) => {
        if (g) {
          setGame(g);
          setHoles([...g.course.holes]);
        }
      });
    }
  }, [gameId]);

  function updateHole(idx: number, field: 'par' | 'strokeIndex', raw: string) {
    const val = parseInt(raw);
    setHoles((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: isNaN(val) ? 0 : val };
      return updated;
    });
  }

  async function save() {
    // Validate
    for (const h of holes) {
      if (h.par < 3 || h.par > 5) {
        Alert.alert('Invalid Par', `Hole ${h.hole}: par must be 3, 4 or 5.`);
        return;
      }
      if (h.strokeIndex < 1 || h.strokeIndex > 18) {
        Alert.alert('Invalid Stroke Index', `Hole ${h.hole}: stroke index must be 1–18.`);
        return;
      }
    }
    // Check all stroke indexes are unique
    const indexes = holes.map((h) => h.strokeIndex);
    const unique = new Set(indexes);
    if (unique.size !== 18) {
      Alert.alert('Duplicate Stroke Indexes', 'Each hole must have a unique stroke index (1–18).');
      return;
    }

    if (!game) return;
    const updated: Game = {
      ...game,
      course: { ...game.course, holes },
    };
    await saveGame(updated);
    router.back();
  }

  if (!game) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Hole Setup',
          headerRight: () => (
            <Pressable onPress={save} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: Colors.white, fontWeight: '700', fontSize: FontSize.base }}>
                Save
              </Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.container}>
        {/* Column headers */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.holeCol]}>Hole</Text>
          <Text style={[styles.headerCell, styles.parCol]}>Par</Text>
          <Text style={[styles.headerCell, styles.siCol]}>Stroke Index</Text>
        </View>

        <FlatList
          data={holes}
          keyExtractor={(h) => String(h.hole)}
          renderItem={({ item, index }) => (
            <View style={[styles.row, index % 2 === 0 && styles.rowAlt]}>
              <View style={styles.holeCol}>
                <View style={styles.holeBadge}>
                  <Text style={styles.holeNum}>{item.hole}</Text>
                </View>
              </View>
              <View style={styles.parCol}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(item.par)}
                  onChangeText={(v) => updateHole(index, 'par', v)}
                  selectTextOnFocus
                  returnKeyType="done"
                />
              </View>
              <View style={styles.siCol}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(item.strokeIndex)}
                  onChangeText={(v) => updateHole(index, 'strokeIndex', v)}
                  selectTextOnFocus
                  returnKeyType="done"
                />
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
        />

        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Stroke index (S/I) ranks holes 1–18 by difficulty. Found on the course scorecard.
          </Text>
        </View>
      </View>
    </>
  );
}

const COL_HOLE = 64;
const COL_PAR = 80;
const COL_SI = 120;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.offWhite },
  list: { paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: Colors.green,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  headerCell: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  holeCol: { width: COL_HOLE },
  parCol: { width: COL_PAR },
  siCol: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowAlt: { backgroundColor: Colors.offWhite },
  holeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.greenMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holeNum: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.green },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    textAlign: 'center',
    width: 60,
  },
  hint: {
    margin: Spacing.base,
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  hintText: { fontSize: FontSize.sm, color: Colors.info },
});
