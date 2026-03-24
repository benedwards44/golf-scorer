# ⛳ Golf Scorer X

A React Native / Expo mobile app for scoring golf games with up to **12 players**, supporting both **Strokes** and **Stableford** scoring systems.

---

## Features

- ✅ Up to **12 players** per round (most apps cap at 4)
- ✅ **Stableford points** calculated automatically using World Handicap System (WHS)
- ✅ **Stroke play** totals tracked as running totals
- ✅ **Course Handicap** calculated from Handicap Index, Slope, Rating, and Par
- ✅ Extra strokes per hole allocated by stroke index
- ✅ Quick-tap score entry + stepper controls
- ✅ Hole-by-hole scorecard grid
- ✅ Live leaderboard (Stableford and Stroke views)
- ✅ Per-hole par & stroke index configuration
- ✅ Rounds saved locally on device (AsyncStorage)
- ✅ Clean, minimal UI designed for use on the course

---

## Project Structure

```
golf-scorer/
├── app/
│   ├── _layout.tsx        # Root navigation layout
│   ├── index.tsx          # Home screen (game list)
│   ├── new-game.tsx       # New round setup (course + players)
│   ├── scoring.tsx        # Main scoring screen + leaderboard
│   └── hole-setup.tsx     # Per-hole par & stroke index editor
├── utils/
│   ├── types.ts           # TypeScript interfaces
│   ├── calculations.ts    # Handicap, Stableford, scoring logic
│   ├── storage.ts         # AsyncStorage persistence
│   └── theme.ts           # Design tokens (colours, spacing, fonts)
├── app.config.ts
├── babel.config.js
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Expo Go](https://expo.dev/go) app on your phone (for testing)

### Installation

```bash
# 1. Navigate to the project folder
cd golf-scorer

# 2. Install dependencies
npm install

# 3. Start the development server
npx expo start
```

Then scan the QR code with **Expo Go** on your phone, or press:
- `i` to open in iOS Simulator
- `a` to open in Android Emulator

---

## How Scoring Works

### Course Handicap (WHS Formula)

```
Course Handicap = Handicap Index × (Slope / 113) + (Course Rating − Course Par)
```

This is calculated automatically when you enter the player's handicap index plus the course details.

### Extra Strokes Per Hole

Extra strokes are allocated by **stroke index** (hole difficulty ranking):

- A player with Course Handicap 18 gets **1 extra stroke** on every hole
- A player with Course Handicap 5 gets **1 extra stroke** on holes with S/I 1–5
- A player with Course Handicap 22 gets **1 extra stroke** everywhere, plus **2** on holes S/I 1–4

### Stableford Points

```
Points = Par + Extra Strokes − Strokes + 2
```

| Score       | Points |
|-------------|--------|
| Eagle (−2)  | 4 pts  |
| Birdie (−1) | 3 pts  |
| Par (0)     | 2 pts  |
| Bogey (+1)  | 1 pt   |
| Double (+2) | 0 pts  |
| Worse       | 0 pts  |

---

## Entering Scores

On the **Scoring Screen**:

1. Tap a hole number at the top to jump to that hole
2. For each player, use **+ / −** to adjust strokes, or tap one of the **quick-pick buttons** (centred around par)
3. The score circle shows the strokes; below it is the Stableford points for that hole
4. Running totals (Strokes & Stableford) update in real time
5. **Long-press** the score circle to clear a score
6. Use **Prev / Next** buttons at the bottom to move between holes
7. Tap the **Scores** button to see the leaderboard and full scorecard

---

## Editing Hole Details

Hole par and stroke index defaults are pre-loaded with a standard distribution. To customise for your course:

From the **Scoring screen**, tap the settings icon in the header (if enabled) or navigate to **Hole Setup** via the game options. You can also extend the app to add a navigation link.

The hole setup screen (`/hole-setup?gameId=...`) lets you edit:
- **Par** per hole (3, 4, or 5)
- **Stroke Index** (1–18, must be unique across all holes)

---

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

---

## Tech Stack

| Library | Purpose |
|---------|---------|
| Expo SDK 52 | Build toolchain |
| Expo Router 4 | File-based navigation |
| React Native 0.76 | UI framework |
| AsyncStorage | Local data persistence |
| @expo/vector-icons | Ionicons icon set |

---

## Extending the App

Some ideas for future enhancements:

- **Course library** — save and reuse course configurations
- **History** — stats across multiple rounds
- **Export** — share scorecards as PDF or image
- **Match play** — head-to-head scoring mode
- **Team events** — Ambrose / best ball format
- **iCloud / Google sync** — share rounds across devices
