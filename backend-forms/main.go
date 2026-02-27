package main

import (
	"encoding/json"
	"log"
	"net/http"

	"baknus-forms/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
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
