import type { Guide } from "./types";

/**
 * Twelve Data + Alpha Vantage API-key setup guide. Titles come verbatim
 * from the user-supplied screenshot filenames (same convention as
 * revolutGuide.ts). Matches the real flow: WealthOS is bring-your-own-key —
 * it never signs the user up or handles credentials itself (see
 * app/settings/marketData.tsx) — this guide is purely instructional.
 */
export const apiSetupGuide: Guide = {
  id: "apiSetup",
  title: "API-keys instellen",
  description: "Koppel je eigen gratis Twelve Data- en Alpha Vantage-account aan WealthOS voor live marktdata. Je maakt de accounts zelf aan — WealthOS logt nooit voor je in en ziet je wachtwoord nooit.",
  steps: [
    { stepNumber: 1, title: "Ga naar de website van TwelveData", image: require("../../assets/guides/apiSetup/apisetup-01.png") },
    { stepNumber: 2, title: "Klik op Sign Up", image: require("../../assets/guides/apiSetup/apisetup-02.png") },
    { stepNumber: 3, title: "Maak een account", image: require("../../assets/guides/apiSetup/apisetup-03.png") },
    { stepNumber: 4, title: "Klik rechts op REVEAL bij de API key", image: require("../../assets/guides/apiSetup/apisetup-04.png") },
    {
      stepNumber: 5,
      title: "Klik op het zwarte knopje en kopieer de key",
      note: "Bewaar deze key nog niet in WealthOS zelf — dat doe je pas bij stap 12. Deel hem met niemand anders.",
      image: require("../../assets/guides/apiSetup/apisetup-05.png"),
    },
    { stepNumber: 6, title: "Selecteer je gewenste account", description: "Terug in WealthOS.", image: require("../../assets/guides/apiSetup/apisetup-06.png") },
    { stepNumber: 7, title: "Login met je pincode", image: require("../../assets/guides/apiSetup/apisetup-07.png") },
    { stepNumber: 8, title: "Navigeer in de linker balk", image: require("../../assets/guides/apiSetup/apisetup-08.png") },
    { stepNumber: 9, title: "Selecteer Meer", image: require("../../assets/guides/apiSetup/apisetup-09.png") },
    {
      stepNumber: 10,
      title: "Selecteer Live Marktdata",
      description: "Deze staat als het goed is nog uit.",
      image: require("../../assets/guides/apiSetup/apisetup-10.png"),
    },
    { stepNumber: 11, title: "Zet het knopje om", image: require("../../assets/guides/apiSetup/apisetup-11.png") },
    {
      stepNumber: 12,
      title: "Plak de API key in de balk voor Twelve Data en klik Opslaan",
      image: require("../../assets/guides/apiSetup/apisetup-12.png"),
    },
    { stepNumber: 13, title: "De API key is nu opgeslagen", image: require("../../assets/guides/apiSetup/apisetup-13.png") },
    {
      stepNumber: 14,
      title: "Ga nu naar de website van Alpha Vantage",
      description: "Optioneel — alleen nodig voor dividend- en bedrijfsinformatie.",
      image: require("../../assets/guides/apiSetup/apisetup-14.png"),
    },
    { stepNumber: 15, title: "Selecteer de optie GET FREE API KEY", image: require("../../assets/guides/apiSetup/apisetup-15.png") },
    { stepNumber: 16, title: "Selecteer Investor en vul je gegevens in", image: require("../../assets/guides/apiSetup/apisetup-16.png") },
    { stepNumber: 17, title: "Klik nu op de knop GET FREE API KEY", image: require("../../assets/guides/apiSetup/apisetup-17.png") },
    {
      stepNumber: 18,
      title: "Kopieer nu je API key handmatig",
      note: "Deel deze key met niemand anders.",
      image: require("../../assets/guides/apiSetup/apisetup-18.png"),
    },
    {
      stepNumber: 19,
      title: "Plak de API key in de balk van Alpha Vantage en klik op opslaan",
      image: require("../../assets/guides/apiSetup/apisetup-19.png"),
    },
    {
      stepNumber: 20,
      title: "Klik nu bij beiden op Verbinding Testen en geniet van je live data",
      image: require("../../assets/guides/apiSetup/apisetup-20.png"),
    },
  ],
};
