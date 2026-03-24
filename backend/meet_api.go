package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"baknusdrive/models"

	"github.com/gin-gonic/gin"
)

// EnsureMeetFolder checks if a "Meet" folder exists for the user; if not, creates it.
func EnsureMeetFolder(user models.User) (*models.Folder, error) {
	var folder models.Folder
	err := DB.Where("name = ? AND user_id = ? AND parent_id IS NULL", "Meet", user.ID).First(&folder).Error
	if err != nil {
		folder = models.Folder{
			Name:   "Meet",
			UserID: user.ID,
		}
		if err := DB.Create(&folder).Error; err != nil {
			return nil, err
		}
		log.Printf("[MeetAPI] Folder 'Meet' created for user: %s", user.Email)
	}
	return &folder, nil
}

// SetupMeetFolders is an API for BaknusMeet to initialize "Meet" folders.
// If an "email" is provided, it sets up only that user.
// If no email is provided, it sets up folders for ALL users with role 'Guru'.
func SetupMeetFolders(c *gin.Context) {
	apiKey := c.GetHeader("X-Meet-API-Key")
	if apiKey != "BAKNUS_MEET_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	var req struct {
		Email string `json:"email"`
	}
	c.ShouldBindJSON(&req)

	if req.Email != "" {
		// Individual setup
		var user models.User
		if err := DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		if _, err := EnsureMeetFolder(user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create folder for " + user.Email})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Meet folder setup successfully for " + user.Email})
		return
	}

	// Bulk setup for all teachers (Guru)
	var teachers []models.User
	if err := DB.Where("role = ?", "Guru").Find(&teachers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve teachers"})
		return
	}

	count := 0
	for _, t := range teachers {
		if _, err := EnsureMeetFolder(t); err == nil {
			count++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Meet folder setup sequence completed",
		"processed": count,
		"total":     len(teachers),
	})
}

// UploadMeetFile is an API for BaknusMeet to upload files (Attendance, links, etc.)
// inside their OWN drive: Meet -> [Files]
func UploadMeetFile(c *gin.Context) {
	apiKey := c.GetHeader("X-Meet-API-Key")
	if apiKey != "BAKNUS_MEET_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	teacherEmail := c.PostForm("email")
	if teacherEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// 1. Retrieve Teacher/User
	var user models.User
	if err := DB.Where("email = ?", teacherEmail).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 2. Ensure "Meet" folder exists
	meetFolder, err := EnsureMeetFolder(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to ensure Meet folder"})
		return
	}

	// 3. Save the File (logic similar to drive.go UploadFile)
	// Check if file already exists in that folder
	var oldFile models.File
	exists := DB.Where("name = ? AND user_id = ? AND folder_id = ?", fileHeader.Filename, user.ID, meetFolder.ID).First(&oldFile).Error == nil

	// Check Quota
	var totalUsed int64
	DB.Model(&models.File{}).Where("user_id = ?", user.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalUsed)
	sizeDiff := fileHeader.Size
	if exists {
		sizeDiff -= oldFile.Size
	}
	if totalUsed+sizeDiff > user.Quota {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Storage quota exceeded"})
		return
	}

	// Save file path logic
	userStoragePath := filepath.Join("storage", user.ID)
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
		oldFile.IsPublic = true
		if err := DB.Save(&oldFile).Error; err != nil {
			os.Remove(savePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update file metadata"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "File updated successfully in Meet folder", "file": oldFile})
	} else {
		newFile := models.File{
			Name:     fileHeader.Filename,
			MimeType: mimeType,
			Size:     fileHeader.Size,
			Path:     savePath,
			FolderID: &meetFolder.ID,
			UserID:   user.ID,
			IsPublic: true,
		}
		if err := DB.Create(&newFile).Error; err != nil {
			os.Remove(savePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file metadata"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "File uploaded successfully to Meet folder", "file": newFile})
	}

	// Update user used space
	DB.Model(&user).Update("used_space", totalUsed+sizeDiff)
}
