package main

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"baknus-forms/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

const BACKEND_URL = "http://backend:8080"
const BAKNUSFORM_FOLDER = "Baknusform"

func main() {
	InitDB()
	InitRedis()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool { return true },
		AllowMethods:    []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:    []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:   []string{"Content-Length"},
		AllowCredentials: true,
	}))

	api := r.Group("/api/forms")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "BaknusForms Service OK"})
		})

		// Public routes
		api.GET("/f/:id", GetPublicForm)
		api.POST("/f/:id/submit", SubmitFormResponse)

		// Protected routes
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

	log.Println("BaknusForms Service starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// ensureBaknusFormFolder calls the main backend to find-or-create "Baknusform" folder.
// Returns the folder ID (uint) on success.
func ensureBaknusFormFolder(authHeader string) (uint, error) {
	// 1. Try listing root folders to find "Baknusform"
	req, _ := http.NewRequest("GET", BACKEND_URL+"/api/drive?parent_id=", nil)
	req.Header.Set("Authorization", authHeader)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("gagal hubungi backend: %v", err)
	}
	defer resp.Body.Close()

	var driveData struct {
		Folders []struct {
			ID   uint   `json:"id"`
			Name string `json:"name"`
		} `json:"folders"`
	}
	json.NewDecoder(resp.Body).Decode(&driveData)

	// Check if already exists
	for _, f := range driveData.Folders {
		if strings.EqualFold(f.Name, BAKNUSFORM_FOLDER) {
			return f.ID, nil
		}
	}

	// 2. Create the folder
	body, _ := json.Marshal(map[string]interface{}{"name": BAKNUSFORM_FOLDER})
	createReq, _ := http.NewRequest("POST", BACKEND_URL+"/api/drive/folder", bytes.NewReader(body))
	createReq.Header.Set("Authorization", authHeader)
	createReq.Header.Set("Content-Type", "application/json")

	createResp, err := client.Do(createReq)
	if err != nil {
		return 0, fmt.Errorf("gagal membuat folder: %v", err)
	}
	defer createResp.Body.Close()

	var folder struct {
		ID uint `json:"id"`
	}
	json.NewDecoder(createResp.Body).Decode(&folder)
	if folder.ID == 0 {
		return 0, fmt.Errorf("folder ID tidak valid setelah dibuat")
	}
	return folder.ID, nil
}

// uploadCSVToDrive uploads a CSV buffer to the Drive under folderID.
func uploadCSVToDrive(authHeader string, folderID uint, filename string, csvBuf *bytes.Buffer) error {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, _ := writer.CreateFormFile("file", filename)
	io.Copy(part, csvBuf)
	writer.WriteField("parent_id", fmt.Sprintf("%d", folderID))
	writer.Close()

	uploadURL := fmt.Sprintf("%s/api/drive/upload", BACKEND_URL)
	req, _ := http.NewRequest("POST", uploadURL, body)
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("upload gagal (%d): %s", resp.StatusCode, string(b))
	}
	return nil
}

// buildCSV generates CSV bytes from form questions + responses.
func buildCSV(questions []map[string]interface{}, responses []models.FormResponse) (*bytes.Buffer, error) {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	// Header row
	headers := []string{"No", "Waktu Pengiriman", "Respondent"}
	for _, q := range questions {
		label, _ := q["label"].(string)
		if label == "" {
			label = "Pertanyaan"
		}
		headers = append(headers, label)
	}
	w.Write(headers)

	// Data rows
	for i, resp := range responses {
		var data map[string]interface{}
		json.Unmarshal([]byte(resp.ResponseData), &data)

		respondent := resp.Respondent
		if respondent == "" {
			respondent = "Anonim"
		}

		row := []string{
			fmt.Sprintf("%d", i+1),
			resp.CreatedAt.Format("2006-01-02 15:04:05"),
			respondent,
		}
		for _, q := range questions {
			qID, _ := q["id"].(string)
			val := ""
			if data != nil {
				if v, ok := data[qID]; ok {
					switch vt := v.(type) {
					case []interface{}:
						parts := make([]string, len(vt))
						for j, item := range vt {
							parts[j] = fmt.Sprintf("%v", item)
						}
						val = strings.Join(parts, ", ")
					default:
						val = fmt.Sprintf("%v", vt)
					}
				}
			}
			row = append(row, val)
		}
		w.Write(row)
	}
	w.Flush()

	if err := w.Error(); err != nil {
		return nil, err
	}
	return &buf, nil
}

// ─── handlers ─────────────────────────────────────────────────────────────────

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

	jsonData, _ := json.Marshal(req.ResponseData)

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
	DB.Where("creator_id = ?", userID).Order("created_at desc").Find(&forms)
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

	// Ensure "Baknusform" folder exists in user's Drive
	authHeader := c.GetHeader("Authorization")
	folderID, err := ensureBaknusFormFolder(authHeader)
	if err != nil {
		log.Printf("Warning: gagal membuat folder Baknusform: %v", err)
		// Don't block form creation if folder creation fails
		folderID = 0
	}

	questionsJSON, _ := json.Marshal(req.Questions)

	form := models.Form{
		Title:       req.Title,
		Description: req.Description,
		Questions:   string(questionsJSON),
		CreatorID:   userID,
		IsActive:    true,
	}
	if folderID > 0 {
		form.FolderID = &folderID
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

	var form models.Form
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).First(&form).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form tidak ditemukan"})
		return
	}

	var req struct {
		Title       string      `json:"title"`
		Description string      `json:"description"`
		Questions   interface{} `json:"questions"`
		IsActive    *bool       `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	if req.Title != "" {
		form.Title = req.Title
	}
	form.Description = req.Description
	if req.Questions != nil {
		qJSON, _ := json.Marshal(req.Questions)
		form.Questions = string(qJSON)
	}
	if req.IsActive != nil {
		form.IsActive = *req.IsActive
	}

	DB.Save(&form)
	c.JSON(http.StatusOK, form)
}

func DeleteForm(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("userID").(string)

	var form models.Form
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).First(&form).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form tidak ditemukan"})
		return
	}

	// Also delete all responses
	DB.Where("form_id = ?", id).Delete(&models.FormResponse{})
	DB.Delete(&form)

	c.JSON(http.StatusOK, gin.H{"message": "Form dan semua responnya berhasil dihapus"})
}

func GetFormResponses(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("userID").(string)

	var form models.Form
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).First(&form).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak"})
		return
	}

	var responses []models.FormResponse
	DB.Where("form_id = ?", id).Order("created_at asc").Find(&responses)
	c.JSON(http.StatusOK, responses)
}

func ExportResponsesToDrive(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("userID").(string)
	authHeader := c.GetHeader("Authorization")

	// 1. Verify ownership
	var form models.Form
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).First(&form).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak"})
		return
	}

	// 2. Ensure Baknusform folder exists
	folderID := uint(0)
	if form.FolderID != nil {
		folderID = *form.FolderID
	}
	if folderID == 0 {
		var err error
		folderID, err = ensureBaknusFormFolder(authHeader)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyiapkan folder Drive"})
			return
		}
		// Save folder_id back
		form.FolderID = &folderID
		DB.Save(&form)
	}

	// 3. Parse questions
	var questions []map[string]interface{}
	json.Unmarshal([]byte(form.Questions), &questions)

	// 4. Fetch responses
	var responses []models.FormResponse
	DB.Where("form_id = ?", id).Order("created_at asc").Find(&responses)

	if len(responses) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "Belum ada respon untuk diekspor"})
		return
	}

	// 5. Build CSV
	csvBuf, err := buildCSV(questions, responses)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat file CSV"})
		return
	}

	// 6. Upload to Drive
	filename := fmt.Sprintf("Respon_%s_%s.csv",
		strings.ReplaceAll(form.Title, " ", "_"),
		time.Now().Format("20060102_150405"),
	)

	if err := uploadCSVToDrive(authHeader, folderID, filename, csvBuf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal upload ke Drive: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  fmt.Sprintf("File '%s' berhasil disimpan ke folder Baknusform di Drive!", filename),
		"filename": filename,
		"folder":   BAKNUSFORM_FOLDER,
	})
}
