package main

import (
	"archive/zip"
	"bytes"
	"fmt"
	"time"
)

// CreateEmptyDocx creates a minimal valid .docx file in memory
func CreateEmptyDocx() ([]byte, error) {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	// [Content_Types].xml
	ct, _ := w.Create("[Content_Types].xml")
	fmt.Fprint(ct, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`)

	// _rels/.rels
	rels, _ := w.Create("_rels/.rels")
	fmt.Fprint(rels, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`)

	// word/_rels/document.xml.rels
	wrels, _ := w.Create("word/_rels/document.xml.rels")
	fmt.Fprint(wrels, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`)

	// word/document.xml
	doc, _ := w.Create("word/document.xml")
	fmt.Fprint(doc, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Dokumen Baru BaknusDrive</w:t></w:r></w:p>
  </w:body>
</w:document>`)

	// docProps/core.xml
	now := time.Now().Format("2006-01-02T15:04:05Z")
	core, _ := w.Create("docProps/core.xml")
	fmt.Fprintf(core, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>BaknusDrive Doc</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">%s</dcterms:created>
</cp:coreProperties>`, now)

	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// CreateEmptyXlsx creates a minimal valid .xlsx file in memory
func CreateEmptyXlsx() ([]byte, error) {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	// [Content_Types].xml
	ct, _ := w.Create("[Content_Types].xml")
	fmt.Fprint(ct, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`)

	// _rels/.rels
	rels, _ := w.Create("_rels/.rels")
	fmt.Fprint(rels, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)

	// xl/_rels/workbook.xml.rels
	wbrels, _ := w.Create("xl/_rels/workbook.xml.rels")
	fmt.Fprint(wbrels, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`)

	// xl/workbook.xml
	wb, _ := w.Create("xl/workbook.xml")
	fmt.Fprint(wb, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`)

	// xl/worksheets/sheet1.xml
	sheet, _ := w.Create("xl/worksheets/sheet1.xml")
	fmt.Fprint(sheet, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData/>
</worksheet>`)

	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// CreateEmptyPptx creates a minimal valid .pptx file in memory
func CreateEmptyPptx() ([]byte, error) {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	// [Content_Types].xml
	ct, _ := w.Create("[Content_Types].xml")
	fmt.Fprint(ct, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`)

	// _rels/.rels
	rels, _ := w.Create("_rels/.rels")
	fmt.Fprint(rels, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`)

	// ppt/_rels/presentation.xml.rels
	prels, _ := w.Create("ppt/_rels/presentation.xml.rels")
	fmt.Fprint(prels, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`)

	// ppt/presentation.xml
	pres, _ := w.Create("ppt/presentation.xml")
	fmt.Fprint(pres, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
</p:presentation>`)

	// ppt/slides/slide1.xml
	slide, _ := w.Create("ppt/slides/slide1.xml")
	fmt.Fprint(slide, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sld>`)

	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
