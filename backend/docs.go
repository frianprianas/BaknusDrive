package main

import (
	"baknusdrive/models"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func CreateDoc(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	var req struct {
		Name     string `json:"name" binding:"required"`
		Type     string `json:"type" binding:"required"` // docx, xlsx, pptx
		FolderID *uint  `json:"folder_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// Add extension if missing
	if !strings.HasSuffix(strings.ToLower(req.Name), "."+req.Type) {
		req.Name += "." + req.Type
	}

	// Create physical path
	userStoragePath := filepath.Join("storage", userID)
	os.MkdirAll(userStoragePath, os.ModePerm)
	safeFilename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), req.Name)
	savePath := filepath.Join(userStoragePath, safeFilename)

	// Template selection using office_templates.go functions
	var templateBytes []byte
	var err error
	var mimeType string

	switch req.Type {
	case "docx":
		templateBytes, err = CreateEmptyDocx()
		mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case "xlsx":
		templateBytes, err = CreateEmptyXlsx()
		mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case "pptx":
		templateBytes, err = CreateEmptyPptx()
		mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported file type"})
		return
	}

	if err != nil {
		log.Printf("Failed to create template: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare template"})
		return
	}

	err = os.WriteFile(savePath, templateBytes, 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file"})
		return
	}

	fileRecord := models.File{
		Name:     req.Name,
		MimeType: mimeType,
		Size:     int64(len(templateBytes)),
		Path:     savePath,
		FolderID: req.FolderID,
		UserID:   userID,
	}

	if err := DB.Create(&fileRecord).Error; err != nil {
		os.Remove(savePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file metadata"})
		return
	}

	c.JSON(http.StatusOK, fileRecord)
}

// WopiCheckFileInfo provides file metadata for Collabora Online.
func WopiCheckFileInfo(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		log.Printf("[WOPI] File not found %d", fileID)
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	var user models.User
	DB.Where("id = ?", file.UserID).First(&user)

	info, err := os.Stat(file.Path)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physical file missing"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"BaseFileName":            file.Name,
		"OwnerId":                 file.UserID,
		"Size":                    info.Size(),
		"UserId":                  file.UserID,
		"Version":                 fmt.Sprintf("%d", file.UpdatedAt.Unix()),
		"UserFriendlyName":        user.FullName,
		"UserCanWrite":            true,
		"SupportsUpdate":          true,
		"UserCanNotWriteRelative": true,
	})
}

// WopiGetFile provides file content for Collabora Online.
func WopiGetFile(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	fileBytes, err := os.ReadFile(file.Path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot read file"})
		return
	}

	c.Data(http.StatusOK, "application/octet-stream", fileBytes)
}

// WopiPutFile receives updated file content from Collabora Online.
func WopiPutFile(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read body"})
		return
	}
	defer c.Request.Body.Close()

	if len(bodyBytes) > 0 {
		err = os.WriteFile(file.Path, bodyBytes, 0644)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot save file"})
			return
		}
		file.Size = int64(len(bodyBytes))
		file.UpdatedAt = time.Now()
		DB.Save(&file)
	}

	c.Status(http.StatusOK)
}

func WopiRouter(r *gin.Engine) {
	wopi := r.Group("/wopi")
	wopi.GET("/files/:file_id", WopiCheckFileInfo)
	wopi.GET("/files/:file_id/contents", WopiGetFile)
	wopi.POST("/files/:file_id/contents", WopiPutFile)
}
