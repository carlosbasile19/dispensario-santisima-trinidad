// Renders a report's branded PDF to a Buffer. Fonts and the mark are files in
// assets/lab-pdf (traced into the server functions by next.config.ts).

import { readFileSync } from "node:fs";
import path from "node:path";

import { Font, renderToBuffer } from "@react-pdf/renderer";

import { LabReportDocument, PDF_FONTS, type PdfAssets, type PdfReport } from "./document";

const ROOT = path.join(process.cwd(), "assets", "lab-pdf");
const font = (file: string) => path.join(ROOT, "fonts", file);

let ready: PdfAssets | null = null;

function setup(): PdfAssets {
  if (ready) return ready;
  Font.register({
    family: PDF_FONTS.sans,
    fonts: [
      { src: font("instrument-sans-latin-400-normal.woff"), fontWeight: 400 },
      { src: font("instrument-sans-latin-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
      { src: font("instrument-sans-latin-500-normal.woff"), fontWeight: 500 },
      { src: font("instrument-sans-latin-600-normal.woff"), fontWeight: 600 },
      { src: font("instrument-sans-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: PDF_FONTS.serif,
    fonts: [
      { src: font("newsreader-latin-400-normal.woff"), fontWeight: 400 },
      { src: font("newsreader-latin-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
      { src: font("newsreader-latin-500-normal.woff"), fontWeight: 500 },
    ],
  });
  Font.register({
    family: PDF_FONTS.mono,
    fonts: [
      { src: font("jetbrains-mono-latin-400-normal.woff"), fontWeight: 400 },
      { src: font("jetbrains-mono-latin-500-normal.woff"), fontWeight: 500 },
    ],
  });
  Font.register({ family: PDF_FONTS.script, src: font("great-vibes-latin-400-normal.woff") });
  // Spanish words must never be split with English hyphenation rules.
  Font.registerHyphenationCallback((word) => [word]);

  ready = {
    markWhite: readFileSync(path.join(ROOT, "brand", "mark-white.png")),
    markNavy: readFileSync(path.join(ROOT, "brand", "mark-navy.png")),
  };
  return ready;
}

export async function renderLabReportPdf(report: PdfReport): Promise<Buffer> {
  const assets = setup();
  return renderToBuffer(<LabReportDocument report={report} assets={assets} />);
}
