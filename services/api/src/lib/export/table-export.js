const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

function rowsToMatrix(columns, rows) {
  return rows.map((row) => columns.map((col) => col.value(row)));
}

async function buildXlsxBuffer({ title, columns, rows, sheets }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Águia Gestão Veicular';
  workbook.created = new Date();

  const sheetDefs = sheets || [{ name: title, columns, rows }];

  sheetDefs.forEach((def, index) => {
    const sheetName = (def.name || `${title} ${index + 1}`).slice(0, 31);
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow(def.columns.map((col) => col.header));
    rowsToMatrix(def.columns, def.rows).forEach((line) => sheet.addRow(line));
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => {
      column.width = Math.min(40, Math.max(12, (column.header?.length || 10) + 2));
    });
  });

  return workbook.xlsx.writeBuffer();
}

function buildPdfBuffer({ title, columns, rows, generatedAt, sections }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const sectionList = sections || [{ title, columns, rows }];

    sectionList.forEach((section, sectionIndex) => {
      if (sectionIndex > 0) doc.addPage();

      doc.fontSize(14).font('Helvetica-Bold').text(section.title, { align: 'left' });
      doc.moveDown(0.3);
      if (generatedAt) {
        doc.fontSize(8).font('Helvetica').fillColor('#666666')
          .text(`Gerado em ${generatedAt}`, { align: 'left' });
        doc.moveDown(0.5);
      }
      doc.fillColor('#000000');

      renderTable(doc, section.columns, section.rows);
    });

    doc.end();
  });
}

function renderTable(doc, columns, rows) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;
  const colWidth = tableWidth / columns.length;
  let y = doc.y;

  doc.fontSize(7).font('Helvetica-Bold');
  columns.forEach((col, index) => {
    doc.text(col.header, left + index * colWidth, y, { width: colWidth - 4, lineBreak: false });
  });
  y += 12;
  doc.moveTo(left, y).lineTo(right, y).stroke('#cccccc');
  y += 4;

  doc.font('Helvetica').fontSize(7);
  rows.forEach((row) => {
    const values = columns.map((col) => String(col.value(row) ?? ''));
    const heights = values.map((value, index) => doc.heightOfString(value, { width: colWidth - 4 }));
    const rowHeight = Math.max(10, ...heights) + 4;

    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage({ layout: 'landscape' });
      y = doc.page.margins.top;
    }

    values.forEach((value, index) => {
      doc.text(value, left + index * colWidth, y, { width: colWidth - 4 });
    });
    y += rowHeight;
  });

  doc.y = y;
}

async function buildExportBuffer({ format, title, columns, rows, sheets, sections, generatedAt }) {
  if (format === 'pdf') {
    return buildPdfBuffer({ title, columns, rows, generatedAt, sections });
  }
  return buildXlsxBuffer({ title, columns, rows, sheets });
}

function sendExportResponse(res, { format, filename, buffer }) {
  const ext = format === 'pdf' ? 'pdf' : 'xlsx';
  res.setHeader('Content-Type', MIME[ext] || MIME.xlsx);
  res.setHeader('Content-Disposition', `attachment; filename="${filename || `export.${ext}`}"`);
  res.send(buffer);
}

module.exports = {
  buildExportBuffer,
  sendExportResponse,
  MIME,
};
