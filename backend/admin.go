package main

import (
	"baknusdrive/models"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AdminMiddleware ensures only Admin roles can access the endpoints
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.MustGet("userID").(string)

		var user models.User
		if err := DB.Where("id = ?", userID).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User  not found"})
			c.Abort()
			return
		}

		// Check role case-insensitively
		role := strings.ToLower(user.Role)
		if role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Akses Ditolak. Memerlukan hak akses Admin."})
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetAdminUsers returns a list of all users and their storage usage
func GetAdminUsers(c *gin.Context) {
	var users []models.User
	if err := DB.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	type UserJSON struct {
		ID        string `json:"id"`
		Email     string `json:"email"`
		FullName  string `json:"full_name"`
		Role      string `json:"role"`
		Quota     int64  `json:"quota"`
		UsedSpace int64  `json:"used_space"`
		IsActive  bool   `json:"is_active"`
	}

	results := make([]UserJSON, len(users))
	for i, user := range users {
		var totalSize int64
		DB.Model(&models.File{}).Where("user_id = ?", user.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)
		
		results[i] = UserJSON{
			ID:        user.ID,
			Email:     user.Email,
			FullName:  user.FullName,
			Role:      user.Role,
			Quota:     user.Quota,
			UsedSpace: totalSize,
			IsActive:  user.IsActive,
		}
	}

	c.JSON(http.StatusOK, gin.H{"users": results})
}

type UpdateUserRequest struct {
	Quota    int64 `json:"quota"`
	IsActive *bool `json:"is_active"`
}

// AdminUpdateUser lets admin update user quota and active status
func AdminUpdateUser(c *gin.Context) {
	targetUID := c.Param("id") // user email
	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var user models.User
	if err := DB.Where("id = ?", targetUID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if req.Quota > 0 {
		user.Quota = req.Quota
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	if err := DB.Save(&user).Error; err != nil {
		log.Printf("AdminUpdateUser error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update data user: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully", "user": user})
}

// AdminListDrive lets admin see files or folders of any user (Read-only view)
func AdminListDrive(c *gin.Context) {
	targetUID := c.Query("user_id")
	parentID := c.Query("parent_id") // Optional

	if targetUID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		return
	}

	var folders []models.Folder
	var files []models.File

	folderQuery := DB.Where("user_id = ? AND deleted_at IS NULL", targetUID)
	fileQuery := DB.Where("user_id = ? AND deleted_at IS NULL", targetUID)

	if parentID != "" {
		folderQuery = folderQuery.Where("parent_id = ?", parentID)
		fileQuery = fileQuery.Where("folder_id = ?", parentID)
	} else {
		folderQuery = folderQuery.Where("parent_id IS NULL")
		fileQuery = fileQuery.Where("folder_id IS NULL")
	}

	folderQuery.Find(&folders)
	fileQuery.Find(&files)

	c.JSON(http.StatusOK, gin.H{
		"folders": folders,
		"files":   files,
	})
}
