/**
 * Minimal text PDF generator (browser-safe, no external deps).
 * Produces a valid PDF 1.4 document with Helvetica body text.
 */
function byteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

export function buildTextPdf(title: string, lines: string[]): Blob {
  const contentLines = [title, "", ...lines];
  const escaped = contentLines.map((line) =>
    line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"),
  );

  const fontSize = 11;
  const leading = 16;
  const marginLeft = 50;
  let y = 780;
  const streamParts: string[] = [
    "BT",
    `/F1 ${fontSize} Tf`,
    `${marginLeft} ${y} Td`,
  ];

  for (let i = 0; i < escaped.length; i++) {
    const line = escaped[i];
    if (i === 0) {
      streamParts.push(`/F1 16 Tf`, `(${line}) Tj`, `/F1 ${fontSize} Tf`);
    } else {
      streamParts.push(`0 -${leading} Td`, `(${line}) Tj`);
    }
    y -= leading;
    if (y < 50) {
      streamParts.push(`0 -${leading} Td`, `(…) Tj`);
      break;
    }
  }
  streamParts.push("ET");
  const stream = streamParts.join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
  );
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );
  objects.push(
    `4 0 obj\n<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(byteLength(pdf));
    pdf += obj;
  }

  const xrefStart = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}
