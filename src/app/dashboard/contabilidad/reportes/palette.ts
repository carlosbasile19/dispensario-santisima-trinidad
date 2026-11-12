// Chart colours of Reportes. The three series hues are the brand's teal, a
// warm orange and an indigo, stepped so that, on the white cards, they pass
// the colour-blind and contrast checks as a set (dataviz validator, all
// pairs). Teal is always money in and visits, orange money out; the previous
// period is the recessive warm grey. Text never takes these colours.

export const CHART = {
  current: "#00909a",
  income: "#00909a",
  expense: "#e8663a",
  third: "#4a5fd0",
  previous: "#c4beb1",
  /** Fills that mean "not recorded" or "lost" (no sex on file, cancelled). */
  muted: "#d9d3c6",
  grid: "#efebe3",
  axis: "#d9d3c6",
  tick: "#8a8475",
  hover: "#f6f3ec",
} as const;

/** Medicina, odontología, bioanálisis: in this fixed order, never by rank. */
export const AREA_COLOR = { medicina: CHART.current, odontologia: CHART.third, bioanalisis: CHART.expense } as const;
