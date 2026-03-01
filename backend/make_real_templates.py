import base64
def get_b64(filename):
    with open(filename, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')
docx_b64 = get_b64('real_empty.docx')
xlsx_b64 = get_b64('real_empty.xlsx')
pptx_b64 = get_b64('real_empty.pptx')
go_code = f'''package main

import (
	"encoding/base64"
)

const BlankDocxBase64 = "{docx_b64}"
const BlankXlsxBase64 = "{xlsx_b64}"
const BlankPptxBase64 = "{pptx_b64}"

func CreateEmptyDocx() ([]byte, error) {{
	return base64.StdEncoding.DecodeString(BlankDocxBase64)
}}

func CreateEmptyXlsx() ([]byte, error) {{
	return base64.StdEncoding.DecodeString(BlankXlsxBase64)
}}

func CreateEmptyPptx() ([]byte, error) {{
	return base64.StdEncoding.DecodeString(BlankPptxBase64)
}}
'''
with open('office_templates.go', 'w', encoding='utf-8') as f: f.write(go_code)
print('SUCCESS')
