/**
 * Vesper.
 *
 * Two providers and a switch. Everything interesting is a layer down: the
 * state engine in `src/hooks/useVesper`, the arithmetic in `src/lib`, and
 * the responsive contract in `src/components/AppShell`.
 */

import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

import { AppShell } from "./src/components/AppShell";
import { AddAssetSheet, SendSheet } from "./src/components/sheets";
import { NavigationProvider, useNavigation } from "./src/hooks/useNavigation";
import { VesperProvider } from "./src/hooks/useVesper";
import { AnalyticsScreen } from "./src/screens/AnalyticsScreen";
import { AssetDetailScreen } from "./src/screens/AssetDetailScreen";
import { CryptoScreen } from "./src/screens/CryptoScreen";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
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
    case "settings":
      return <SettingsScreen />;
    case "home":
    default:
      return <OverviewScreen />;
  }
}

export default function App() {
  return (
    <VesperProvider>
      <NavigationProvider>
        <View style={styles.root}>
          <StatusBar style="light" />
          <AppShell>
            <Router />
          </AppShell>
          <AddAssetSheet />
          <SendSheet />
        </View>
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
