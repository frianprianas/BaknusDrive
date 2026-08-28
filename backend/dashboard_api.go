package main

import (
	"database/sql"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"baknusdrive/models"

	"github.com/gin-gonic/gin"
)

func GetDriveDashboardStats(c *gin.Context) {
	apiKey := c.GetHeader("X-API-Key")
	if apiKey == "" {
		apiKey = c.Query("api_key")
	}

	expectedKey := "baknus_secret_dashboard_key_2026"
	if keyFromEnv := os.Getenv("DASHBOARD_API_KEY"); keyFromEnv != "" {
		expectedKey = keyFromEnv
	}

	if apiKey != expectedKey {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Query last login from users table
	var lastLoginNull sql.NullTime
	DB.Table("users").Select("MAX(last_login)").Scan(&lastLoginNull)
	var lastLogin *time.Time
	if lastLoginNull.Valid {
		lastLogin = &lastLoginNull.Time
	}

	// Query last file activity (Created or Updated) from files table
	var lastFileActivityNull sql.NullTime
	DB.Table("files").Select("MAX(updated_at)").Scan(&lastFileActivityNull)
	var lastFileActivity *time.Time
	if lastFileActivityNull.Valid {
		lastFileActivity = &lastFileActivityNull.Time
	}

	// Get total stats
	var totalFiles int64
	DB.Table("files").Count(&totalFiles)

	var totalUsers int64
	DB.Table("users").Count(&totalUsers)

	// Formulate response
	var lastActive *time.Time
	if lastLogin != nil && lastFileActivity != nil {
		if lastLogin.After(*lastFileActivity) {
			lastActive = lastLogin
		} else {
			lastActive = lastFileActivity
		}
	} else if lastLogin != nil {
		lastActive = lastLogin
	} else if lastFileActivity != nil {
		lastActive = lastFileActivity
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"status":  "success",
		"data": gin.H{
			"last_login":         lastLogin,
			"last_file_activity": lastFileActivity,
			"last_active":        lastActive,
			"total_files":        totalFiles,
			"total_users":        totalUsers,
		},
	})
}

func GetDriveUserStats(c *gin.Context) {
	apiKey := c.GetHeader("X-API-Key")
	if apiKey == "" {
		apiKey = c.Query("api_key")
	}

	expectedKey := "baknus_secret_dashboard_key_2026"
	if keyFromEnv := os.Getenv("DASHBOARD_API_KEY"); keyFromEnv != "" {
		expectedKey = keyFromEnv
	}

	if apiKey != expectedKey {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	email := c.Query("email")
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email parameter is required"})
		return
	}

	var user models.User
	if err := DB.Where("email = ? OR id = ?", email, email).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Query last file activity (Created or Updated) from files table for this user
	var lastFileActivityNull sql.NullTime
	DB.Table("files").Where("user_id = ?", user.ID).Select("MAX(updated_at)").Scan(&lastFileActivityNull)
	var lastFileActivity *time.Time
	if lastFileActivityNull.Valid {
		lastFileActivity = &lastFileActivityNull.Time
	}

	// Determine overall last accessed
	var lastAccessed *time.Time
	if user.LastLogin != nil && lastFileActivity != nil {
		if user.LastLogin.After(*lastFileActivity) {
			lastAccessed = user.LastLogin
		} else {
			lastAccessed = lastFileActivity
		}
	} else if user.LastLogin != nil {
		lastAccessed = user.LastLogin
	} else if lastFileActivity != nil {
		lastAccessed = lastFileActivity
	}

	// Double check used space from the actual files size
	var totalSize int64
	DB.Model(&models.File{}).Where("user_id = ?", user.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

	// Update cached used space
	DB.Model(&user).Update("used_space", totalSize)

	availableBytes := user.Quota - totalSize
	if availableBytes < 0 {
		availableBytes = 0
	}

	var percentageUsed float64
	if user.Quota > 0 {
		percentageUsed = math.Round((float64(totalSize)/float64(user.Quota))*100) / 100
	}

	// Fetch top 5 largest files for this user
	var largestFiles []models.File
	DB.Where("user_id = ?", user.ID).Order("size DESC").Limit(5).Find(&largestFiles)

	largestFilesResponse := []gin.H{}
	for _, f := range largestFiles {
		fileIDStr := fmt.Sprintf("file_%d", f.ID)
		fileType := determineFileType(f.MimeType, f.Name)
		filePath := buildFilePath(f)
		downloadURL := fmt.Sprintf("https://baknusdrive.smkbn666.sch.id/f/%s", fileIDStr)

		largestFilesResponse = append(largestFilesResponse, gin.H{
			"file_id":      fileIDStr,
			"filename":     f.Name,
			"file_size":    f.Size,
			"file_type":    fileType,
			"path":         filePath,
			"updated_at":   f.UpdatedAt.Format(time.RFC3339),
			"download_url": downloadURL,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"status":  "success",
		"message": "User stats & largest files retrieved successfully",
		"data": gin.H{
			"email":         user.Email,
			"name":          user.FullName,
			"role":          user.Role,
			"last_accessed": lastAccessed,
			"storage": gin.H{
				"quota_bytes":     user.Quota,
				"used_bytes":      totalSize,
				"available_bytes": availableBytes,
				"percentage_used": percentageUsed,
			},
			"largest_files": largestFilesResponse,
		},
	})
}

func determineFileType(mimeType string, filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	mimeLower := strings.ToLower(mimeType)

	if strings.HasPrefix(mimeLower, "video/") || ext == ".mp4" || ext == ".mkv" || ext == ".avi" || ext == ".mov" || ext == ".webm" || ext == ".flv" || ext == ".wmv" || ext == ".m4v" {
		return "video"
	}
	if strings.HasPrefix(mimeLower, "image/") || ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".bmp" || ext == ".webp" || ext == ".psd" || ext == ".svg" || ext == ".tiff" || ext == ".ico" {
		return "image"
	}
	if strings.Contains(mimeLower, "zip") || strings.Contains(mimeLower, "rar") || strings.Contains(mimeLower, "tar") || strings.Contains(mimeLower, "7z") || strings.Contains(mimeLower, "compressed") || ext == ".zip" || ext == ".rar" || ext == ".7z" || ext == ".tar" || ext == ".gz" || ext == ".bz2" || ext == ".iso" {
		return "archive"
	}
	if strings.HasPrefix(mimeLower, "audio/") || ext == ".mp3" || ext == ".wav" || ext == ".ogg" || ext == ".flac" || ext == ".m4a" || ext == ".aac" || ext == ".wma" {
		return "audio"
	}
	if strings.HasPrefix(mimeLower, "text/") || strings.Contains(mimeLower, "pdf") || strings.Contains(mimeLower, "word") || strings.Contains(mimeLower, "excel") || strings.Contains(mimeLower, "powerpoint") || strings.Contains(mimeLower, "officedocument") || ext == ".pdf" || ext == ".doc" || ext == ".docx" || ext == ".xls" || ext == ".xlsx" || ext == ".ppt" || ext == ".pptx" || ext == ".txt" || ext == ".csv" || ext == ".odt" || ext == ".rtf" {
		return "document"
	}
	return "other"
}

func buildFilePath(f models.File) string {
	if f.FolderID == nil || *f.FolderID == 0 {
		return "/" + f.Name
	}

	var folderNames []string
	currentID := f.FolderID

	for depth := 0; depth < 20 && currentID != nil && *currentID != 0; depth++ {
		var folder models.Folder
		if err := DB.Select("id, name, parent_id").Where("id = ?", *currentID).First(&folder).Error; err != nil {
			break
		}
		folderNames = append([]string{folder.Name}, folderNames...)
		currentID = folder.ParentID
	}

	if len(folderNames) == 0 {
		return "/" + f.Name
	}

	return "/" + strings.Join(folderNames, "/") + "/" + f.Name
}
