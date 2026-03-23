import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../utils/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.green },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          headerBackTitle: 'Back',
          contentStyle: { backgroundColor: Colors.offWhite },
        }}
      />
    </>
  );
}
