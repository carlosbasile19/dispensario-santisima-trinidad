// Renders a report's branded PDF to a Buffer. Fonts and the mark are files in
// assets/lab-pdf (traced into the server functions by next.config.ts).

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { Document, Font, Image, Page, renderToBuffer } from "@react-pdf/renderer";

import type { SignatureImage } from "../signature";
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

/**
 * The PDF of a report. With `password`, it asks for that key before it
 * opens (the copy sent by WhatsApp); a random owner key, thrown away, keeps
 * anyone from lifting the protection.
 */
export async function renderLabReportPdf(report: PdfReport, { password }: { password?: string } = {}): Promise<Buffer> {
  const assets = setup();
  const lock = password ? { userPassword: password, ownerPassword: randomBytes(24).toString("base64url") } : undefined;
  try {
    return await renderToBuffer(<LabReportDocument report={report} assets={assets} lock={lock} />);
  } catch (error) {
    // A signature image the renderer chokes on never holds the report back.
    if (!report.signature) throw error;
    console.error("lab PDF failed with the signature image, rendering without it", error);
    return renderToBuffer(<LabReportDocument report={{ ...report, signature: null }} assets={assets} lock={lock} />);
  }
}

/**
 * Whether react-pdf can draw this image (checked when it is uploaded). A
 * corrupt image does not make react-pdf throw: it is left out of the page,
 * so the check is that the rendered page holds an image.
 */
export async function canDrawImage(image: SignatureImage): Promise<boolean> {
  try {
    const pdf = await renderToBuffer(
      <Document>
        <Page size={[200, 80]}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt */}
          <Image src={{ data: image.data, format: image.format }} style={{ width: 150, height: 48, objectFit: "contain" }} />
        </Page>
      </Document>,
    );
    return pdf.includes("/Subtype /Image");
  } catch {
    return false;
  }
}
