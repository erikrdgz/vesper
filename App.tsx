/**
 * Vesper.
 *
 * Two providers and a switch. Everything interesting is a layer down: the
 * state engine in `src/hooks/useVesper`, the arithmetic in `src/lib`, and
 * the responsive contract in `src/components/AppShell`.
 */

import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

import { AppShell } from "./src/components/AppShell";
import {
  ActionsSheet,
  AddAssetSheet,
  AlertSheet,
  SendSheet,
  SwapSheet,
} from "./src/components/sheets";
import { NavigationProvider, useNavigation } from "./src/hooks/useNavigation";
import { VesperProvider } from "./src/hooks/useVesper";
import { AnalyticsScreen } from "./src/screens/AnalyticsScreen";
import { IntroScreen } from "./src/screens/IntroScreen";
import { AssetDetailScreen } from "./src/screens/AssetDetailScreen";
import { CryptoScreen } from "./src/screens/CryptoScreen";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { WatchScreen } from "./src/screens/WatchScreen";
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
    case "settings":
      return <SettingsScreen />;
    case "home":
    default:
      return <OverviewScreen />;
  }
}

/**
 * The intro sits inside the providers, not outside them.
 *
 * It needs the reduced-motion preference, and the app behind it gets to
 * hydrate and fetch its first prices while the animation plays — so by
 * the time someone clicks through, the dashboard is already warm instead
 * of starting from nothing.
 */
function Gate() {
  const [entered, setEntered] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {entered ? (
        <>
          <AppShell>
            <Router />
          </AppShell>
          <ActionsSheet />
          <AddAssetSheet />
          <SwapSheet />
          <AlertSheet />
          <SendSheet />
        </>
      ) : (
        <IntroScreen onEnter={() => setEntered(true)} />
      )}
    </View>
  );
}

export default function App() {
  return (
    <VesperProvider>
      <NavigationProvider>
        <Gate />
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
