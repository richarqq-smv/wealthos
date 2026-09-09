import type { Guide } from "./types";

/**
 * Revolut download/import guide. Every step's title comes verbatim from the
 * filename the user supplied for that screenshot (e.g. "6 Ga het rijtje af
 * en volg de stappen voor alle opties, voor het voorbeeld selecteren we de
 * bovenste.png") — per explicit instruction, the filename IS the intended
 * instruction, not just a label. This is a generic walkthrough demonstrated
 * once on the top report (Rekeningoverzicht) and repeated for the two real
 * export formats Revolut actually offers (PDF, step 10; Excel, steps 11-12
 * — never CSV, confirmed by these exact screenshots), matching
 * `features/brokerImport/revolut/adapter.ts`'s support for CSV OR XLSX
 * plus both PDF reports.
 */
export const revolutGuide: Guide = {
  id: "revolut",
  title: "Revolut koppelen",
  description:
    "Voor een volledige historische import hebben we meerdere Revolut-rapporten nodig: het Rekeningoverzicht (CSV of Excel) en de Winst- & verliesrekening (PDF). Doorloop dit stappenplan voor beide.",
  requiredFiles: ["Rekeningoverzicht (CSV of Excel)", "Rekeningoverzicht (PDF)", "Winst- & verliesrekening (PDF)"],
  steps: [
    {
      stepNumber: 1,
      title: "Home pagina Revolut Invest",
      image: require("../../assets/guides/revolut/revolut-01.png"),
    },
    {
      stepNumber: 2,
      title: "Klik op je profiel",
      image: require("../../assets/guides/revolut/revolut-02.png"),
    },
    {
      stepNumber: 3,
      title: "Selecteer Documenten",
      image: require("../../assets/guides/revolut/revolut-03.png"),
    },
    {
      stepNumber: 4,
      title: "Klik op de gewenste vorm om te importeren",
      description: "Voor het voorbeeld selecteren we de bovenste (Effectenrekening).",
      image: require("../../assets/guides/revolut/revolut-04.png"),
    },
    {
      stepNumber: 5,
      title: "Open de gewenste optie",
      image: require("../../assets/guides/revolut/revolut-05.png"),
    },
    {
      stepNumber: 6,
      title: "Ga het rijtje af en volg de stappen voor alle opties",
      description: "Voor het voorbeeld selecteren we de bovenste (Rekeningoverzicht). Herhaal dit later ook voor de Winst- & verliesrekening.",
      image: require("../../assets/guides/revolut/revolut-06.png"),
    },
    {
      stepNumber: 7,
      title: "Open de gewenste optie",
      image: require("../../assets/guides/revolut/revolut-07.png"),
    },
    {
      stepNumber: 8,
      title: "Selecteer de gewenste periode",
      description: "Voor een duidelijk overzicht kies Altijd.",
      image: require("../../assets/guides/revolut/revolut-08.png"),
    },
    {
      stepNumber: 9,
      title: "Selecteer de optie Altijd",
      image: require("../../assets/guides/revolut/revolut-09.png"),
    },
    {
      stepNumber: 10,
      title: "Klik op Afschrift Downloaden en klik linksonder op Downloaden",
      description: "Dit scherm doorloop je twee keer: één keer voor het Rekeningoverzicht en één keer voor de Winst- & verliesrekening (zie stap 6).",
      note: "LET OP! Bij PDF moet je vaak ook in je eigen browser het PDF-bestand downloaden.",
      requiredFile: ["Rekeningoverzicht (PDF)", "Winst- & verliesrekening (PDF)"],
      image: require("../../assets/guides/revolut/revolut-10.png"),
    },
    {
      stepNumber: 11,
      title: "Selecteer bovenin Excel",
      image: require("../../assets/guides/revolut/revolut-11.png"),
    },
    {
      stepNumber: 12,
      title: "Klik op Afschrift Downloaden en klik linksonder op downloaden",
      requiredFile: "Rekeningoverzicht (CSV of Excel)",
      image: require("../../assets/guides/revolut/revolut-12.png"),
    },
  ],
};
