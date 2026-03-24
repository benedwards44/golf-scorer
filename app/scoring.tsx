import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const [editingPlayers, setEditingPlayers] = useState(false);
  const [playerDrafts, setPlayerDrafts] = useState<{ name: string; handicap: string }[]>([]);
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
        scores[holeIdx] = { ...scores[holeIdx], strokes };
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

  async function updateWolfPoints(playerId: string, holeIdx: number, wolfPoints: number | null) {
    if (!game) return;
    const updated: Game = {
      ...game,
      rounds: game.rounds.map((r) => {
        if (r.playerId !== playerId) return r;
        const scores = [...r.scores];
        scores[holeIdx] = { ...scores[holeIdx], wolfPoints };
        return { ...r, scores };
      }),
    };
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
        scores[holeIdx] = { strokes: null, wolfPoints: scores[holeIdx].wolfPoints ?? null };
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

  function openEditPlayers() {
    if (!game) return;
    setPlayerDrafts(
      game.players.map((p) => ({ name: p.name, handicap: String(p.handicap) }))
    );
    setEditingPlayers(true);
  }

  async function saveEditedPlayers() {
    if (!game) return;
    for (const d of playerDrafts) {
      if (!d.name.trim()) {
        Alert.alert('Missing Name', 'All players must have a name.');
        return;
      }
      const hcp = parseFloat(d.handicap);
      if (isNaN(hcp) || hcp < -10 || hcp > 54) {
        Alert.alert('Invalid Handicap', `Handicap for "${d.name}" must be between -10 and 54.`);
        return;
      }
    }
    const updated: Game = {
      ...game,
      players: game.players.map((p, idx) => ({
        ...p,
        name: playerDrafts[idx].name.trim(),
        handicap: parseFloat(playerDrafts[idx].handicap) || 0,
      })),
    };
    setGame(updated);
    setSummaries(buildGameSummaries(updated));
    await saveGame(updated);
    setEditingPlayers(false);
  }

  if (!game) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const wolfEnabled = game.wolfEnabled !== false;
  const hole = game.course.holes[currentHole];
  const holeHandicapInfo = summaries.map((s) => ({
    player: s.player,
    extraStrokes: s.holes[currentHole].extraStrokes,
    strokes: s.holes[currentHole].strokes,
    stableford: s.holes[currentHole].stablefordPoints,
    wolfPoints: s.holes[currentHole].wolfPoints,
  }));

  return (
    <>
      <Stack.Screen
        options={{
          title: game.course.name,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={openEditPlayers}
                style={{ paddingHorizontal: 4 }}
              >
                <Ionicons name="people-outline" size={24} color={Colors.white} />
              </Pressable>
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
                          Stabies
                        </Text>
                        <Text style={[styles.totalValue, { color: Colors.stableford }]}>
                          {summary.holesPlayed > 0 ? summary.totalStableford : '—'}
                        </Text>
                      </View>
                      {wolfEnabled && (
                        <>
                          <View style={styles.totalDivider} />
                          <View style={styles.totalItem}>
                            <Text style={[styles.totalLabel, { color: Colors.wolf }]}>
                              🐺 Wolf
                            </Text>
                            <Text style={[styles.totalValue, { color: Colors.wolf }]}>
                              {summary.totalWolfPoints > 0 ? summary.totalWolfPoints : '—'}
                            </Text>
                          </View>
                        </>
                      )}
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

                  {/* Wolf points row */}
                  {wolfEnabled && (
                    <View style={styles.wolfRow}>
                      <Text style={styles.wolfLabel}>🐺 Wolf Points</Text>
                      <View style={styles.wolfStepper}>
                        <Pressable
                          style={styles.wolfStepBtn}
                          onPress={() => {
                            const cur = holeData.wolfPoints ?? 0;
                            if (cur > 0) updateWolfPoints(summary.player.id, currentHole, cur - 1);
                            else updateWolfPoints(summary.player.id, currentHole, null);
                          }}
                        >
                          <Text style={styles.wolfStepText}>−</Text>
                        </Pressable>
                        <TextInput
                          style={styles.wolfInput}
                          keyboardType="number-pad"
                          value={holeData.wolfPoints !== null ? String(holeData.wolfPoints) : ''}
                          placeholder="—"
                          placeholderTextColor={Colors.textMuted}
                          onChangeText={(v) => {
                            if (v === '' || v === '-') {
                              updateWolfPoints(summary.player.id, currentHole, null);
                            } else {
                              const n = parseInt(v);
                              if (!isNaN(n) && n >= 0) updateWolfPoints(summary.player.id, currentHole, n);
                            }
                          }}
                          selectTextOnFocus
                          returnKeyType="done"
                        />
                        <Pressable
                          style={styles.wolfStepBtn}
                          onPress={() => {
                            const cur = holeData.wolfPoints ?? 0;
                            updateWolfPoints(summary.player.id, currentHole, cur + 1);
                          }}
                        >
                          <Text style={styles.wolfStepText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
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
          wolfEnabled={wolfEnabled}
          onBack={() => setView('scoring')}
          onHolePress={(holeIdx) => { setCurrentHole(holeIdx); setView('scoring'); }}
        />
      )}

      {/* ── Edit Players Modal ── */}
      <Modal
        visible={editingPlayers}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditingPlayers(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={editStyles.header}>
            <Pressable onPress={() => setEditingPlayers(false)} style={editStyles.cancelBtn}>
              <Text style={editStyles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={editStyles.title}>Edit Players</Text>
            <Pressable onPress={saveEditedPlayers} style={editStyles.saveBtn}>
              <Text style={editStyles.saveText}>Save</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={editStyles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={editStyles.hint}>
              Changes to handicap will recalculate Stableford points for all holes.
            </Text>
            {playerDrafts.map((draft, idx) => (
              <View key={idx} style={editStyles.playerRow}>
                <View style={editStyles.playerNum}>
                  <Text style={editStyles.playerNumText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={editStyles.fieldLabel}>Name</Text>
                  <TextInput
                    style={editStyles.input}
                    value={draft.name}
                    onChangeText={(v) =>
                      setPlayerDrafts((prev) =>
                        prev.map((d, i) => (i === idx ? { ...d, name: v } : d))
                      )
                    }
                    placeholder={`Player ${idx + 1}`}
                    returnKeyType="next"
                  />
                </View>
                <View style={editStyles.handicapCol}>
                  <Text style={editStyles.fieldLabel}>HCP</Text>
                  <TextInput
                    style={[editStyles.input, editStyles.handicapInput]}
                    value={draft.handicap}
                    onChangeText={(v) =>
                      setPlayerDrafts((prev) =>
                        prev.map((d, i) => (i === idx ? { ...d, handicap: v } : d))
                      )
                    }
                    keyboardType="numbers-and-punctuation"
                    returnKeyType="done"
                    selectTextOnFocus
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Leaderboard View ────────────────────────────────────────────────────────

function LeaderboardView({
  summaries,
  course,
  wolfEnabled,
  onBack,
  onHolePress,
}: {
  summaries: PlayerRoundSummary[];
  course: any;
  wolfEnabled: boolean;
  onBack: () => void;
  onHolePress: (holeIdx: number) => void;
}) {
  const sorted = [...summaries].sort((a, b) => b.totalStableford - a.totalStableford);

  return (
    <View style={{ flex: 1 }}>
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
                  Stabies
                </Text>
                <Text style={[lbStyles.scoreVal, { color: Colors.stableford }]}>
                  {s.holesPlayed > 0 ? s.totalStableford : '—'}
                </Text>
              </View>
              {wolfEnabled && (
                <View style={[lbStyles.scoreCol, lbStyles.stablefordCol]}>
                  <Text style={[lbStyles.scoreLabel, { color: Colors.wolf }]}>
                    🐺 Wolf
                  </Text>
                  <Text style={[lbStyles.scoreVal, { color: Colors.wolf }]}>
                    {s.totalWolfPoints > 0 ? s.totalWolfPoints : '—'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ))}

        {/* Hole-by-hole grid */}
        <Text style={[lbStyles.sectionHeading, { marginTop: Spacing.xl }]}>
          Scorecard
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header row */}
            <View style={lbStyles.gridRow}>
              <View style={lbStyles.gridLeftHeaderCell}>
                <Text style={lbStyles.gridHeaderHoleText}>HOLE</Text>
                <Text style={lbStyles.gridHeaderParText}>PAR</Text>
                <Text style={lbStyles.gridHeaderParText}>INDEX</Text>
              </View>
              {course.holes.slice(0, 9).map((h: any) => (
                <Pressable
                  key={h.hole}
                  style={lbStyles.gridHoleCell}
                  onPress={() => { onBack(); onHolePress(h.hole - 1); }}
                >
                  <Text style={lbStyles.gridHeader}>{h.hole}</Text>
                  <Text style={lbStyles.gridParText}>{h.par}</Text>
                  <Text style={lbStyles.gridSiText}>{h.strokeIndex}</Text>
                </Pressable>
              ))}
              {course.holes.length > 9 && (
                <View style={[lbStyles.gridTotalCell, { justifyContent: 'flex-start' }]}>
                  <Text style={lbStyles.gridHeader}>IN</Text>
                  <Text style={lbStyles.gridParText}>
                    {course.holes.slice(0, 9).reduce((sum: number, h: any) => sum + h.par, 0)}
                  </Text>
                </View>
              )}
              {course.holes.slice(9).map((h: any) => (
                <Pressable
                  key={h.hole}
                  style={lbStyles.gridHoleCell}
                  onPress={() => { onBack(); onHolePress(h.hole - 1); }}
                >
                  <Text style={lbStyles.gridHeader}>{h.hole}</Text>
                  <Text style={lbStyles.gridParText}>{h.par}</Text>
                  <Text style={lbStyles.gridSiText}>{h.strokeIndex}</Text>
                </Pressable>
              ))}
              {course.holes.length > 9 && (
                <View style={[lbStyles.gridTotalCell, { justifyContent: 'flex-start' }]}>
                  <Text style={lbStyles.gridHeader}>OUT</Text>
                  <Text style={lbStyles.gridParText}>
                    {course.holes.slice(9).reduce((sum: number, h: any) => sum + h.par, 0)}
                  </Text>
                </View>
              )}
              <View style={[lbStyles.gridTotalCell, { justifyContent: 'flex-start' }]}>
                <Text style={lbStyles.gridHeader}>TOTAL</Text>
              </View>
            </View>

            {/* One group of 3 rows per player */}
            {summaries.map((s, playerIdx) => {
              const has18 = s.holes.length > 9;
              const front9 = s.holes.slice(0, 9);
              const back9 = s.holes.slice(9);

              const front9Strokes = front9.reduce((sum, h) => sum + (h.strokes ?? 0), 0);
              const back9Strokes = back9.reduce((sum, h) => sum + (h.strokes ?? 0), 0);
              const front9Played = front9.some(h => h.strokes !== null);
              const back9Played = back9.some(h => h.strokes !== null);

              const front9Stableford = front9.reduce((sum, h) => sum + (h.stablefordPoints ?? 0), 0);
              const back9Stableford = back9.reduce((sum, h) => sum + (h.stablefordPoints ?? 0), 0);

              const front9Wolf = front9.reduce((sum, h) => sum + (h.wolfPoints ?? 0), 0);
              const back9Wolf = back9.reduce((sum, h) => sum + (h.wolfPoints ?? 0), 0);

              return (
                <View key={s.player.id} style={playerIdx > 0 ? lbStyles.playerGroup : undefined}>
                  {/* Player name spanning row */}
                  <View style={lbStyles.gridNameRow}>
                    <Text style={lbStyles.gridPlayerName} numberOfLines={1}>
                      {s.player.name}
                    </Text>
                  </View>

                  {/* Strokes row */}
                  <View style={lbStyles.gridRow}>
                    <View style={lbStyles.gridLabelCell}>
                      <Text style={lbStyles.gridRowLabel}>Stk</Text>
                    </View>
                    {front9.map((h) => (
                      <View key={h.hole} style={lbStyles.gridHoleCell}>
                        <Text style={[lbStyles.gridScore, { color: getScoreColor(h.strokes, h.par) }]}>
                          {h.strokes ?? '·'}
                        </Text>
                      </View>
                    ))}
                    {has18 && (
                      <View style={lbStyles.gridTotalCell}>
                        <Text style={lbStyles.gridTotalScore}>
                          {front9Played ? front9Strokes : '—'}
                        </Text>
                      </View>
                    )}
                    {back9.map((h) => (
                      <View key={h.hole} style={lbStyles.gridHoleCell}>
                        <Text style={[lbStyles.gridScore, { color: getScoreColor(h.strokes, h.par) }]}>
                          {h.strokes ?? '·'}
                        </Text>
                      </View>
                    ))}
                    {has18 && (
                      <View style={lbStyles.gridTotalCell}>
                        <Text style={lbStyles.gridTotalScore}>
                          {back9Played ? back9Strokes : '—'}
                        </Text>
                      </View>
                    )}
                    <View style={lbStyles.gridTotalCell}>
                      <Text style={lbStyles.gridTotalScore}>
                        {s.holesPlayed > 0 ? s.totalStrokes : '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Stableford row */}
                  <View style={lbStyles.gridRow}>
                    <View style={lbStyles.gridLabelCell}>
                      <Text style={[lbStyles.gridRowLabel, { color: Colors.stableford }]}>Stb</Text>
                    </View>
                    {front9.map((h) => (
                      <View key={h.hole} style={lbStyles.gridHoleCell}>
                        <Text style={[lbStyles.gridScore, { color: Colors.stableford }]}>
                          {h.stablefordPoints !== null ? h.stablefordPoints : '·'}
                        </Text>
                      </View>
                    ))}
                    {has18 && (
                      <View style={lbStyles.gridTotalCell}>
                        <Text style={[lbStyles.gridTotalScore, { color: Colors.stableford }]}>
                          {front9Played ? front9Stableford : '—'}
                        </Text>
                      </View>
                    )}
                    {back9.map((h) => (
                      <View key={h.hole} style={lbStyles.gridHoleCell}>
                        <Text style={[lbStyles.gridScore, { color: Colors.stableford }]}>
                          {h.stablefordPoints !== null ? h.stablefordPoints : '·'}
                        </Text>
                      </View>
                    ))}
                    {has18 && (
                      <View style={lbStyles.gridTotalCell}>
                        <Text style={[lbStyles.gridTotalScore, { color: Colors.stableford }]}>
                          {back9Played ? back9Stableford : '—'}
                        </Text>
                      </View>
                    )}
                    <View style={lbStyles.gridTotalCell}>
                      <Text style={[lbStyles.gridTotalScore, { color: Colors.stableford }]}>
                        {s.holesPlayed > 0 ? s.totalStableford : '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Wolf row */}
                  {wolfEnabled && (
                    <View style={lbStyles.gridRow}>
                      <View style={lbStyles.gridLabelCell}>
                        <Text style={[lbStyles.gridRowLabel, { color: Colors.wolf }]}>Wlf</Text>
                      </View>
                      {front9.map((h) => (
                        <View key={h.hole} style={lbStyles.gridHoleCell}>
                          <Text style={[lbStyles.gridScore, { color: Colors.wolf }]}>
                            {h.wolfPoints !== null ? h.wolfPoints : '·'}
                          </Text>
                        </View>
                      ))}
                      {has18 && (
                        <View style={lbStyles.gridTotalCell}>
                          <Text style={[lbStyles.gridTotalScore, { color: Colors.wolf }]}>
                            {front9Wolf > 0 ? front9Wolf : '—'}
                          </Text>
                        </View>
                      )}
                      {back9.map((h) => (
                        <View key={h.hole} style={lbStyles.gridHoleCell}>
                          <Text style={[lbStyles.gridScore, { color: Colors.wolf }]}>
                            {h.wolfPoints !== null ? h.wolfPoints : '·'}
                          </Text>
                        </View>
                      ))}
                      {has18 && (
                        <View style={lbStyles.gridTotalCell}>
                          <Text style={[lbStyles.gridTotalScore, { color: Colors.wolf }]}>
                            {back9Wolf > 0 ? back9Wolf : '—'}
                          </Text>
                        </View>
                      )}
                      <View style={lbStyles.gridTotalCell}>
                        <Text style={[lbStyles.gridTotalScore, { color: Colors.wolf }]}>
                          {s.totalWolfPoints > 0 ? s.totalWolfPoints : '—'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const lbStyles = StyleSheet.create({
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
  gridNameRow: {
    paddingTop: Spacing.sm,
    paddingBottom: 2,
    backgroundColor: Colors.offWhite,
  },
  gridPlayerName: { 
    fontSize: FontSize.sm, 
    fontWeight: '800', 
    color: Colors.textPrimary
  },
  playerGroup: {
    borderTopWidth: 2,
    borderTopColor: Colors.borderDark,
  },
  gridLabelCell: {
    width: 38,
    paddingHorizontal: 4,
    paddingVertical: 5,
    backgroundColor: Colors.offWhite,
    justifyContent: 'center',
  },
  gridRowLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  gridHoleCell: {
    width: 36,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTotalCell: {
    width: 42,
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.offWhite,
  },
  gridLeftHeaderCell: {
    justifyContent: 'flex-end',
    width: 38,
    paddingHorizontal: 4,
    marginBottom: Spacing.xs
  },
  gridHeader: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  gridParText: { fontSize: 9, color: Colors.textMuted },
  gridSiText: { fontSize: 9, color: Colors.textMuted },
  gridScore: { fontSize: FontSize.sm, fontWeight: '600' },
  gridTotalScore: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  gridHeaderParText: { fontSize: 9, color: Colors.textMuted },
  gridHeaderHoleText: { fontSize: 9, fontWeight: '800', color: Colors.textSecondary },
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
  wolfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  wolfLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  wolfStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  wolfStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    backgroundColor: Colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wolfStepText: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },
  wolfInput: {
    width: 52,
    height: 36,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: BorderRadius.md,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    backgroundColor: Colors.offWhite,
  },
});

const editStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cancelBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  cancelText: { fontSize: FontSize.base, color: Colors.textSecondary },
  saveBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  saveText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.green },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.info,
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  scroll: {
    padding: Spacing.base,
    paddingBottom: 48,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.greenMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  playerNumText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.green },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.offWhite,
  },
  handicapCol: { width: 68 },
  handicapInput: { textAlign: 'center' },
});