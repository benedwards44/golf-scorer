import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Game, PlayerRoundSummary } from '../utils/types';
import { buildGameSummaries, getScoreColor } from '../utils/calculations';
import { loadGame, saveGame } from '../utils/storage';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ScoringScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [currentHole, setCurrentHole] = useState(0); // 0-indexed
  const [summaries, setSummaries] = useState<PlayerRoundSummary[]>([]);
  const [view, setView] = useState<'scoring' | 'leaderboard'>('scoring');
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      if (gameId) loadGame(gameId).then((g) => {
        if (g) {
          setGame(g);
          setSummaries(buildGameSummaries(g));
          // Jump to first unplayed hole (only on first load)
          setCurrentHole((prev) => {
            if (prev > 0) return prev;
            const firstUnplayed = g.rounds[0]?.scores.findIndex((s) => s.strokes === null);
            return firstUnplayed !== undefined && firstUnplayed >= 0 ? firstUnplayed : 0;
          });
        }
      });
    }, [gameId])
  );

  async function updateScore(playerId: string, holeIdx: number, strokes: number) {
    if (!game) return;
    const updated: Game = {
      ...game,
      rounds: game.rounds.map((r) => {
        if (r.playerId !== playerId) return r;
        const scores = [...r.scores];
        scores[holeIdx] = { strokes };
        return { ...r, scores };
      }),
    };
    // Check if complete
    const allDone = updated.rounds.every((r) => r.scores.every((s) => s.strokes !== null));
    updated.completed = allDone;
    setGame(updated);
    setSummaries(buildGameSummaries(updated));
    await saveGame(updated);
  }

  async function clearScore(playerId: string, holeIdx: number) {
    if (!game) return;
    const updated: Game = {
      ...game,
      rounds: game.rounds.map((r) => {
        if (r.playerId !== playerId) return r;
        const scores = [...r.scores];
        scores[holeIdx] = { strokes: null };
        return { ...r, scores };
      }),
      completed: false,
    };
    setGame(updated);
    setSummaries(buildGameSummaries(updated));
    await saveGame(updated);
  }

  function goToHole(idx: number) {
    setCurrentHole(idx);
    flatListRef.current?.scrollToIndex({ index: idx, animated: true });
  }

  if (!game) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const hole = game.course.holes[currentHole];
  const holeHandicapInfo = summaries.map((s) => ({
    player: s.player,
    extraStrokes: s.holes[currentHole].extraStrokes,
    strokes: s.holes[currentHole].strokes,
    stableford: s.holes[currentHole].stablefordPoints,
  }));

  return (
    <>
      <Stack.Screen
        options={{
          title: game.course.name,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => router.push({ pathname: '/hole-setup', params: { gameId: game.id } })}
                style={{ paddingHorizontal: 4 }}
              >
                <Ionicons name="options-outline" size={24} color={Colors.white} />
              </Pressable>
              <Pressable
                onPress={() => setView(view === 'scoring' ? 'leaderboard' : 'scoring')}
                style={{ paddingHorizontal: 4 }}
              >
                <Ionicons
                  name={view === 'scoring' ? 'podium-outline' : 'golf-outline'}
                  size={24}
                  color={Colors.white}
                />
              </Pressable>
            </View>
          ),
        }}
      />

      {view === 'scoring' ? (
        <View style={{ flex: 1 }}>
          {/* Hole selector strip */}
          <View style={styles.holeSelectorContainer}>
            <FlatList
              ref={flatListRef}
              data={game.course.holes}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(h) => String(h.hole)}
              contentContainerStyle={styles.holeSelector}
              initialScrollIndex={currentHole}
              getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
              renderItem={({ item, index }) => {
                const allScored = game.rounds.every(
                  (r) => r.scores[index].strokes !== null
                );
                const isActive = index === currentHole;
                return (
                  <Pressable
                    style={[
                      styles.holePill,
                      isActive && styles.holePillActive,
                      allScored && !isActive && styles.holePillDone,
                    ]}
                    onPress={() => goToHole(index)}
                  >
                    <Text
                      style={[
                        styles.holePillText,
                        isActive && styles.holePillTextActive,
                        allScored && !isActive && styles.holePillTextDone,
                      ]}
                    >
                      {item.hole}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          {/* Hole info bar */}
          <View style={styles.holeInfo}>
            <View style={styles.holeInfoItem}>
              <Text style={styles.holeInfoLabel}>HOLE</Text>
              <Text style={styles.holeInfoValue}>{hole.hole}</Text>
            </View>
            <View style={styles.holeInfoDivider} />
            <View style={styles.holeInfoItem}>
              <Text style={styles.holeInfoLabel}>PAR</Text>
              <Text style={styles.holeInfoValue}>{hole.par}</Text>
            </View>
            <View style={styles.holeInfoDivider} />
            <View style={styles.holeInfoItem}>
              <Text style={styles.holeInfoLabel}>S/I</Text>
              <Text style={styles.holeInfoValue}>{hole.strokeIndex}</Text>
            </View>
          </View>

          {/* Player scoring cards */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.playerList}>
            {summaries.map((summary, pIdx) => {
              const holeData = holeHandicapInfo[pIdx];
              const currentStrokes = holeData.strokes;

              return (
                <View key={summary.player.id} style={styles.playerCard}>
                  <View style={styles.playerHeader}>
                    <View>
                      <Text style={styles.playerName}>{summary.player.name}</Text>
                      <Text style={styles.playerSub}>
                        HCP {summary.player.handicap} · Course HCP {summary.courseHandicap}
                        {holeData.extraStrokes > 0 ? ` · +${holeData.extraStrokes} here` : ''}
                      </Text>
                    </View>
                    <View style={styles.playerTotals}>
                      <View style={styles.totalItem}>
                        <Text style={styles.totalLabel}>Strokes</Text>
                        <Text style={styles.totalValue}>
                          {summary.holesPlayed > 0 ? summary.totalStrokes : '—'}
                        </Text>
                      </View>
                      <View style={styles.totalDivider} />
                      <View style={styles.totalItem}>
                        <Text style={[styles.totalLabel, { color: Colors.stableford }]}>
                          Stableford
                        </Text>
                        <Text style={[styles.totalValue, { color: Colors.stableford }]}>
                          {summary.holesPlayed > 0 ? summary.totalStableford : '—'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Score stepper */}
                  <View style={styles.scoreRow}>
                    <Pressable
                      style={[styles.stepBtn, styles.stepBtnMinus]}
                      onPress={() => {
                        if (currentStrokes !== null && currentStrokes > 1) {
                          updateScore(summary.player.id, currentHole, currentStrokes - 1);
                        }
                      }}
                      disabled={currentStrokes === null || currentStrokes <= 1}
                    >
                      <Text style={styles.stepBtnText}>−</Text>
                    </Pressable>

                    <Pressable
                      style={styles.scoreDisplay}
                      onLongPress={() => {
                        Alert.alert('Clear Score', `Clear ${summary.player.name}'s score for hole ${hole.hole}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Clear', style: 'destructive', onPress: () => clearScore(summary.player.id, currentHole) },
                        ]);
                      }}
                    >
                      {currentStrokes !== null ? (
                        <>
                          <Text
                            style={[
                              styles.scoreValue,
                              { color: getScoreColor(currentStrokes, hole.par) },
                            ]}
                          >
                            {currentStrokes}
                          </Text>
                          <Text style={styles.stablefordPoints}>
                            {holeData.stableford} pts
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.scorePlaceholder}>—</Text>
                      )}
                    </Pressable>

                    <Pressable
                      style={[styles.stepBtn, styles.stepBtnPlus]}
                      onPress={() => {
                        const next = currentStrokes !== null ? currentStrokes + 1 : hole.par;
                        updateScore(summary.player.id, currentHole, next);
                      }}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </Pressable>
                  </View>

                  {/* Quick-pick row */}
                  <View style={styles.quickPick}>
                    {[hole.par - 2, hole.par - 1, hole.par, hole.par + 1, hole.par + 2, hole.par + 3].map(
                      (s) => s > 0 && (
                        <Pressable
                          key={s}
                          style={[
                            styles.quickBtn,
                            currentStrokes === s && styles.quickBtnActive,
                            currentStrokes === s && {
                              backgroundColor: getScoreColor(s, hole.par) + '22',
                              borderColor: getScoreColor(s, hole.par),
                            },
                          ]}
                          onPress={() => updateScore(summary.player.id, currentHole, s)}
                        >
                          <Text
                            style={[
                              styles.quickBtnText,
                              currentStrokes === s && { color: getScoreColor(s, hole.par), fontWeight: '700' },
                            ]}
                          >
                            {s}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Prev / Next hole navigation */}
          <View style={styles.holeNav}>
            <Pressable
              style={[styles.navBtn, currentHole === 0 && styles.navBtnDisabled]}
              onPress={() => goToHole(currentHole - 1)}
              disabled={currentHole === 0}
            >
              <Ionicons name="chevron-back" size={20} color={currentHole === 0 ? Colors.textMuted : Colors.green} />
              <Text style={[styles.navBtnText, currentHole === 0 && styles.navBtnTextDisabled]}>
                Hole {currentHole}
              </Text>
            </Pressable>

            <Pressable
              style={styles.leaderboardNavBtn}
              onPress={() => setView('leaderboard')}
            >
              <Ionicons name="podium-outline" size={18} color={Colors.white} />
              <Text style={styles.leaderboardNavText}>Scores</Text>
            </Pressable>

            <Pressable
              style={[styles.navBtn, styles.navBtnRight, currentHole === 17 && styles.navBtnDisabled]}
              onPress={() => goToHole(currentHole + 1)}
              disabled={currentHole === 17}
            >
              <Text style={[styles.navBtnText, currentHole === 17 && styles.navBtnTextDisabled]}>
                Hole {currentHole + 2}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={currentHole === 17 ? Colors.textMuted : Colors.green} />
            </Pressable>
          </View>
        </View>
      ) : (
        <LeaderboardView
          summaries={summaries}
          course={game.course}
          onBack={() => setView('scoring')}
          onHolePress={(holeIdx) => { setCurrentHole(holeIdx); setView('scoring'); }}
        />
      )}
    </>
  );
}

// ─── Leaderboard View ────────────────────────────────────────────────────────

function LeaderboardView({
  summaries,
  course,
  onBack,
  onHolePress,
}: {
  summaries: PlayerRoundSummary[];
  course: any;
  onBack: () => void;
  onHolePress: (holeIdx: number) => void;
}) {
  const [tab, setTab] = useState<'stableford' | 'strokes'>('stableford');

  const sorted = [...summaries].sort((a, b) => {
    if (tab === 'stableford') return b.totalStableford - a.totalStableford;
    const aS = a.totalStrokes ?? 9999;
    const bS = b.totalStrokes ?? 9999;
    return aS - bS;
  });

  return (
    <View style={{ flex: 1 }}>
      {/* Tab switcher */}
      <View style={lbStyles.tabs}>
        <Pressable
          style={[lbStyles.tab, tab === 'stableford' && lbStyles.tabActive]}
          onPress={() => setTab('stableford')}
        >
          <Text style={[lbStyles.tabText, tab === 'stableford' && lbStyles.tabTextActive]}>
            Stableford
          </Text>
        </Pressable>
        <Pressable
          style={[lbStyles.tab, tab === 'strokes' && lbStyles.tabActive]}
          onPress={() => setTab('strokes')}
        >
          <Text style={[lbStyles.tabText, tab === 'strokes' && lbStyles.tabTextActive]}>
            Strokes
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={lbStyles.list}>
        {/* Player rankings */}
        <Text style={lbStyles.sectionHeading}>Rankings</Text>
        {sorted.map((s, idx) => (
          <View key={s.player.id} style={lbStyles.playerRow}>
            <View style={[lbStyles.rank, idx === 0 && lbStyles.rankFirst]}>
              <Text style={[lbStyles.rankText, idx === 0 && lbStyles.rankTextFirst]}>
                {idx + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={lbStyles.playerName}>{s.player.name}</Text>
              <Text style={lbStyles.playerSub}>
                {s.holesPlayed} holes played · Course HCP {s.courseHandicap}
              </Text>
            </View>
            <View style={lbStyles.scoreGroup}>
              <View style={lbStyles.scoreCol}>
                <Text style={lbStyles.scoreLabel}>Strokes</Text>
                <Text style={lbStyles.scoreVal}>
                  {s.holesPlayed > 0 ? s.totalStrokes : '—'}
                </Text>
              </View>
              <View style={[lbStyles.scoreCol, lbStyles.stablefordCol]}>
                <Text style={[lbStyles.scoreLabel, { color: Colors.stableford }]}>
                  Stableford
                </Text>
                <Text style={[lbStyles.scoreVal, { color: Colors.stableford }]}>
                  {s.holesPlayed > 0 ? s.totalStableford : '—'}
                </Text>
              </View>
            </View>
          </View>
        ))}

        {/* Hole-by-hole grid */}
        <Text style={[lbStyles.sectionHeading, { marginTop: Spacing.xl }]}>
          Scorecard
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Header row */}
            <View style={lbStyles.gridRow}>
              <View style={lbStyles.gridPlayerCell}>
                <Text style={lbStyles.gridHeader}>Player</Text>
              </View>
              {course.holes.map((h: any) => (
                <Pressable
                  key={h.hole}
                  style={lbStyles.gridHoleCell}
                  onPress={() => { onBack(); onHolePress(h.hole - 1); }}
                >
                  <Text style={lbStyles.gridHeader}>{h.hole}</Text>
                  <Text style={lbStyles.gridParText}>p{h.par}</Text>
                </Pressable>
              ))}
              <View style={lbStyles.gridTotalCell}>
                <Text style={lbStyles.gridHeader}>Tot</Text>
              </View>
              <View style={lbStyles.gridTotalCell}>
                <Text style={[lbStyles.gridHeader, { color: Colors.stableford }]}>Stb</Text>
              </View>
            </View>

            {/* Player rows */}
            {summaries.map((s) => (
              <View key={s.player.id} style={lbStyles.gridRow}>
                <View style={lbStyles.gridPlayerCell}>
                  <Text style={lbStyles.gridPlayerName} numberOfLines={1}>
                    {s.player.name}
                  </Text>
                </View>
                {s.holes.map((h) => (
                  <View key={h.hole} style={lbStyles.gridHoleCell}>
                    <Text
                      style={[
                        lbStyles.gridScore,
                        { color: getScoreColor(h.strokes, h.par) },
                      ]}
                    >
                      {h.strokes ?? '·'}
                    </Text>
                  </View>
                ))}
                <View style={lbStyles.gridTotalCell}>
                  <Text style={lbStyles.gridTotalScore}>
                    {s.holesPlayed > 0 ? s.totalStrokes : '—'}
                  </Text>
                </View>
                <View style={lbStyles.gridTotalCell}>
                  <Text style={[lbStyles.gridTotalScore, { color: Colors.stableford }]}>
                    {s.holesPlayed > 0 ? s.totalStableford : '—'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const lbStyles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.green },
  tabText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: Colors.green },
  list: { padding: Spacing.base, paddingBottom: 48 },
  sectionHeading: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankFirst: { backgroundColor: Colors.green, borderColor: Colors.green },
  rankText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textSecondary },
  rankTextFirst: { color: Colors.white },
  playerName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  playerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  scoreGroup: { flexDirection: 'row', gap: Spacing.sm },
  scoreCol: { alignItems: 'center', minWidth: 50 },
  stablefordCol: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    paddingLeft: Spacing.sm,
  },
  scoreLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 1 },
  scoreVal: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  // Grid
  gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  gridPlayerCell: {
    width: 90,
    padding: Spacing.sm,
    backgroundColor: Colors.offWhite,
    justifyContent: 'center',
  },
  gridHoleCell: {
    width: 36,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTotalCell: {
    width: 42,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.offWhite,
  },
  gridHeader: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  gridParText: { fontSize: 9, color: Colors.textMuted },
  gridPlayerName: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textPrimary },
  gridScore: { fontSize: FontSize.sm, fontWeight: '600' },
  gridTotalScore: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
});

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.base },
  holeSelectorContainer: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  holeSelector: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, gap: 4 },
  holePill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  holePillActive: { backgroundColor: Colors.green, borderColor: Colors.green },
  holePillDone: { backgroundColor: Colors.greenMuted, borderColor: Colors.green },
  holePillText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  holePillTextActive: { color: Colors.white },
  holePillTextDone: { color: Colors.green },
  holeInfo: {
    flexDirection: 'row',
    backgroundColor: Colors.green,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.xxl,
  },
  holeInfoItem: { alignItems: 'center' },
  holeInfoLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  holeInfoValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.white },
  holeInfoDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  playerList: { padding: Spacing.sm, gap: Spacing.sm, paddingBottom: 80 },
  playerCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  playerName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  playerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  playerTotals: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  totalItem: { alignItems: 'center' },
  totalLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  totalDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  stepBtnMinus: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  stepBtnPlus: { borderColor: Colors.green, backgroundColor: Colors.greenMuted },
  stepBtnText: { fontSize: 24, fontWeight: '300', color: Colors.textPrimary, lineHeight: 28 },
  scoreDisplay: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.offWhite,
  },
  scoreValue: { fontSize: 32, fontWeight: '800' },
  stablefordPoints: { fontSize: FontSize.xs, color: Colors.stableford, fontWeight: '600' },
  scorePlaceholder: { fontSize: 32, color: Colors.textMuted, fontWeight: '300' },
  quickPick: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  quickBtn: {
    width: 40,
    height: 36,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.offWhite,
  },
  quickBtnActive: {},
  quickBtnText: { fontSize: FontSize.base, fontWeight: '500', color: Colors.textSecondary },
  holeNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  navBtnRight: {},
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.green },
  navBtnTextDisabled: { color: Colors.textMuted },
  leaderboardNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.green,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  leaderboardNavText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
});