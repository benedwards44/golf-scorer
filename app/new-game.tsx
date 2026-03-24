import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';
import { generateId, defaultHoles } from '../utils/calculations';
import { saveGame } from '../utils/storage';
import { Game, Player, CourseConfig } from '../utils/types';

type Step = 'course' | 'players';

export default function NewGameScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('course');

  // Course state
  const [courseName, setCourseName] = useState('');
  const [courseRating, setCourseRating] = useState('72.0');
  const [courseSlope, setCourseSlope] = useState('113');
  const [coursePar, setCoursePar] = useState('72');

  // Players state
  const [players, setPlayers] = useState<{ name: string; handicap: string }[]>([
    { name: '', handicap: '0' },
    { name: '', handicap: '0' },
  ]);

  // Game options
  const [wolfEnabled, setWolfEnabled] = useState(true);

  function addPlayer() {
    if (players.length >= 12) {
      Alert.alert('Maximum Players', 'This app supports up to 12 players.');
      return;
    }
    setPlayers([...players, { name: '', handicap: '0' }]);
  }

  function removePlayer(idx: number) {
    if (players.length <= 1) return;
    setPlayers(players.filter((_, i) => i !== idx));
  }

  function updatePlayer(idx: number, field: 'name' | 'handicap', value: string) {
    const updated = [...players];
    updated[idx] = { ...updated[idx], [field]: value };
    setPlayers(updated);
  }

  function validateCourse(): boolean {
    if (!courseName.trim()) {
      Alert.alert('Missing Field', 'Please enter a course name.');
      return false;
    }
    const rating = parseFloat(courseRating);
    if (isNaN(rating) || rating < 50 || rating > 80) {
      Alert.alert('Invalid Rating', 'Course rating should be between 50 and 80.');
      return false;
    }
    const slope = parseInt(courseSlope);
    if (isNaN(slope) || slope < 55 || slope > 155) {
      Alert.alert('Invalid Slope', 'Slope rating should be between 55 and 155.');
      return false;
    }
    const par = parseInt(coursePar);
    if (isNaN(par) || par < 54 || par > 78) {
      Alert.alert('Invalid Par', 'Course par should be between 54 and 78.');
      return false;
    }
    return true;
  }

  function validatePlayers(): boolean {
    const validPlayers = players.filter((p) => p.name.trim());
    if (validPlayers.length < 1) {
      Alert.alert('No Players', 'Please add at least 1 player.');
      return false;
    }
    for (const p of validPlayers) {
      const hcp = parseFloat(p.handicap);
      if (isNaN(hcp) || hcp < -10 || hcp > 54) {
        Alert.alert('Invalid Handicap', `Handicap for "${p.name}" should be between -10 and 54.`);
        return false;
      }
    }
    return true;
  }

  async function startGame() {
    if (!validatePlayers()) return;

    const validPlayers: Player[] = players
      .filter((p) => p.name.trim())
      .map((p) => ({
        id: generateId(),
        name: p.name.trim(),
        handicap: parseFloat(p.handicap) || 0,
      }));

    const course: CourseConfig = {
      name: courseName.trim(),
      rating: parseFloat(courseRating),
      slope: parseInt(courseSlope),
      par: parseInt(coursePar),
      holes: defaultHoles(),
    };

    const game: Game = {
      id: generateId(),
      date: new Date().toISOString(),
      course,
      players: validPlayers,
      rounds: validPlayers.map((p) => ({
        playerId: p.id,
        scores: Array.from({ length: 18 }, () => ({ strokes: null, wolfPoints: null })),
      })),
      completed: false,
      wolfEnabled,
    };

    await saveGame(game);
    router.replace({ pathname: '/scoring', params: { gameId: game.id } });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New Round' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Step indicator */}
          <View style={styles.steps}>
            <StepDot active={step === 'course'} done={step === 'players'} label="Course" num={1} />
            <View style={[styles.stepLine, step === 'players' && styles.stepLineDone]} />
            <StepDot active={step === 'players'} done={false} label="Players" num={2} />
          </View>

          {step === 'course' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Course Details</Text>

              <Field label="Course Name">
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Titirangi Golf Club"
                  value={courseName}
                  onChangeText={setCourseName}
                  returnKeyType="done"
                />
              </Field>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field label="Course Par">
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={coursePar}
                      onChangeText={setCoursePar}
                      returnKeyType="done"
                    />
                  </Field>
                </View>
                <View style={{ width: Spacing.md }} />
                <View style={{ flex: 1 }}>
                  <Field label="Course Rating">
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={courseRating}
                      onChangeText={setCourseRating}
                      returnKeyType="done"
                    />
                  </Field>
                </View>
                <View style={{ width: Spacing.md }} />
                <View style={{ flex: 1 }}>
                  <Field label="Slope Rating">
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={courseSlope}
                      onChangeText={setCourseSlope}
                      returnKeyType="done"
                    />
                  </Field>
                </View>
              </View>

              <View style={styles.hint}>
                <Text style={styles.hintText}>
                  Course rating and slope are printed on the scorecard. Standard slope is 113.
                </Text>
              </View>

              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  if (validateCourse()) setStep('players');
                }}
              >
                <Text style={styles.primaryBtnText}>Next: Add Players →</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Players</Text>
              {players.map((p, idx) => (
                <View key={idx} style={styles.playerRow}>
                  <View style={[styles.playerNum, { marginTop: 14 }]}>
                    <Text style={styles.playerNumText}>{idx + 1}</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1, marginTop: 14 }]}
                    placeholder={`Player ${idx + 1} name`}
                    value={p.name}
                    onChangeText={(v) => updatePlayer(idx, 'name', v)}
                    returnKeyType="next"
                  />
                  <View style={{ width: Spacing.sm }} />
                  <View style={styles.handicapWrapper}>
                    <Text style={styles.handicapLabel}>HCP</Text>
                    <TextInput
                      style={[styles.input, styles.handicapInput]}
                      keyboardType="numbers-and-punctuation"
                      value={p.handicap}
                      onChangeText={(v) => updatePlayer(idx, 'handicap', v)}
                      returnKeyType="done"
                      selectTextOnFocus
                    />
                  </View>
                  {players.length > 1 && (
                    <Pressable
                      onPress={() => removePlayer(idx)}
                      style={styles.removeBtn}
                      hitSlop={8}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}

              {players.length < 12 && (
                <Pressable style={styles.addPlayerBtn} onPress={addPlayer}>
                  <Text style={styles.addPlayerText}>+ Add Player</Text>
                </Pressable>
              )}

              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>🐺 Wolf Scoring</Text>
                  <Text style={styles.toggleSub}>Track wolf points per hole</Text>
                </View>
                <Switch
                  value={wolfEnabled}
                  onValueChange={setWolfEnabled}
                  trackColor={{ false: Colors.border, true: Colors.wolf }}
                  thumbColor={Colors.white}
                />
              </View>

              <View style={styles.actionRow}>
                <Pressable style={styles.secondaryBtn} onPress={() => setStep('course')}>
                  <Text style={styles.secondaryBtnText}>← Back</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={startGame}>
                  <Text style={styles.primaryBtnText}>Start Round →</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function StepDot({
  active,
  done,
  label,
  num,
}: {
  active: boolean;
  done: boolean;
  label: string;
  num: number;
}) {
  return (
    <View style={stepStyles.wrapper}>
      <View
        style={[
          stepStyles.dot,
          active && stepStyles.dotActive,
          done && stepStyles.dotDone,
        ]}
      >
        {done ? (
          <Text style={stepStyles.dotTextDone}>✓</Text>
        ) : (
          <Text style={[stepStyles.dotText, active && stepStyles.dotTextActive]}>
            {num}
          </Text>
        )}
      </View>
      <Text style={[stepStyles.label, active && stepStyles.labelActive]}>{label}</Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 4 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { borderColor: Colors.green, backgroundColor: Colors.green },
  dotDone: { borderColor: Colors.green, backgroundColor: Colors.green },
  dotText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  dotTextActive: { color: Colors.white },
  dotTextDone: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  label: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  labelActive: { color: Colors.green, fontWeight: '700' },
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.base, paddingBottom: 48 },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    gap: 0,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    maxWidth: 60,
    marginHorizontal: Spacing.sm,
    marginBottom: 20,
  },
  stepLineDone: { backgroundColor: Colors.green },
  section: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.base,
  },
  label: {
    fontSize: FontSize.sm,
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
  row: { flexDirection: 'row', marginBottom: Spacing.md },
  hint: {
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  hintText: { fontSize: FontSize.sm, color: Colors.info },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  playerNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.greenMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerNumText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.green },
  handicapWrapper: { alignItems: 'center' },
  handicapLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  handicapInput: { width: 56, textAlign: 'center' },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { fontSize: FontSize.sm, color: Colors.danger, fontWeight: '700' },
  addPlayerBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.green,
    borderRadius: BorderRadius.md,
    borderStyle: 'dashed',
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
  },
  addPlayerText: { color: Colors.green, fontWeight: '700', fontSize: FontSize.base },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.base,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: Colors.green,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.white, fontSize: FontSize.base, fontWeight: '700' },
  secondaryBtn: {
    flex: 0,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.green,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: { color: Colors.green, fontSize: FontSize.base, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  toggleLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  toggleSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});