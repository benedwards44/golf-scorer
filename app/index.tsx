import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Game } from '../utils/types';
import { deleteGame, loadAllGames } from '../utils/storage';
import { Colors, Spacing, FontSize, BorderRadius } from '../utils/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadAllGames().then(setGames);
    }, [])
  );

  function handleDelete(game: Game) {
    Alert.alert(
      'Delete Game',
      `Delete the round at ${game.course.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteGame(game.id);
            setGames((prev) => prev.filter((g) => g.id !== game.id));
          },
        },
      ]
    );
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-NZ', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '⛳ Golf Scorer X',
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/new-game')}
              style={styles.headerBtn}
            >
              <Ionicons name="add" size={28} color={Colors.white} />
            </Pressable>
          ),
        }}
      />
      <View style={styles.container}>
        {games.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="golf" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No rounds yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to start a new game
            </Text>
            <Pressable
              style={styles.newBtn}
              onPress={() => router.push('/new-game')}
            >
              <Text style={styles.newBtnText}>New Round</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={games}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() =>
                  router.push({ pathname: '/scoring', params: { gameId: item.id } })
                }
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.courseName}>{item.course.name}</Text>
                    <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    {item.completed && (
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedText}>Complete</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => handleDelete(item)}
                      hitSlop={12}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.cardStats}>
                  <View style={styles.stat}>
                    <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.statText}>{item.players.length} players</Text>
                  </View>
                  <View style={styles.stat}>
                    <Ionicons name="golf-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.statText}>Par {item.course.par}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Ionicons name="star-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.statText}>Rating {item.course.rating}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Ionicons name="trending-up-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.statText}>Slope {item.course.slope}</Text>
                  </View>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: { paddingHorizontal: 4 },
  list: { padding: Spacing.base, gap: Spacing.md },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  newBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.green,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  newBtnText: {
    color: Colors.white,
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.85 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  cardInfo: { flex: 1 },
  courseName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cardDate: { fontSize: FontSize.sm, color: Colors.textSecondary },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  completedBadge: {
    backgroundColor: Colors.greenMuted,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  completedText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.green,
  },
  deleteBtn: { padding: 4 },
  cardStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
