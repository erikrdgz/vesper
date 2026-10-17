/**
 * Vesper.
 *
 * Providers and three doors. Everything interesting is a layer down: the
 * state engine in `src/hooks/useVesper`, the arithmetic in `src/lib`, and
 * the responsive contract in `src/components/AppShell`.
 */

import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

import { AppShell } from "./src/components/AppShell";
import { ScreenTransition } from "./src/components/ScreenTransition";
import { ToastProvider } from "./src/components/Toast";
import {
  ActionsSheet,
  AddAssetSheet,
  AlertSheet,
  PositionSheet,
  SendSheet,
  ShortcutsSheet,
  SwapSheet,
} from "./src/components/sheets";
import { NavigationProvider, useNavigation } from "./src/hooks/useNavigation";
import { useShortcuts } from "./src/hooks/useShortcuts";
import { VesperProvider, useVesper } from "./src/hooks/useVesper";
import { AnalyticsScreen } from "./src/screens/AnalyticsScreen";
import { AssetDetailScreen } from "./src/screens/AssetDetailScreen";
import { CryptoScreen } from "./src/screens/CryptoScreen";
import { ExchangeScreen } from "./src/screens/ExchangeScreen";
import { IntroScreen } from "./src/screens/IntroScreen";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { WalletScreen } from "./src/screens/WalletScreen";
import { WatchScreen } from "./src/screens/WatchScreen";
import { WelcomeScreen } from "./src/screens/WelcomeScreen";
import { color } from "./src/theme";

function Router() {
  const { tab, detailId } = useNavigation();

  // The detail view belongs to the Crypto tab but takes the whole frame,
  // which is why it is resolved before the tab rather than inside it.
  if (detailId) return <AssetDetailScreen assetId={detailId} />;

  switch (tab) {
    case "analytics":
      return <AnalyticsScreen />;
    case "crypto":
      return <CryptoScreen />;
    case "watch":
      return <WatchScreen />;
    case "exchange":
      return <ExchangeScreen />;
    case "wallet":
      return <WalletScreen />;
    case "home":
    default:
      return <OverviewScreen />;
  }
}

/**
 * Three doors, in order: the mark, the welcome, the app.
 *
 * The welcome appears once and only after hydration. Showing it to a
 * returning visitor for the half second before their save loads would be
 * worse than not having it at all.
 *
 * All of it sits inside the providers, so the dashboard hydrates and
 * fetches its first prices while the intro plays — by the time anyone
 * clicks through, the data is already warm.
 */
function Gate() {
  const [entered, setEntered] = useState(false);
  const { hydrated, onboarded } = useVesper();

  if (!entered) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <IntroScreen onEnter={() => setEntered(true)} />
      </View>
    );
  }

  if (hydrated && !onboarded) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <WelcomeScreen />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppShell>
        <Transitioned />
      </AppShell>
      <ActionsSheet />
      <AddAssetSheet />
      <SwapSheet />
      <AlertSheet />
      <SendSheet />
      <PositionSheet />
      <ShortcutsSheet />
    </View>
  );
}

/** The router, with the tab change given a direction. */
function Transitioned() {
  const { tab, detailId } = useNavigation();
  useShortcuts();
  return (
    <ScreenTransition screenKey={detailId ? `detail:${detailId}` : tab}>
      <Router />
    </ScreenTransition>
  );
}

export default function App() {
  return (
    <VesperProvider>
      <NavigationProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </NavigationProvider>
    </VesperProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.ground,
  },
});
