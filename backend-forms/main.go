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
	"os"
	"strings"
	"time"

	"baknus-forms/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

var BACKEND_URL = "http://backend:8080"

const BAKNUSFORM_FOLDER = "Baknusform"

func main() {
	InitDB()
	InitRedis()

	if envURL := os.Getenv("BACKEND_URL"); envURL != "" {
		BACKEND_URL = envURL
	}
	log.Printf("[Main] Using BACKEND_URL: %s", BACKEND_URL)

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOriginFunc:  func(origin string) bool { return true },
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
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
	// 1. Try listing root folders to find "Baknusform" (no parent_id = root)
	req, _ := http.NewRequest("GET", BACKEND_URL+"/api/drive", nil)
	log.Printf("[ensureBaknusFormFolder] Checking root drive for user...")
	req.Header.Set("Authorization", authHeader)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[ensureBaknusFormFolder] ERROR connecting to backend: %v", err)
		return 0, fmt.Errorf("gagal hubungi backend: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Printf("[ensureBaknusFormFolder] ERROR: Backend returned %d. Response: %s", resp.StatusCode, string(bodyBytes))
		return 0, fmt.Errorf("backend mengembalikan status %d", resp.StatusCode)
	}

	var driveData struct {
		Folders []struct {
			ID   uint   `json:"id"`
			Name string `json:"name"`
		} `json:"folders"`
	}
	if err := json.Unmarshal(bodyBytes, &driveData); err != nil {
		log.Printf("[ensureBaknusFormFolder] ERROR decoding drive data: %v. Body was: %s", err, string(bodyBytes))
		return 0, fmt.Errorf("gagal decode data drive: %v", err)
	}

	// Check if already exists in the list (root folder)
	for _, f := range driveData.Folders {
		if strings.EqualFold(f.Name, BAKNUSFORM_FOLDER) {
			log.Printf("[ensureBaknusFormFolder] Found existing folder '%s' with ID %d", BAKNUSFORM_FOLDER, f.ID)
			return f.ID, nil
		}
	}

	log.Printf("[ensureBaknusFormFolder] Folder '%s' not found in root. Creating a new one...", BAKNUSFORM_FOLDER)

	// 2. Create the folder if not found
	createPayload, _ := json.Marshal(map[string]interface{}{"name": BAKNUSFORM_FOLDER})
	createReq, _ := http.NewRequest("POST", BACKEND_URL+"/api/drive/folder", bytes.NewReader(createPayload))
	createReq.Header.Set("Authorization", authHeader)
	createReq.Header.Set("Content-Type", "application/json")

	createResp, err := client.Do(createReq)
	if err != nil {
		log.Printf("[ensureBaknusFormFolder] ERROR creating folder: %v", err)
		return 0, fmt.Errorf("gagal membuat folder: %v", err)
	}
	defer createResp.Body.Close()

	cRespBytes, _ := io.ReadAll(createResp.Body)
	if createResp.StatusCode >= 400 {
		log.Printf("[ensureBaknusFormFolder] ERROR creating folder (%d): %s", createResp.StatusCode, string(cRespBytes))
		return 0, fmt.Errorf("gagal buat folder (%d): %s", createResp.StatusCode, string(cRespBytes))
	}

	var folder struct {
		ID uint `json:"id"`
	}
	if err := json.Unmarshal(cRespBytes, &folder); err != nil {
		log.Printf("[ensureBaknusFormFolder] ERROR decoding new folder ID: %v. Body was: %s", err, string(cRespBytes))
		return 0, err
	}

	if folder.ID == 0 {
		return 0, fmt.Errorf("folder ID tidak valid setelah dibuat")
	}
	log.Printf("[ensureBaknusFormFolder] SUCCESS: Created folder '%s'. ID: %d", BAKNUSFORM_FOLDER, folder.ID)
	return folder.ID, nil
}

// uploadCSVToDrive uploads a CSV buffer to the Drive under folderID.
func uploadCSVToDrive(authHeader string, folderID uint, filename string, csvBuf *bytes.Buffer) error {
	contentSize := csvBuf.Len()
	log.Printf("[uploadCSVToDrive] Starting upload: %s (size: %d) to folderID: %d", filename, contentSize, folderID)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// metadata fields should come before file part
	writer.WriteField("folder_id", fmt.Sprintf("%d", folderID))

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		log.Printf("[uploadCSVToDrive] ERROR creating form file: %v", err)
		return err
	}
	io.Copy(part, csvBuf)
	writer.Close()

	uploadURL := fmt.Sprintf("%s/api/drive/upload", BACKEND_URL)
	req, _ := http.NewRequest("POST", uploadURL, body)
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[uploadCSVToDrive] Network ERROR connecting to backend: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		log.Printf("[uploadCSVToDrive] Backend ERROR %d: %s", resp.StatusCode, string(b))
		return fmt.Errorf("upload gagal (%d): %s", resp.StatusCode, string(b))
	}

	log.Printf("[uploadCSVToDrive] SUCCESS: Uploaded %s", filename)
	return nil
}

// performCSVExportInternal is the core logic shared by CreateForm, SubmitFormResponse, and ExportResponsesToDrive.
func performCSVExportInternal(authHeader string, form models.Form) error {
	// 1. Ensure folderID exists (should already be set in most cases)
	folderID := uint(0)
	if form.FolderID != nil {
		folderID = *form.FolderID
	}
	if folderID == 0 {
		var err error
		folderID, err = ensureBaknusFormFolder(authHeader)
		if err != nil {
			return fmt.Errorf("gagal menyiapkan folder: %v", err)
		}
		// Save folder_id back if we just created it
		form.FolderID = &folderID
		DB.Save(&form)
	}

	// 2. Parse questions
	var questions []map[string]interface{}
	json.Unmarshal([]byte(form.Questions), &questions)

	// 3. Fetch responses
	var responses []models.FormResponse
	DB.Where("form_id = ?", form.ID).Order("created_at asc").Find(&responses)

	// 4. Build CSV
	csvBuf, err := buildCSV(questions, responses)
	if err != nil {
		return fmt.Errorf("gagal membuat CSV: %v", err)
	}

	// 5. Upload to Drive
	filename := fmt.Sprintf("Respon_%s.csv", form.Title)
	if err := uploadCSVToDrive(authHeader, folderID, filename, csvBuf); err != nil {
		return fmt.Errorf("gagal upload: %v", err)
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

	var form models.Form
	if err := DB.Where("id = ? AND is_active = ?", id, true).First(&form).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form tidak ditemukan atau tidak aktif"})
		return
	}

	jsonData, _ := json.Marshal(req.ResponseData)
	respondent := c.GetString("userID")
	if respondent == "" {
		respondent = "Anonim"
	}
	response := models.FormResponse{
		FormID:       id,
		Respondent:   respondent,
		ResponseData: string(jsonData),
	}

	if err := DB.Create(&response).Error; err != nil {
		log.Printf("[SubmitFormResponse] DB Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan jawaban"})
		return
	}

	// NEW: Automatically update CSV in Drive if FolderID exists
	if form.FolderID != nil && *form.FolderID > 0 {
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			go func(f models.Form, ah string) {
				log.Printf("[SubmitFormResponse] Background auto-export for form: %s", f.ID)
				if err := performCSVExportInternal(ah, f); err != nil {
					log.Printf("[SubmitFormResponse] Warning: Background auto-export failed: %v (Submitter might not be owner)", err)
				} else {
					log.Printf("[SubmitFormResponse] Success: Auto-export completed for form: %s", f.ID)
				}
			}(form, authHeader)
		} else {
			log.Printf("[SubmitFormResponse] Skipping auto-export for form %s (Anonymous submission has no auth token)", form.ID)
		}
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
	log.Printf("[CreateForm] Creating form for user: %s, title: %s", userID, req.Title)
	folderID, err := ensureBaknusFormFolder(authHeader)
	if err != nil {
		log.Printf("[CreateForm] Warning: gagal membuat folder Baknusform: %v", err)
		folderID = 0
	} else {
		log.Printf("[CreateForm] Baknusform folder ID: %d", folderID)
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
		log.Printf("[CreateForm] Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat formulir di database"})
		return
	}

	// NEW: Create initial CSV in Drive if folder exists
	if folderID > 0 {
		log.Printf("[CreateForm] Triggering initial CSV upload for form: %s", form.ID)
		go func(f models.Form, ah string) {
			if err := performCSVExportInternal(ah, f); err != nil {
				log.Printf("[CreateForm] Warning: Initial CSV upload failed: %v", err)
			} else {
				log.Printf("[CreateForm] SUCCESS: Initial CSV uploaded for form: %s", f.ID)
			}
		}(form, authHeader)
	} else {
		log.Printf("[CreateForm] Skipping CSV upload: folderID is 0")
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
	log.Printf("[UpdateForm] Request for ID=%s by User=%s", id, userID)

	var form models.Form
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).First(&form).Error; err != nil {
		log.Printf("[UpdateForm] Form not found or unauthorized: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Formulir tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	var req struct {
		Title       string      `json:"title"`
		Description string      `json:"description"`
		Questions   interface{} `json:"questions"`
		IsActive    *bool       `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[UpdateForm] Bad request: %v", err)
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

	if err := DB.Save(&form).Error; err != nil {
		log.Printf("[UpdateForm] Save error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan perubahan ke database"})
		return
	}

	log.Printf("[UpdateForm] SUCCESS: %s updated", id)
	c.JSON(http.StatusOK, form)
}

func DeleteForm(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("userID").(string)
	log.Printf("[DeleteForm] Request for ID=%s by User=%s", id, userID)

	var form models.Form
	if err := DB.Where("id = ? AND creator_id = ?", id, userID).First(&form).Error; err != nil {
		log.Printf("[DeleteForm] Form not found or unauthorized: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Formulir tidak ditemukan atau Anda tidak memiliki akses"})
		return
	}

	tx := DB.Begin()
	// 1. Delete all responses
	if err := tx.Where("form_id = ?", id).Delete(&models.FormResponse{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data respon"})
		return
	}
	// 2. Delete form
	if err := tx.Delete(&form).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus formulir"})
		return
	}
	tx.Commit()

	log.Printf("[DeleteForm] SUCCESS: %s deleted", id)
	c.JSON(http.StatusOK, gin.H{"message": "Formulir dan semua respon berhasil dihapus"})
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

	// 2. Perform export using refactored function
	if err := performCSVExportInternal(authHeader, form); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	filename := fmt.Sprintf("Respon_%s.csv", form.Title)
	c.JSON(http.StatusOK, gin.H{
		"message":  fmt.Sprintf("File '%s' berhasil disimpan ke folder Baknusform di Drive!", filename),
		"filename": filename,
		"folder":   BAKNUSFORM_FOLDER,
	})
}
