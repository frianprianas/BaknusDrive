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

func EnsureSuratFolders(adminUser models.User) (*models.Folder, *models.Folder, error) {
	// Parent Folder: "Surat"
	var suratFolder models.Folder
	err := DB.Where("name = ? AND user_id = ? AND parent_id IS NULL", "Surat", adminUser.ID).First(&suratFolder).Error
	if err != nil {
		suratFolder = models.Folder{
			Name:   "Surat",
			UserID: adminUser.ID,
		}
		if err := DB.Create(&suratFolder).Error; err != nil {
			return nil, nil, err
		}
	}

	// Always ensure sharing to TU exists for this folder
	var share models.Share
	if err := DB.Where("folder_id = ? AND shared_with = ?", suratFolder.ID, "ROLE:TU").First(&share).Error; err != nil {
		newShare := models.Share{
			FolderID:   &suratFolder.ID,
			SharedBy:   adminUser.ID,
			SharedWith: "ROLE:TU",
		}
		DB.Create(&newShare)
	}

	// Subfolder "Surat Masuk"
	var masukFolder models.Folder
	if err := DB.Where("name = ? AND user_id = ? AND parent_id = ?", "Surat Masuk", adminUser.ID, suratFolder.ID).First(&masukFolder).Error; err != nil {
		masukFolder = models.Folder{
			Name:     "Surat Masuk",
			ParentID: &suratFolder.ID,
			UserID:   adminUser.ID,
		}
		DB.Create(&masukFolder)
	}

	// Subfolder "Surat Keluar"
	var keluarFolder models.Folder
	if err := DB.Where("name = ? AND user_id = ? AND parent_id = ?", "Surat Keluar", adminUser.ID, suratFolder.ID).First(&keluarFolder).Error; err != nil {
		keluarFolder = models.Folder{
			Name:     "Surat Keluar",
			ParentID: &suratFolder.ID,
			UserID:   adminUser.ID,
		}
		DB.Create(&keluarFolder)
	}

	return &masukFolder, &keluarFolder, nil
}

// UploadSurat is a dedicated endpoint for the Surat application (C# / Vite)
// to automatically upload incoming/outgoing mails into the Admin's Drive,
// inside "Surat/Surat Masuk" or "Surat/Surat Keluar" and automatically shared to TU.
func UploadSurat(c *gin.Context) {
	// Simple authentication with static API Key
	apiKey := c.GetHeader("X-Surat-API-Key")
	if apiKey != "BAKNUS_SURAT_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	// Retrieve Admin user
	var adminUser models.User
	if err := DB.Where("role = ?", "Admin").First(&adminUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Admin user not found in system"})
		return
	}

	suratType := c.PostForm("type") // "masuk" or "keluar"
	if suratType != "masuk" && suratType != "keluar" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be 'masuk' or 'keluar'"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded (form field 'file' is missing)"})
		return
	}

	masukFolder, keluarFolder, err := EnsureSuratFolders(adminUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create/ensure folder structure"})
		return
	}

	var targetFolder *models.Folder
	if suratType == "masuk" {
		targetFolder = masukFolder
	} else {
		targetFolder = keluarFolder
	}

	// Overwrite logic if file with same name exists in same target
	var oldFile models.File
	exists := DB.Where("name = ? AND user_id = ? AND folder_id = ?", fileHeader.Filename, adminUser.ID, targetFolder.ID).First(&oldFile).Error == nil

	// Check Quota
	var totalSize int64
	DB.Model(&models.File{}).Where("user_id = ?", adminUser.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)
	sizeDiff := fileHeader.Size
	if exists {
		sizeDiff -= oldFile.Size
	}
	if totalSize+sizeDiff > adminUser.Quota {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Admin storage quota exceeded"})
		return
	}

	// Physical directory
	userStoragePath := filepath.Join("storage", adminUser.ID)
	os.MkdirAll(userStoragePath, os.ModePerm)

	safeFilename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), fileHeader.Filename)
	savePath := filepath.Join(userStoragePath, safeFilename)

	if err := c.SaveUploadedFile(fileHeader, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save the file"})
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
		DB.Model(&adminUser).Update("used_space", totalSize+sizeDiff)
		c.JSON(http.StatusOK, gin.H{"message": "File updated successfully", "file": oldFile, "folder_id": targetFolder.ID})
	} else {
		newFile := models.File{
			Name:     fileHeader.Filename,
			MimeType: mimeType,
			Size:     fileHeader.Size,
			Path:     savePath,
			FolderID: &targetFolder.ID,
			UserID:   adminUser.ID,
		}
		if err := DB.Create(&newFile).Error; err != nil {
			os.Remove(savePath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file metadata"})
			return
		}
		DB.Model(&adminUser).Update("used_space", totalSize+fileHeader.Size)
		c.JSON(http.StatusOK, gin.H{"message": "File uploaded successfully", "file": newFile, "folder_id": targetFolder.ID})
	}
}
