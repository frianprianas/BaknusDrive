package main

import (
	"net/http"
	"os"
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
	var lastLogin *time.Time
	DB.Table("users").Select("MAX(last_login)").Scan(&lastLogin)

	// Query last file activity (Created or Updated) from files table
	var lastFileActivity *time.Time
	DB.Table("files").Select("MAX(updated_at)").Scan(&lastFileActivity)

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
		"status": "success",
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
	var lastFileActivity *time.Time
	DB.Table("files").Where("user_id = ?", user.ID).Select("MAX(updated_at)").Scan(&lastFileActivity)

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
		percentageUsed = float64(totalSize) / float64(user.Quota) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
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
		},
	})
}
