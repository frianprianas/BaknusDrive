$ErrorActionPreference = "Stop"
Invoke-WebRequest -Uri "https://github.com/dtolstyi/node-msoffice-pdf/raw/master/test/fixtures/empty.docx" -OutFile "empty.docx"
Invoke-WebRequest -Uri "https://github.com/LibreOffice/core/raw/master/sw/qa/extras/ooxmlexport/data/empty.xlsx" -OutFile "empty.xlsx"
Invoke-WebRequest -Uri "https://github.com/LibreOffice/core/raw/master/sd/qa/unit/data/pptx/empty.pptx" -OutFile "empty.pptx"

$docx = [Convert]::ToBase64String([IO.File]::ReadAllBytes("empty.docx"))
$xlsx = [Convert]::ToBase64String([IO.File]::ReadAllBytes("empty.xlsx"))
$pptx = [Convert]::ToBase64String([IO.File]::ReadAllBytes("empty.pptx"))

$out = @"
package main

import (
	"encoding/base64"
)

const BlankDocxBase64 = `"$docx`"
const BlankXlsxBase64 = `"$xlsx`"
const BlankPptxBase64 = `"$pptx`"

func CreateEmptyDocx() ([]byte, error) {
	return base64.StdEncoding.DecodeString(BlankDocxBase64)
}

func CreateEmptyXlsx() ([]byte, error) {
	return base64.StdEncoding.DecodeString(BlankXlsxBase64)
}

func CreateEmptyPptx() ([]byte, error) {
	return base64.StdEncoding.DecodeString(BlankPptxBase64)
}
"@

[IO.File]::WriteAllText("backend/office_templates.go", $out)
