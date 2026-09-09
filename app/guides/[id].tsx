import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/ScreenContainer";
import { GuideViewer } from "@/components/guides/GuideViewer";
import { EmptyState } from "@/components/EmptyState";
import { revolutGuide } from "@/features/guides/revolutGuide";
import { apiSetupGuide } from "@/features/guides/apiSetupGuide";
import type { Guide } from "@/features/guides/types";

const GUIDES: Record<string, Guide> = {
  revolut: revolutGuide,
  apiSetup: apiSetupGuide,
};

export default function GuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const guide = id ? GUIDES[id] : undefined;

  if (!guide) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerShown: true, title: "Stappenplan" }} />
        <EmptyState icon="help-circle-outline" title="Stappenplan niet gevonden" description="Dit stappenplan bestaat niet (meer)." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: guide.title }} />
      <GuideViewer guide={guide} onDone={() => router.back()} />
    </ScreenContainer>
  );
}
