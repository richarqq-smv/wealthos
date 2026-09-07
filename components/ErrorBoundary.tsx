import { Component, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SecondaryButton } from "./SecondaryButton";
import { spacing, typography } from "@/constants/theme";
import { themes } from "@/constants/theme";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("WealthOS crashed:", error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      const colors = themes.light;
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: "center" }]}>
            Er is iets misgegaan
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.lg },
            ]}
          >
            WealthOS kon deze pagina niet laden. Probeer het opnieuw.
          </Text>
          <SecondaryButton label="Opnieuw proberen" onPress={this.reset} fullWidth={false} />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
});
