package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"time"

	"baknus-forms/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

func main() {
	// Initialize connections
	InitDB()
	InitRedis()

	r := gin.Default()

	// CORS Setup
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return true
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	api := r.Group("/api/forms")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "BaknusForms Service is running on port 8083!"})
		})

		// Public Form Routes
		api.GET("/f/:id", GetPublicForm)
		api.POST("/f/:id/submit", SubmitFormResponse)

		// Protected Routes
		protected := api.Group("")
		protected.Use(AuthMiddleware())
		{
			protected.GET("", ListMyForms)
			protected.POST("", CreateForm)
			protected.GET("/:id", GetFormDetails)
			protected.PUT("/:id", UpdateForm)
			protected.DELETE("/:id", DeleteForm)
			protected.GET("/:id/responses", GetFormResponses)
			protected.POST("/:id/responses/export", ExportResponsesToDrive)
		}
	}

	log.Println("BaknusForms Service starting on :8080 (mapped to 8083)")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// Handlers Stubs
func GetPublicForm(c *gin.Context) {
	id := c.Param("id")
	var form models.Form
	if err := DB.Where("id = ? AND is_active = ?", id, true).First(&form).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form tidak ditemukan atau sudah tidak aktif"})
		return
	}
	c.JSON(http.StatusOK, form)
}

func SubmitFormResponse(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		ResponseData interface{} `json:"response_data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	jsonData, err := json.Marshal(req.ResponseData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses data"})
		return
	}

	response := models.FormResponse{
		FormID:       id,
		ResponseData: string(jsonData),
	}

	if err := DB.Create(&response).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan jawaban"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Jawaban berhasil dikirim"})
}

func ListMyForms(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	var forms []models.Form
	DB.Where("creator_id = ?", userID).Find(&forms)
	c.JSON(http.StatusOK, forms)
}

func CreateForm(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	var req struct {
		Title       string      `json:"title"`
		Description string      `json:"description"`
		Questions   interface{} `json:"questions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	questionsJSON, _ := json.Marshal(req.Questions)

	form := models.Form{
		Title:       req.Title,
		Description: req.Description,
		Questions:   string(questionsJSON),
		CreatorID:   userID,
		IsActive:    true,
	}

	if err := DB.Create(&form).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat formulir"})
		return
	}
	c.JSON(http.StatusCreated, form)
}

func GetFormDetails(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("userID").(string)
	var form models.Form
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).First(&form).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, form)
}

func UpdateForm(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("userID").(string)
	var req models.Form
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	var form models.Form
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).First(&form).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form tidak ditemukan"})
		return
	}

	form.Title = req.Title
	form.Description = req.Description
	form.Questions = req.Questions
	form.IsActive = req.IsActive

	DB.Save(&form)
	c.JSON(http.StatusOK, form)
}

func DeleteForm(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("userID").(string)
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).Delete(&models.Form{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus form"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Form berhasil dihapus"})
}

func GetFormResponses(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("userID").(string)
	
	// Check ownership
	var form models.Form
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).First(&form).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak"})
		return
	}

	var responses []models.FormResponse
	DB.Where("form_id = ?", id).Find(&responses)
	c.JSON(http.StatusOK, responses)
}

// ExportResponsesToDrive generates an XLSX file from all responses and saves it to the creator's Drive
func ExportResponsesToDrive(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("userID").(string)

	// 1. Verify ownership
	var form models.Form
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).First(&form).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak"})
		return
	}

	// 2. Parse questions from JSON string
	var questions []map[string]interface{}
	if err := json.Unmarshal([]byte(form.Questions), &questions); err != nil {
		questions = []map[string]interface{}{}
	}

	// 3. Fetch all responses
	var responses []models.FormResponse
	DB.Where("form_id = ?", id).Order("created_at asc").Find(&responses)

	// 4. Build XLSX
	f := excelize.NewFile()
	sheet := "Respon"
	f.NewSheet(sheet)
	f.DeleteSheet("Sheet1")

	// Header style
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"4F46E5"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "CCCCCC", Style: 1},
		},
	})

	// Build header row: No | Waktu | <question labels...>
	headers := []string{"No", "Waktu Pengiriman", "Responden"}
	for _, q := range questions {
		label, _ := q["label"].(string)
		if label == "" {
			label = "Pertanyaan"
		}
		headers = append(headers, label)
	}

	for col, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(col+1, 1)
		f.SetCellValue(sheet, cell, header)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
	}
	f.SetRowHeight(sheet, 1, 22)

	// Data rows
	for rowIdx, resp := range responses {
		row := rowIdx + 2
		var respData map[string]interface{}
		json.Unmarshal([]byte(resp.ResponseData), &respData)

		respondent := resp.Respondent
		if respondent == "" {
			respondent = "Anonim"
		}

		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), rowIdx+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), resp.CreatedAt.Format("2006-01-02 15:04:05"))
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), respondent)

		for colIdx, q := range questions {
			qID, _ := q["id"].(string)
			val := ""
			if respData != nil {
				if v, ok := respData[qID]; ok {
					switch vt := v.(type) {
					case []interface{}:
						// checkbox – join values
						strs := make([]string, len(vt))
						for i, item := range vt {
							strs[i] = fmt.Sprintf("%v", item)
						}
						for i, s := range strs {
							if i == 0 {
								val = s
							} else {
								val += ", " + s
							}
						}
					default:
						val = fmt.Sprintf("%v", vt)
					}
				}
			}
			cell, _ := excelize.CoordinatesToCellName(colIdx+4, row)
			f.SetCellValue(sheet, cell, val)
		}
	}

	// Auto-width columns
	for col := range headers {
		colName, _ := excelize.ColumnNumberToName(col + 1)
		f.SetColWidth(sheet, colName, colName, 22)
	}

	// 5. Write XLSX to buffer
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat file XLSX"})
		return
	}

	// 6. Upload to creator's Drive via main backend API
	filename := fmt.Sprintf("Respon_%s_%s.xlsx", form.Title, time.Now().Format("20060102_150405"))
	authHeader := c.GetHeader("Authorization")

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat form file"})
		return
	}
	io.Copy(part, &buf)
	writer.Close()

	// Call the main backend upload endpoint (internal Docker network)
	uploadReq, _ := http.NewRequest("POST", "http://backend:8080/api/drive/upload", body)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadReq.Header.Set("Authorization", authHeader)

	client := &http.Client{Timeout: 30 * time.Second}
	uploadResp, err := client.Do(uploadReq)
	if err != nil || uploadResp.StatusCode >= 400 {
		errMsg := "Gagal mengupload ke Drive"
		if uploadResp != nil {
			respBody, _ := io.ReadAll(uploadResp.Body)
			errMsg = string(respBody)
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": errMsg})
		return
	}
	defer uploadResp.Body.Close()

	var uploadResult map[string]interface{}
	json.NewDecoder(uploadResp.Body).Decode(&uploadResult)

	c.JSON(http.StatusOK, gin.H{
		"message":  fmt.Sprintf("File '%s' berhasil disimpan ke Drive Anda!", filename),
		"file":     uploadResult,
		"filename": filename,
	})
}
