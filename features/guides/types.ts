import type { ImageSourcePropType } from "react-native";

/** One step in a broker/setup guide. Generic and reusable — the same shape backs the Revolut download guide, the API-key setup guide, and any future broker's guide, so a new broker only ever needs new data, never a new UI. */
export interface GuideStep {
  stepNumber: number;
  title: string;
  description?: string;
  image: ImageSourcePropType;
  note?: string;
  /** Which file(s) this step results in downloading, when relevant — shown as a running checklist in the UI (see GuideViewer). A step whose screenshot is reused for more than one report (e.g. "download" demonstrated once, repeated by the user for each report type) can list every file it plausibly represents; each must exactly match an entry in the parent Guide's `requiredFiles`, or it will never be checked off. */
  requiredFile?: string | string[];
}

export interface Guide {
  id: string;
  title: string;
  description: string;
  steps: GuideStep[];
  /** Files the user needs at the end, shown as a checklist alongside the steps — matches the Revolut adapter's actual file requirements (see features/brokerImport/revolut/adapter.ts). */
  requiredFiles?: string[];
}
