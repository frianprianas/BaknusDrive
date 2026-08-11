package main

import (
	"net/http"
	"os"
	"time"

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
