import { readFileSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { reportGeneratedLabel, type SeasonalOrderSheet, type SeasonalProductTotalRow, type SeasonalProductTotalSection, type SeasonalReportView } from "@/lib/seasonal-reports";

const regularFont = readFileSync(join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"));
const boldFont = readFileSync(join(process.cwd(), "assets/fonts/NotoSans-Bold.ttf"));

const palette = {
  ink: "#17211e",
  muted: "#5e6b67",
  primary: "#4a7366",
  border: "#dce3df",
  soft: "#edf0ee",
  paper: "#ffffff",
};

const margin = 40;
const footerSpace = 28;

function printable(value: string) {
  return value.replace(/[\u2011\u2013\u2014]/g, "-");
}

function collectDocument(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function pageBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - margin - footerSpace;
}

function topRule(doc: PDFKit.PDFDocument) {
  const y = doc.y + 10;
  doc.moveTo(margin, y).lineTo(doc.page.width - margin, y).strokeColor(palette.primary).lineWidth(1.5).stroke();
  doc.y = y + 14;
}

function documentHeader(doc: PDFKit.PDFDocument, title: string, generatedAt: string, summary?: string, compact = false) {
  doc.fillColor(palette.ink).font("NotoBold").fontSize(compact ? 11 : 18).text(printable(title), margin, margin, {
    width: doc.page.width - margin * 2,
  });
  if (!compact) {
    doc.moveDown(0.45).font("Noto").fontSize(8).fillColor(palette.muted).text(`Gerado em ${reportGeneratedLabel(generatedAt)}`);
    if (summary) doc.moveDown(0.25).text(printable(summary));
  }
  topRule(doc);
}

function infoCell(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.fillColor(palette.muted).font("NotoBold").fontSize(7).text(printable(label.toUpperCase()), x, y, { width });
  doc.fillColor(palette.ink).font("Noto").fontSize(10).text(printable(value), x, y + 13, { width, height: 32, ellipsis: true });
}

function orderHeader(doc: PDFKit.PDFDocument, report: SeasonalReportView, sheet: SeasonalOrderSheet, continued = false) {
  doc.fillColor(palette.muted).font("NotoBold").fontSize(8).text(printable(report.campaignName.toUpperCase()), margin, margin);
  doc.fillColor(palette.ink).font("NotoBold").fontSize(20).text(`Encomenda ${printable(sheet.orderNumber)}${continued ? " (continuação)" : ""}`, margin, margin + 18, {
    width: doc.page.width - margin * 2 - 90,
  });
  doc.fillColor(palette.muted).font("Noto").fontSize(8).text(`Versão ${sheet.version}`, doc.page.width - margin - 80, margin + 24, { width: 80, align: "right" });
  topRule(doc);

  if (continued) return;
  const available = doc.page.width - margin * 2;
  const half = (available - 18) / 2;
  const firstY = doc.y;
  infoCell(doc, "Serviço", sheet.fulfillmentLabel, margin, firstY, half);
  infoCell(doc, sheet.deliveryAddress ? "Data de entrega" : "Data de levantamento", sheet.serviceDate, margin + half + 18, firstY, half);
  const secondY = firstY + 54;
  infoCell(doc, "Hora", sheet.serviceTime, margin, secondY, half);
  infoCell(doc, "Loja de origem", sheet.orderingStore, margin + half + 18, secondY, half);
  const thirdY = secondY + 54;
  infoCell(doc, "Cliente", sheet.customerName, margin, thirdY, half);
  infoCell(doc, "Telefone", sheet.customerPhone, margin + half + 18, thirdY, half);
  doc.y = thirdY + 50;
  if (sheet.deliveryAddress) {
    infoCell(doc, "Morada de entrega", sheet.deliveryAddress, margin, doc.y, available);
    doc.y += 54;
  }
}

function orderTableHeader(doc: PDFKit.PDFDocument, totals = false) {
  const y = doc.y;
  const width = doc.page.width - margin * 2;
  const productWidth = width * 0.58;
  const quantityWidth = width * 0.21;
  const columns = [
    { label: "Artigo", x: margin, width: productWidth, align: "left" as const },
    { label: totals ? "Quantidade total" : "Quantidade", x: margin + productWidth, width: quantityWidth, align: "right" as const },
    { label: "Peso total", x: margin + productWidth + quantityWidth, width: width - productWidth - quantityWidth, align: "right" as const },
  ];
  for (const column of columns) {
    doc.rect(column.x, y, column.width, 26).fillAndStroke(palette.primary, palette.primary);
    doc.fillColor(palette.paper).font("NotoBold").fontSize(8).text(column.label, column.x + 6, y + 8, { width: column.width - 12, align: column.align });
  }
  doc.y = y + 26;
}

function orderRow(doc: PDFKit.PDFDocument, product: string, quantity: string, totalWeight: string, shaded: boolean) {
  const width = doc.page.width - margin * 2;
  const productWidth = width * 0.58;
  const quantityWidth = width * 0.21;
  doc.font("Noto").fontSize(9);
  const height = Math.max(28, Math.min(48, doc.heightOfString(printable(product), { width: productWidth - 12 }) + 12));
  const y = doc.y;
  const columns = [
    { value: product, x: margin, width: productWidth, align: "left" as const },
    { value: quantity, x: margin + productWidth, width: quantityWidth, align: "right" as const },
    { value: totalWeight || "-", x: margin + productWidth + quantityWidth, width: width - productWidth - quantityWidth, align: "right" as const },
  ];
  for (const column of columns) {
    doc.rect(column.x, y, column.width, height).fillAndStroke(shaded ? "#f7f8f7" : palette.paper, palette.border);
    doc.fillColor(palette.ink).font("Noto").fontSize(9).text(printable(column.value), column.x + 6, y + 7, {
      width: column.width - 12,
      height: height - 10,
      align: column.align,
      ellipsis: true,
    });
  }
  doc.y = y + height;
}

function drawOrderSheet(doc: PDFKit.PDFDocument, report: SeasonalReportView, sheet: SeasonalOrderSheet) {
  doc.addPage();
  orderHeader(doc, report, sheet);
  doc.fillColor(palette.ink).font("NotoBold").fontSize(11).text("Artigos", margin, doc.y + 4);
  doc.y += 24;
  orderTableHeader(doc);
  sheet.items.forEach((item, index) => {
    if (doc.y + 48 > pageBottom(doc)) {
      doc.addPage();
      orderHeader(doc, report, sheet, true);
      orderTableHeader(doc);
    }
    orderRow(doc, item.product, item.quantity, item.totalWeight, index % 2 === 1);
  });
}

function productTableHeader(doc: PDFKit.PDFDocument, report: SeasonalReportView) {
  const y = doc.y;
  const width = doc.page.width - margin * 2;
  const productWidth = width * 0.52;
  const summed = report.productAggregation === "sum";
  const columns = [
    { label: "Artigo", x: margin, width: productWidth, align: "left" as const },
    { label: summed ? "Quantidade total" : "Quantidades por encomenda", x: margin + productWidth, width: width - productWidth, align: summed ? "right" as const : "left" as const },
  ];
  for (const column of columns) {
    doc.rect(column.x, y, column.width, 26).fillAndStroke(palette.primary, palette.primary);
    doc.fillColor(palette.paper).font("NotoBold").fontSize(8).text(column.label, column.x + 6, y + 8, { width: column.width - 12, align: column.align });
  }
  doc.y = y + 26;
}

function productRow(doc: PDFKit.PDFDocument, report: SeasonalReportView, row: SeasonalProductTotalRow, shaded: boolean) {
  const width = doc.page.width - margin * 2;
  const productWidth = width * 0.52;
  const summed = report.productAggregation === "sum";
  const detail = summed ? row.quantity : row.orderQuantities.map((entry) => `${entry.clientName} - ${entry.quantity}`).join("\n");
  doc.font("Noto").fontSize(9);
  const height = Math.max(28, Math.min(150, Math.max(
    doc.heightOfString(printable(row.product), { width: productWidth - 12 }),
    doc.heightOfString(printable(detail), { width: width - productWidth - 12 }),
  ) + 12));
  const y = doc.y;
  const columns = [
    { value: row.product, x: margin, width: productWidth, align: "left" as const },
    { value: detail, x: margin + productWidth, width: width - productWidth, align: summed ? "right" as const : "left" as const },
  ];
  for (const column of columns) {
    doc.rect(column.x, y, column.width, height).fillAndStroke(shaded ? "#f7f8f7" : palette.paper, palette.border);
    doc.fillColor(palette.ink).font("Noto").fontSize(9).text(printable(column.value), column.x + 6, y + 7, {
      width: column.width - 12,
      height: height - 10,
      align: column.align,
      ellipsis: true,
    });
  }
  doc.y = y + height;
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
  const y = doc.y;
  doc.roundedRect(margin, y, doc.page.width - margin * 2, 28, 4).fill(palette.soft);
  doc.fillColor(palette.ink).font("NotoBold").fontSize(9).text(printable(title), margin + 8, y + 8, { width: doc.page.width - margin * 2 - 16 });
  doc.y = y + 28;
}

function newTotalsPage(doc: PDFKit.PDFDocument, report: SeasonalReportView, section?: SeasonalProductTotalSection) {
  doc.addPage();
  documentHeader(doc, report.title, report.generatedAt, undefined, true);
  if (section?.title) sectionHeader(doc, `${section.title} (continuação)`);
  productTableHeader(doc, report);
}

function drawProductSection(doc: PDFKit.PDFDocument, report: SeasonalReportView, section: SeasonalProductTotalSection) {
  if (doc.y + 82 > pageBottom(doc)) newTotalsPage(doc, report);
  if (section.title) sectionHeader(doc, section.title);
  productTableHeader(doc, report);
  section.rows.forEach((row, index) => {
    const rows = report.productAggregation === "sum"
      ? [row]
      : row.orderQuantities.map((entry, entryIndex) => ({
        ...row,
        product: entryIndex === 0 ? row.product : "",
        orderQuantities: [entry],
      }));
    for (const current of rows) {
      if (doc.y + 48 > pageBottom(doc)) newTotalsPage(doc, report, section);
      productRow(doc, report, current, index % 2 === 1);
    }
  });
  doc.y += 14;
}

function addFooters(doc: PDFKit.PDFDocument, report: SeasonalReportView) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const y = doc.page.height - margin - 10;
    doc.moveTo(margin, y - 7).lineTo(doc.page.width - margin, y - 7).strokeColor(palette.border).lineWidth(0.7).stroke();
    doc.fillColor(palette.muted).font("Noto").fontSize(7);
    doc.text(printable(report.campaignName), margin, y, { width: (doc.page.width - margin * 2) / 2, lineBreak: false });
    doc.text(`Página ${index + 1} de ${range.count}`, doc.page.width / 2, y, { width: doc.page.width / 2 - margin, align: "right", lineBreak: false });
  }
}

export async function renderSeasonalReportPdf(report: SeasonalReportView) {
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
    layout: "portrait",
    margin,
    size: "A4",
    info: { Title: report.title, Author: "Encomendas", Subject: "Exportação de encomendas sazonais" },
  });
  doc.registerFont("Noto", regularFont);
  doc.registerFont("NotoBold", boldFont);
  const result = collectDocument(doc);

  if (report.mode === "order_sheets") {
    report.orderSheets.forEach((sheet) => drawOrderSheet(doc, report, sheet));
  } else {
    doc.addPage();
    documentHeader(doc, report.title, report.generatedAt, report.summary);
    for (const section of report.productSections) drawProductSection(doc, report, section);
  }

  if (!report.rowCount) {
    doc.addPage();
    documentHeader(doc, report.title, report.generatedAt, report.summary);
    doc.roundedRect(margin, doc.y, doc.page.width - margin * 2, 70, 6).fillAndStroke(palette.soft, palette.border);
    doc.fillColor(palette.ink).font("NotoBold").fontSize(12).text("Sem resultados", margin + 12, doc.y + 15);
    doc.fillColor(palette.muted).font("Noto").fontSize(9).text("Não existem encomendas aceites para esta exportação.", margin + 12, doc.y + 36);
  }

  addFooters(doc, report);
  doc.end();
  return result;
}
