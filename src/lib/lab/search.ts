// Finding tests and panels in the catalog, and the panels a visit's
// services point at ("Hematología completa" booked → that panel suggested).

import { CATEGORY, PANELS, TEST_LIST, panelTests } from "./catalog";
import type { CategoryKey, PanelDef, TestDef } from "./types";

export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const matches = (haystack: string, query: string) => {
  const words = normalize(query).split(" ").filter(Boolean);
  const text = normalize(haystack);
  return words.every((word) => text.includes(word));
};

const panelText = (panel: PanelDef) => `${panel.title} ${panel.description ?? ""} ${panel.keywords ?? ""} ${CATEGORY[panel.category].title}`;
const testText = (test: TestDef) => `${test.label} ${test.keywords ?? ""} ${test.unit ?? ""} ${CATEGORY[test.category].title}`;

export function searchCatalog(query: string, category: CategoryKey | "all") {
  const inCategory = <T extends { category: CategoryKey }>(item: T) => category === "all" || item.category === category;
  const q = query.trim();
  const panels = PANELS.filter((panel) => inCategory(panel) && (!q || matches(panelText(panel), q)));
  const tests = TEST_LIST.filter((test) => inCategory(test) && (!q || matches(testText(test), q)));
  return { panels, tests };
}

/** Panels whose name a visit's services mention, best match first. */
export function suggestPanels(serviceNames: string[]) {
  const found = new Set<string>();
  for (const name of serviceNames.map(normalize)) {
    if (!name) continue;
    const exact = PANELS.find((panel) => normalize(panel.title) === name);
    if (exact) {
      found.add(exact.key);
      continue;
    }
    for (const panel of PANELS) {
      const words = [panel.title, ...(panel.keywords ?? "").split(" ")].map(normalize).filter((w) => w.length > 4);
      if (words.some((word) => name.includes(word) || word.includes(name))) {
        found.add(panel.key);
        break;
      }
    }
  }
  return [...found].slice(0, 6);
}

export const panelSize = (panel: PanelDef) => panelTests(panel).length;
