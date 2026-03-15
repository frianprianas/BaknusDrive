package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"baknusdrive/models"

	"github.com/gin-gonic/gin"
)

// EnsureClassRoot ensures the "Ujian" root folder exists for the Admin
func EnsureClassRoot(adminUser models.User) (*models.Folder, error) {
	var rootFolder models.Folder
	err := DB.Where("name = ? AND user_id = ? AND parent_id IS NULL", "Ujian", adminUser.ID).First(&rootFolder).Error
	if err != nil {
		rootFolder = models.Folder{
			Name:   "Ujian",
			UserID: adminUser.ID,
		}
		if err := DB.Create(&rootFolder).Error; err != nil {
			return nil, err
		}

		// Share the root folder to GURU and TU so it appears in their Dashboards
		roles := []string{"ROLE:GURU", "ROLE:TU"}
		for _, role := range roles {
			newShare := models.Share{
				FolderID:   &rootFolder.ID,
				SharedBy:   adminUser.ID,
				SharedWith: role,
			}
			DB.Create(&newShare)
		}
	}
	return &rootFolder, nil
}

// CreateClassEvent is an API for Admin to create an exam event
// and automatically share it with Guru and TU roles.
func CreateClassEvent(c *gin.Context) {
	apiKey := c.GetHeader("X-Class-API-Key")
	if apiKey != "BAKNUS_CLASS_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	var req struct {
		EventName string `json:"event_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event_name is required"})
		return
	}

	// Retrieve Admin user (the owner of the exam folders)
	var adminUser models.User
	if err := DB.Where("role = ?", "Admin").First(&adminUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Admin user not found"})
		return
	}

	rootFolder, err := EnsureClassRoot(adminUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to ensure root Ujian folder"})
		return
	}

	// Create Event Folder
	var eventFolder models.Folder
	err = DB.Where("name = ? AND user_id = ? AND parent_id = ?", req.EventName, adminUser.ID, rootFolder.ID).First(&eventFolder).Error
	if err != nil {
		eventFolder = models.Folder{
			Name:     req.EventName,
			UserID:   adminUser.ID,
			ParentID: &rootFolder.ID,
		}
		if err := DB.Create(&eventFolder).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create event folder"})
			return
		}

		// Automatically share with GURU and TU
		roles := []string{"ROLE:GURU", "ROLE:TU"}
		for _, role := range roles {
			newShare := models.Share{
				FolderID:   &eventFolder.ID,
				SharedBy:   adminUser.ID,
				SharedWith: role,
			}
			DB.Create(&newShare)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Event folder created and shared successfully",
		"folder_id": eventFolder.ID,
		"shared_to": []string{"GURU", "TU"},
	})
}

// CreateClassSubject is an API for Guru to create a subject folder within an event
func CreateClassSubject(c *gin.Context) {
	apiKey := c.GetHeader("X-Class-API-Key")
	if apiKey != "BAKNUS_CLASS_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	var req struct {
		EventName   string `json:"event_name" binding:"required"`
		SubjectName string `json:"subject_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event_name and subject_name are required"})
		return
	}

	// Retrieve Admin user
	var adminUser models.User
	if err := DB.Where("role = ?", "Admin").First(&adminUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Admin user not found"})
		return
	}

	rootFolder, err := EnsureClassRoot(adminUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to ensure root Ujian folder"})
		return
	}

	// 1. Find the Event Folder
	var eventFolder models.Folder
	if err := DB.Where("name = ? AND parent_id = ?", req.EventName, rootFolder.ID).First(&eventFolder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Event folder not found"})
		return
	}

	// 2. Create Subject Folder
	var subjectFolder models.Folder
	err = DB.Where("name = ? AND parent_id = ?", req.SubjectName, eventFolder.ID).First(&subjectFolder).Error
	if err != nil {
		subjectFolder = models.Folder{
			Name:     req.SubjectName,
			UserID:   adminUser.ID,
			ParentID: &eventFolder.ID,
		}
		if err := DB.Create(&subjectFolder).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subject folder"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Subject folder created successfully",
		"folder_id": subjectFolder.ID,
	})
}

// UploadClassSoal is an API for Guru (via BaknusClass) to upload questions
// inside Ujian -> [Event] -> [Mata Pelajaran]
func UploadClassSoal(c *gin.Context) {
	apiKey := c.GetHeader("X-Class-API-Key")
	if apiKey != "BAKNUS_CLASS_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	eventName := c.PostForm("event_name")
	subjectName := c.PostForm("subject_name")
	if eventName == "" || subjectName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event_name and subject_name are required"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Retrieve Admin user
	var adminUser models.User
	if err := DB.Where("role = ?", "Admin").First(&adminUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Admin user not found"})
		return
	}

	rootFolder, err := EnsureClassRoot(adminUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to ensure root Ujian folder"})
		return
	}

	// 1. Find the Event Folder
	var eventFolder models.Folder
	if err := DB.Where("name = ? AND parent_id = ?", eventName, rootFolder.ID).First(&eventFolder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Event folder not found. Please create event first."})
		return
	}

	// 2. Find/Create Subject Folder
	var subjectFolder models.Folder
	err = DB.Where("name = ? AND parent_id = ?", subjectName, eventFolder.ID).First(&subjectFolder).Error
	if err != nil {
		subjectFolder = models.Folder{
			Name:     subjectName,
			ParentID: &eventFolder.ID,
			UserID:   adminUser.ID,
		}
		if err := DB.Create(&subjectFolder).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subject folder"})
			return
		}
	}

	// 3. Save the File
	var oldFile models.File
	exists := DB.Where("name = ? AND folder_id = ?", fileHeader.Filename, subjectFolder.ID).First(&oldFile).Error == nil

	// Check Quota
	var totalUsed int64
	DB.Model(&models.File{}).Where("user_id = ?", adminUser.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalUsed)
	sizeDiff := fileHeader.Size
	if exists {
		sizeDiff -= oldFile.Size
	}
	if totalUsed+sizeDiff > adminUser.Quota {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Admin storage quota exceeded"})
		return
	}

	// Path logic
	userStoragePath := filepath.Join("storage", adminUser.ID)
	os.MkdirAll(userStoragePath, os.ModePerm)

	safeFilename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), fileHeader.Filename)
	savePath := filepath.Join(userStoragePath, safeFilename)

	if err := c.SaveUploadedFile(fileHeader, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	if exists {
		os.Remove(oldFile.Path)
		oldFile.Size = fileHeader.Size
		oldFile.Path = savePath
		oldFile.MimeType = mimeType
		if err := DB.Save(&oldFile).Error; err != nil {
			os.Remove(savePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update file metadata"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Soal updated successfully", "file": oldFile})
	} else {
		newFile := models.File{
			Name:     fileHeader.Filename,
			MimeType: mimeType,
			Size:     fileHeader.Size,
			Path:     savePath,
			FolderID: &subjectFolder.ID,
			UserID:   adminUser.ID,
		}
		if err := DB.Create(&newFile).Error; err != nil {
			os.Remove(savePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file metadata"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Soal uploaded successfully", "file": newFile})
	}

	// Update admin used space
	DB.Model(&adminUser).Update("used_space", totalUsed+sizeDiff)
}

// UploadClassMateri is an API for Guru (via BaknusClass) to upload teaching materials
// inside their OWN drive: Materi -> [Mata Pelajaran] -> [Files]
// Default: NO SHARING.
func UploadClassMateri(c *gin.Context) {
	apiKey := c.GetHeader("X-Class-API-Key")
	if apiKey != "BAKNUS_CLASS_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	teacherEmail := c.PostForm("teacher_email")
	subjectName := c.PostForm("subject_name")
	if teacherEmail == "" || subjectName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "teacher_email and subject_name are required"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// 1. Retrieve Teacher/User
	var teacherUser models.User
	if err := DB.Where("email = ?", teacherEmail).First(&teacherUser).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Teacher user not found with that email"})
		return
	}

	// 2. Ensure "Materi" root folder for this teacher
	var materiRoot models.Folder
	if err := DB.Where("name = ? AND user_id = ? AND parent_id IS NULL", "Materi", teacherUser.ID).First(&materiRoot).Error; err != nil {
		materiRoot = models.Folder{
			Name:   "Materi",
			UserID: teacherUser.ID,
		}
		if err := DB.Create(&materiRoot).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Materi root folder"})
			return
		}
	}

	// 3. Ensure Subject folder inside Materi
	var subjectFolder models.Folder
	if err := DB.Where("name = ? AND user_id = ? AND parent_id = ?", subjectName, teacherUser.ID, materiRoot.ID).First(&subjectFolder).Error; err != nil {
		subjectFolder = models.Folder{
			Name:     subjectName,
			UserID:   teacherUser.ID,
			ParentID: &materiRoot.ID,
		}
		if err := DB.Create(&subjectFolder).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subject folder"})
			return
		}
	}

	// 4. Save the File
	var oldFile models.File
	exists := DB.Where("name = ? AND user_id = ? AND folder_id = ?", fileHeader.Filename, teacherUser.ID, subjectFolder.ID).First(&oldFile).Error == nil

	// Check Quota
	var totalUsed int64
	DB.Model(&models.File{}).Where("user_id = ?", teacherUser.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalUsed)
	sizeDiff := fileHeader.Size
	if exists {
		sizeDiff -= oldFile.Size
	}
	if totalUsed+sizeDiff > teacherUser.Quota {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Teacher storage quota exceeded"})
		return
	}

	// Path logic
	userStoragePath := filepath.Join("storage", teacherUser.ID)
	os.MkdirAll(userStoragePath, os.ModePerm)

	safeFilename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), fileHeader.Filename)
	savePath := filepath.Join(userStoragePath, safeFilename)

	if err := c.SaveUploadedFile(fileHeader, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	if exists {
		os.Remove(oldFile.Path)
		oldFile.Size = fileHeader.Size
		oldFile.Path = savePath
		oldFile.MimeType = mimeType
		if err := DB.Save(&oldFile).Error; err != nil {
			os.Remove(savePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update file metadata"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Materi updated successfully", "file": oldFile})
	} else {
		newFile := models.File{
			Name:     fileHeader.Filename,
			MimeType: mimeType,
			Size:     fileHeader.Size,
			Path:     savePath,
			FolderID: &subjectFolder.ID,
			UserID:   teacherUser.ID,
		}
		if err := DB.Create(&newFile).Error; err != nil {
			os.Remove(savePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file metadata"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Materi uploaded successfully", "file": newFile})
	}

	// Update teacher used space
	DB.Model(&teacherUser).Update("used_space", totalUsed+sizeDiff)
}
