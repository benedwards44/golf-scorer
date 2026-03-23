import AsyncStorage from '@react-native-async-storage/async-storage';
import { Game } from './types';

const GAMES_KEY = 'golf_scorer_games';

export async function saveGame(game: Game): Promise<void> {
  const existing = await loadAllGames();
  const idx = existing.findIndex((g) => g.id === game.id);
  if (idx >= 0) {
    existing[idx] = game;
  } else {
    existing.unshift(game);
  }
  await AsyncStorage.setItem(GAMES_KEY, JSON.stringify(existing));
}

export async function loadAllGames(): Promise<Game[]> {
  const raw = await AsyncStorage.getItem(GAMES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Game[];
  } catch {
    return [];
  }
}

export async function loadGame(id: string): Promise<Game | null> {
  const games = await loadAllGames();
  return games.find((g) => g.id === id) ?? null;
}

export async function deleteGame(id: string): Promise<void> {
  const existing = await loadAllGames();
  const filtered = existing.filter((g) => g.id !== id);
  await AsyncStorage.setItem(GAMES_KEY, JSON.stringify(filtered));
}
