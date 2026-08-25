package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"baknusdrive/models"

	"github.com/gin-gonic/gin"
)

const ExpectedBackupAPIKey = "baknus_secret_dashboard_key_2026"

// helper: generate random hex string
func generateRandomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// verifyBackupAPIKeyAndUser checks X-API-KEY header / api_key query and verifies user existence
func verifyBackupAPIKeyAndUser(c *gin.Context, rawEmail string) (*models.User, bool) {
	apiKey := c.GetHeader("X-API-KEY")
	if apiKey == "" {
		apiKey = c.GetHeader("X-API-Key")
	}
	if apiKey == "" {
		apiKey = c.Query("api_key")
	}

	if apiKey != ExpectedBackupAPIKey {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Unauthorized: Invalid or missing API Key",
		})
		return nil, false
	}

	email := strings.TrimSpace(rawEmail)
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Parameter 'email' is required",
		})
		return nil, false
	}

	var user models.User
	if err := DB.Where("email = ? OR id = ?", email, email).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": fmt.Sprintf("User with email '%s' not found", email),
		})
		return nil, false
	}

	return &user, true
}

// updateCalculatedUserSpace recalculates total space used by user across files and backups
func updateCalculatedUserSpace(user *models.User) {
	var totalFiles int64
	DB.Model(&models.File{}).Where("user_id = ?", user.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalFiles)

	var totalBackups int64
	DB.Model(&models.ChatBackup{}).Where("user_id = ?", user.ID).Select("COALESCE(SUM(file_size), 0)").Scan(&totalBackups)

	usedSpace := totalFiles + totalBackups
	DB.Model(user).Update("used_space", usedSpace)
}

// UploadBackupChat (POST /api/backup/upload)
func UploadBackupChat(c *gin.Context) {
	email := strings.TrimSpace(c.PostForm("email"))
	if email == "" {
		email = strings.TrimSpace(c.Query("email"))
	}

	user, ok := verifyBackupAPIKeyAndUser(c, email)
	if !ok {
		return
	}

	fileHeader, err := c.FormFile("backup_file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "File backup ('backup_file') is required",
		})
		return
	}

	// Read file_size parameter if provided, otherwise use fileHeader.Size
	fileSize := fileHeader.Size
	if sizeParam := c.PostForm("file_size"); sizeParam != "" {
		if parsedSize, parseErr := strconv.ParseInt(sizeParam, 10, 64); parseErr == nil && parsedSize > 0 {
			fileSize = parsedSize
		}
	}

	// 1. Check storage quota
	var totalFiles int64
	DB.Model(&models.File{}).Where("user_id = ?", user.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalFiles)

	var totalBackups int64
	DB.Model(&models.ChatBackup{}).Where("user_id = ?", user.ID).Select("COALESCE(SUM(file_size), 0)").Scan(&totalBackups)

	currentUsed := totalFiles + totalBackups
	if currentUsed+fileSize > user.Quota {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Storage quota exceeded",
		})
		return
	}

	// 2. Prepare user storage folder /storage/backups/{user_email}/
	backupDir := filepath.Join("storage", "backups", user.Email)
	if err := os.MkdirAll(backupDir, os.ModePerm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create backup storage directory: " + err.Error(),
		})
		return
	}

	timestamp := time.Now().Unix()
	backupID := fmt.Sprintf("bkp_%d_%s", timestamp, generateRandomHex(4))

	origFilename := filepath.Base(fileHeader.Filename)
	if origFilename == "" || origFilename == "." {
		origFilename = fmt.Sprintf("baknuschat_backup_%s.json", time.Now().Format("20060102_150405"))
	}
	diskFilename := fmt.Sprintf("%s_%s", backupID, origFilename)
	savePath := filepath.Join(backupDir, diskFilename)

	if err := c.SaveUploadedFile(fileHeader, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to save backup file to disk: " + err.Error(),
		})
		return
	}

	backupType := strings.TrimSpace(c.PostForm("backup_type"))
	if backupType == "" {
		backupType = "auto"
	}

	messageCount := 0
	if msgCountParam := c.PostForm("message_count"); msgCountParam != "" {
		if parsedCount, parseErr := strconv.Atoi(msgCountParam); parseErr == nil {
			messageCount = parsedCount
		}
	}

	// 3. Create record in database
	newBackup := models.ChatBackup{
		ID:           backupID,
		UserID:       user.ID,
		Filename:     origFilename,
		FilePath:     savePath,
		FileSize:     fileSize,
		BackupType:   backupType,
		MessageCount: messageCount,
		CreatedAt:    time.Now(),
	}

	if err := DB.Create(&newBackup).Error; err != nil {
		os.Remove(savePath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create backup database record: " + err.Error(),
		})
		return
	}

	// 4. Enforce max 3 latest backups per user
	var userBackups []models.ChatBackup
	DB.Where("user_id = ?", user.ID).Order("created_at desc").Find(&userBackups)

	if len(userBackups) > 3 {
		for _, oldBkp := range userBackups[3:] {
			os.Remove(oldBkp.FilePath)
			DB.Unscoped().Delete(&oldBkp)
			log.Printf("[BackupAPI] Auto-deleted old backup '%s' for user '%s'", oldBkp.ID, user.Email)
		}
	}

	// 5. Update user used space
	updateCalculatedUserSpace(user)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Backup berhasil disimpan",
		"data": gin.H{
			"backup_id":    newBackup.ID,
			"filename":     newBackup.Filename,
			"file_size":    newBackup.FileSize,
			"created_at":   newBackup.CreatedAt.Format(time.RFC3339),
		},
	})
}

// ListBackupChat (GET /api/backup/list)
func ListBackupChat(c *gin.Context) {
	email := strings.TrimSpace(c.Query("email"))

	user, ok := verifyBackupAPIKeyAndUser(c, email)
	if !ok {
		return
	}

	var backups []models.ChatBackup
	DB.Where("user_id = ?", user.ID).Order("created_at desc").Find(&backups)

	scheme := "https"
	if c.Request.TLS == nil && !strings.Contains(c.Request.Host, "baknusdrive") {
		scheme = "http"
	}
	host := c.Request.Host
	if host == "" {
		host = "baknusdrive.smkbn666.sch.id"
	}

	data := make([]gin.H, 0)
	for _, bkp := range backups {
		downloadURL := fmt.Sprintf("%s://%s/api/backup/download/%s?email=%s", scheme, host, bkp.ID, user.Email)
		data = append(data, gin.H{
			"backup_id":     bkp.ID,
			"filename":      bkp.Filename,
			"file_size":     bkp.FileSize,
			"backup_type":   bkp.BackupType,
			"message_count": bkp.MessageCount,
			"created_at":    bkp.CreatedAt.Format(time.RFC3339),
			"download_url":  downloadURL,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}

// DownloadBackupChat (GET /api/backup/download/:backup_id)
func DownloadBackupChat(c *gin.Context) {
	email := strings.TrimSpace(c.Query("email"))
	backupID := c.Param("backup_id")

	user, ok := verifyBackupAPIKeyAndUser(c, email)
	if !ok {
		return
	}

	if backupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "backup_id is required",
		})
		return
	}

	var backup models.ChatBackup
	if err := DB.Where("id = ? AND user_id = ?", backupID, user.ID).First(&backup).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "File backup tidak ditemukan",
		})
		return
	}

	if _, err := os.Stat(backup.FilePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "File backup fisik tidak ditemukan di server",
		})
		return
	}

	c.FileAttachment(backup.FilePath, backup.Filename)
}

// DeleteBackupChat (DELETE /api/backup/:backup_id)
func DeleteBackupChat(c *gin.Context) {
	email := strings.TrimSpace(c.Query("email"))
	if email == "" {
		email = strings.TrimSpace(c.PostForm("email"))
	}
	backupID := c.Param("backup_id")

	user, ok := verifyBackupAPIKeyAndUser(c, email)
	if !ok {
		return
	}

	if backupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "backup_id is required",
		})
		return
	}

	var backup models.ChatBackup
	if err := DB.Where("id = ? AND user_id = ?", backupID, user.ID).First(&backup).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "File backup tidak ditemukan",
		})
		return
	}

	os.Remove(backup.FilePath)
	DB.Unscoped().Delete(&backup)

	updateCalculatedUserSpace(user)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "File backup berhasil dihapus",
	})
}
