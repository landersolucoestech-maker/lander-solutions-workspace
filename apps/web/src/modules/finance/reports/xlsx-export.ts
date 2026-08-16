export type WorkbookCell = string | number | boolean | null | undefined;

export interface WorkbookSheet {
  name: string;
  rows: WorkbookCell[][];
  widths?: number[];
  headerRows?: number;
}

interface ZipFile {
  name: string;
  data: Uint8Array;
}

const encoder = new TextEncoder();
const crcTable = createCrcTable();

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sanitizeSheetName(name: string, index: number) {
  const sanitized = name
    .replace(/[\\/*?:[\]]/g, " ")
    .trim()
    .slice(0, 31);
  return sanitized || `Planilha ${index + 1}`;
}

function columnName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function worksheetXml(sheet: WorkbookSheet) {
  const headerRows = sheet.headerRows ?? 1;
  const maxColumns = Math.max(1, ...sheet.rows.map((row) => row.length));
  const maxRows = Math.max(1, sheet.rows.length);
  const dimensions = `A1:${columnName(maxColumns - 1)}${maxRows}`;
  const columns = (sheet.widths ?? [])
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${Math.max(4, Math.min(80, width))}" customWidth="1"/>`,
    )
    .join("");

  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          if (value === null || value === undefined) return "";
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          const style = rowIndex < headerRows ? ' s="1"' : "";
          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${reference}"${style}><v>${value}</v></c>`;
          }
          if (typeof value === "boolean") {
            return `<c r="${reference}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
          }
          return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const autoFilter = sheet.rows.length > 1 ? `<autoFilter ref="${dimensions}"/>` : "";
  const pane =
    headerRows > 0
      ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
      : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensions}"/>
  <sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  ${columns ? `<cols>${columns}</cols>` : ""}
  <sheetData>${rows}</sheetData>
  ${autoFilter}
</worksheet>`;
}

function contentTypesXml(sheetCount: number) {
  const worksheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${worksheets}
</Types>`;
}

function workbookXml(sheets: WorkbookSheet[]) {
  const sheetNodes = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${xmlEscape(sanitizeSheetName(sheet.name, index))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>
  <sheets>${sheetNodes}</sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;
}

function workbookRelationshipsXml(sheetCount: number) {
  const sheetRelationships = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRelationships}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function packageRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos Display"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF172033"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9DEE8"/></left><right style="thin"><color rgb="FFD9DEE8"/></right><top style="thin"><color rgb="FFD9DEE8"/></top><bottom style="thin"><color rgb="FFD9DEE8"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function corePropertiesXml(createdAt: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>LANDER SOLUTIONS</dc:creator>
  <cp:lastModifiedBy>LANDER SOLUTIONS</cp:lastModifiedBy>
  <dc:title>Relatórios gerenciais</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">${xmlEscape(createdAt)}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${xmlEscape(createdAt)}</dcterms:modified>
</cp:coreProperties>`;
}

function appPropertiesXml(sheets: WorkbookSheet[]) {
  const titles = sheets
    .map(
      (sheet, index) => `<vt:lpstr>${xmlEscape(sanitizeSheetName(sheet.name, index))}</vt:lpstr>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>LANDER SOLUTIONS Corporate Control Plane</Application>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Planilhas</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts>
</Properties>`;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function makeHeader(length: number) {
  return new Uint8Array(length);
}

function buildZip(files: ZipFile[]) {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const now = dosDateTime(new Date());
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const checksum = crc32(file.data);
    const localHeader = makeHeader(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, now.time, true);
    localView.setUint16(12, now.day, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, file.data.length, true);
    localView.setUint32(22, file.data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    localChunks.push(localHeader, name, file.data);

    const centralHeader = makeHeader(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, now.time, true);
    centralView.setUint16(14, now.day, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralChunks.push(centralHeader, name);

    localOffset += localHeader.length + name.length + file.data.length;
  }

  const centralDirectory = concatBytes(centralChunks);
  const end = makeHeader(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localChunks, centralDirectory, end]);
}

export function createWorkbookBlob(sheets: WorkbookSheet[], createdAt = new Date().toISOString()) {
  if (sheets.length === 0) throw new Error("O arquivo XLSX precisa de pelo menos uma planilha.");

  const files: ZipFile[] = [
    { name: "[Content_Types].xml", data: encoder.encode(contentTypesXml(sheets.length)) },
    { name: "_rels/.rels", data: encoder.encode(packageRelationshipsXml()) },
    { name: "docProps/core.xml", data: encoder.encode(corePropertiesXml(createdAt)) },
    { name: "docProps/app.xml", data: encoder.encode(appPropertiesXml(sheets)) },
    { name: "xl/workbook.xml", data: encoder.encode(workbookXml(sheets)) },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: encoder.encode(workbookRelationshipsXml(sheets.length)),
    },
    { name: "xl/styles.xml", data: encoder.encode(stylesXml()) },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(worksheetXml(sheet)),
    })),
  ];

  return new Blob([buildZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadWorkbook(filename: string, sheets: WorkbookSheet[], createdAt?: string) {
  const blob = createWorkbookBlob(sheets, createdAt);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
