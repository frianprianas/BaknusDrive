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
var INTERNAL_SYSTEM_TOKEN = os.Getenv("INTERNAL_SYSTEM_TOKEN")

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
func ensureBaknusFormFolder(authHeader string, targetUser string) (uint, error) {
	req, _ := http.NewRequest("GET", BACKEND_URL+"/api/drive", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	} else if INTERNAL_SYSTEM_TOKEN != "" && targetUser != "" {
		req.Header.Set("X-Internal-Token", INTERNAL_SYSTEM_TOKEN)
		req.Header.Set("X-User-Email", targetUser)
	} else {
		return 0, fmt.Errorf("no credentials provided")
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("gagal hubungi backend: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("backend mengembalikan status %d", resp.StatusCode)
	}

	var driveData struct {
		Folders []struct {
			ID   uint   `json:"id"`
			Name string `json:"name"`
		} `json:"folders"`
	}
	json.Unmarshal(bodyBytes, &driveData)

	for _, f := range driveData.Folders {
		if strings.EqualFold(f.Name, BAKNUSFORM_FOLDER) {
			return f.ID, nil
		}
	}

	// Create
	createPayload, _ := json.Marshal(map[string]interface{}{"name": BAKNUSFORM_FOLDER})
	createReq, _ := http.NewRequest("POST", BACKEND_URL+"/api/drive/folder", bytes.NewReader(createPayload))
	if authHeader != "" {
		createReq.Header.Set("Authorization", authHeader)
	} else {
		createReq.Header.Set("X-Internal-Token", INTERNAL_SYSTEM_TOKEN)
		createReq.Header.Set("X-User-Email", targetUser)
	}
	createReq.Header.Set("Content-Type", "application/json")

	createResp, err := client.Do(createReq)
	if err != nil {
		return 0, err
	}
	defer createResp.Body.Close()

	cRespBytes, _ := io.ReadAll(createResp.Body)
	var folder struct {
		ID uint `json:"id"`
	}
	json.Unmarshal(cRespBytes, &folder)

	return folder.ID, nil
}

// uploadCSVToDrive uploads a CSV buffer to the Drive.
func uploadCSVToDrive(authHeader string, targetUser string, folderID uint, filename string, csvBuf *bytes.Buffer) error {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("folder_id", fmt.Sprintf("%d", folderID))
	part, _ := writer.CreateFormFile("file", filename)
	io.Copy(part, csvBuf)
	writer.Close()

	req, _ := http.NewRequest("POST", BACKEND_URL+"/api/drive/upload", body)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	} else {
		req.Header.Set("X-Internal-Token", INTERNAL_SYSTEM_TOKEN)
		req.Header.Set("X-User-Email", targetUser)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("upload gagal: %s", string(b))
	}
	return nil
}

// performCSVExportInternal is the core logic.
func performCSVExportInternal(authHeader string, targetUser string, form models.Form) error {
	folderID := uint(0)
	if form.FolderID != nil {
		folderID = *form.FolderID
	}
	if folderID == 0 {
		var err error
		folderID, err = ensureBaknusFormFolder(authHeader, targetUser)
		if err != nil {
			return err
		}
		form.FolderID = &folderID
		DB.Save(&form)
	}

	var questions []map[string]interface{}
	json.Unmarshal([]byte(form.Questions), &questions)

	var responses []models.FormResponse
	DB.Where("form_id = ?", form.ID).Order("created_at asc").Find(&responses)

	csvBuf, err := buildCSV(questions, responses)
	if err != nil {
		return err
	}

	filename := fmt.Sprintf("Respon_%s.csv", form.Title)
	return uploadCSVToDrive(authHeader, targetUser, folderID, filename, csvBuf)
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
	// Always sync to the Form Creator's Drive using System Token for background update
	if form.FolderID != nil && *form.FolderID > 0 {
		go func(f models.Form) {
			log.Printf("[SubmitFormResponse] Background auto-export for form: %s by System (TargetUser: %s)", f.ID, f.CreatorID)
			// We pass empty authHeader but provide f.CreatorID as targetUser to trigger System Token logic
			if err := performCSVExportInternal("", f.CreatorID, f); err != nil {
				log.Printf("[SubmitFormResponse] Warning: Background auto-export failed: %v", err)
			} else {
				log.Printf("[SubmitFormResponse] Success: Auto-export completed for form: %s", f.ID)
			}
		}(form)
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
	folderID, err := ensureBaknusFormFolder(authHeader, userID)
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
			if err := performCSVExportInternal(ah, f.CreatorID, f); err != nil {
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
	if err := performCSVExportInternal(authHeader, userID, form); err != nil {
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
