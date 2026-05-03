const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const INVOICES_DIR = path.join(__dirname, "../invoices");

const invoiceTool = {
  name: "generate_invoice",
  description:
    "Generate a professional PDF invoice. Use this when the user provides invoice details like client name, services, and amounts.",
  input_schema: {
    type: "object",
    properties: {
      invoice_number: { type: "string", description: "Invoice number e.g. INV-001" },
      your_name: { type: "string", description: "Your name or business name" },
      your_email: { type: "string", description: "Your email address" },
      client_name: { type: "string", description: "Client name or company" },
      client_email: { type: "string", description: "Client email address" },
      issue_date: { type: "string", description: "Issue date e.g. 2025-01-15" },
      due_date: { type: "string", description: "Due date e.g. 2025-01-30" },
      items: {
        type: "array",
        description: "List of services/items",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            rate: { type: "number" },
          },
          required: ["description", "quantity", "rate"],
        },
      },
      currency: { type: "string", description: "Currency symbol e.g. $, €, £. Default: $" },
      notes: { type: "string", description: "Optional payment notes or terms" },
    },
    required: ["invoice_number", "your_name", "client_name", "items", "issue_date", "due_date"],
  },
};

async function executeInvoiceTool(input) {
  try {
    const currency = input.currency || "$";
    const filename = `invoice-${crypto.randomBytes(6).toString("hex")}.pdf`;
    const filepath = path.join(INVOICES_DIR, filename);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(filepath);

    await new Promise((resolve, reject) => {
      doc.pipe(stream);

      const PRIMARY = "#1a1a2e";
      const ACCENT = "#6c8cff";
      const LIGHT_GRAY = "#f3f4f6";
      const MID_GRAY = "#6b7280";
      const pageWidth = doc.page.width - 100;

      // ── Header bar ──
      doc.rect(0, 0, doc.page.width, 80).fill(PRIMARY);
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(28).text("INVOICE", 50, 25);
      doc.fillColor(ACCENT).fontSize(12).text(input.invoice_number, 50, 56);
      doc
        .fillColor("#ffffff")
        .font("Helvetica")
        .fontSize(9)
        .text(`Issue Date: ${input.issue_date}`, 350, 30, { align: "right", width: 200 })
        .text(`Due Date: ${input.due_date}`, 350, 44, { align: "right", width: 200 });

      // ── From / To ──
      const fromToY = 110;
      doc.fillColor(MID_GRAY).font("Helvetica-Bold").fontSize(9).text("FROM", 50, fromToY);
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(13).text(input.your_name, 50, fromToY + 14);
      if (input.your_email) {
        doc.fillColor(MID_GRAY).font("Helvetica").fontSize(10).text(input.your_email, 50, fromToY + 30);
      }

      doc.fillColor(MID_GRAY).font("Helvetica-Bold").fontSize(9).text("BILL TO", 300, fromToY);
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(13).text(input.client_name, 300, fromToY + 14);
      if (input.client_email) {
        doc.fillColor(MID_GRAY).font("Helvetica").fontSize(10).text(input.client_email, 300, fromToY + 30);
      }

      // ── Divider ──
      doc.moveTo(50, fromToY + 60).lineTo(545, fromToY + 60).strokeColor("#e5e7eb").lineWidth(1).stroke();

      // ── Table header ──
      const tableY = fromToY + 75;
      doc.rect(50, tableY, pageWidth, 24).fill(PRIMARY);
      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("DESCRIPTION", 60, tableY + 8)
        .text("QTY", 360, tableY + 8, { width: 50, align: "center" })
        .text("RATE", 415, tableY + 8, { width: 70, align: "right" })
        .text("AMOUNT", 490, tableY + 8, { width: 55, align: "right" });

      // ── Items ──
      let currentY = tableY + 24;
      let subtotal = 0;

      input.items.forEach((item, idx) => {
        const amount = item.quantity * item.rate;
        subtotal += amount;
        const rowBg = idx % 2 === 0 ? "#ffffff" : LIGHT_GRAY;
        doc.rect(50, currentY, pageWidth, 28).fill(rowBg);
        doc
          .fillColor(PRIMARY)
          .font("Helvetica")
          .fontSize(10)
          .text(item.description, 60, currentY + 9, { width: 280 })
          .text(item.quantity.toString(), 360, currentY + 9, { width: 50, align: "center" })
          .text(`${currency}${item.rate.toFixed(2)}`, 415, currentY + 9, { width: 70, align: "right" })
          .text(`${currency}${amount.toFixed(2)}`, 490, currentY + 9, { width: 55, align: "right" });
        currentY += 28;
      });

      // ── Totals ──
      currentY += 10;
      doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor("#e5e7eb").lineWidth(1).stroke();
      currentY += 15;

      doc
        .fillColor(MID_GRAY).font("Helvetica").fontSize(10)
        .text("Subtotal", 390, currentY, { width: 100, align: "right" })
        .fillColor(PRIMARY)
        .text(`${currency}${subtotal.toFixed(2)}`, 490, currentY, { width: 55, align: "right" });

      currentY += 18;
      doc.rect(370, currentY, 175, 32).fill(PRIMARY);
      doc
        .fillColor("#ffffff").font("Helvetica-Bold").fontSize(12)
        .text("TOTAL DUE", 380, currentY + 10, { width: 80 })
        .fontSize(14)
        .text(`${currency}${subtotal.toFixed(2)}`, 400, currentY + 9, { width: 130, align: "right" });

      // ── Notes ──
      if (input.notes) {
        currentY += 55;
        doc.fillColor(MID_GRAY).font("Helvetica-Bold").fontSize(9).text("NOTES", 50, currentY);
        doc.fillColor(PRIMARY).font("Helvetica").fontSize(10).text(input.notes, 50, currentY + 14, { width: pageWidth });
      }

      // ── Footer ──
      const footerY = currentY + (input.notes ? 40 : 55);
      doc.rect(50, footerY, pageWidth, 1).fillColor("#e5e7eb").fill();
      doc
        .fillColor(MID_GRAY)
        .font("Helvetica")
        .fontSize(8)
        .text(`Thank you for your business, ${input.client_name}!`, 50, footerY + 8, {
          align: "center",
          width: pageWidth,
        });

      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    const downloadUrl = `http://localhost:${process.env.PORT || 3000}/invoices/${filename}`;
    return {
      success: true,
      download_url: downloadUrl,
      filename,
      total: `${currency}${input.items.reduce((s, i) => s + i.quantity * i.rate, 0).toFixed(2)}`,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { invoiceTool, executeInvoiceTool };