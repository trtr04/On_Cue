import { createElement } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import nativeHtml from "../nativeHtml";

export default function App() {
  if (Platform.OS === "web") {
    return createElement("iframe", {
      src: "/simulator/index.html",
      title: "错不起我对了",
      style: {
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
        background: "#eee8ec",
      },
    });
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="dark" />
      <WebView
        originWhitelist={["*"]}
        source={{ html: nativeHtml }}
        style={styles.fill}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: "#eee8ec",
  },
});
