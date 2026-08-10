package main

import (
	"baknusdrive/models"
	"log"
	"net/http"
	"strings"
	"time"

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

// GetAdminUsers returns a list of all users and their storage usage with detailed upload stats
func GetAdminUsers(c *gin.Context) {
	var users []models.User
	if err := DB.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	type UserStats struct {
		UploaderID       string     `gorm:"column:uploader_id"`
		TotalFiles       int        `gorm:"column:total_files"`
		TotalSize        int64      `gorm:"column:total_size"`
		OwnDriveCount    int        `gorm:"column:own_drive_count"`
		OwnDriveSize     int64      `gorm:"column:own_drive_size"`
		SharedDriveCount int        `gorm:"column:shared_drive_count"`
		SharedDriveSize  int64      `gorm:"column:shared_drive_size"`
		LastActivity     *time.Time `gorm:"column:last_activity"`
	}

	statsQuery := `
		WITH RECURSIVE folder_roots AS (
			SELECT id, user_id AS root_owner_id
			FROM folders
			WHERE parent_id IS NULL AND deleted_at IS NULL
			UNION ALL
			SELECT f.id, fr.root_owner_id
			FROM folders f
			INNER JOIN folder_roots fr ON f.parent_id = fr.id
			WHERE f.deleted_at IS NULL
		),
		classified_files AS (
			SELECT 
				fi.user_id AS uploader_id,
				fi.size,
				fi.created_at,
				CASE 
					WHEN fi.folder_id IS NULL THEN TRUE
					WHEN fr.root_owner_id = fi.user_id THEN TRUE
					ELSE FALSE
				END AS is_own_drive
			FROM files fi
			LEFT JOIN folder_roots fr ON fi.folder_id = fr.id
			WHERE fi.deleted_at IS NULL
		)
		SELECT 
			uploader_id,
			COUNT(*) AS total_files,
			SUM(size) AS total_size,
			COUNT(CASE WHEN is_own_drive = TRUE THEN 1 END) AS own_drive_count,
			SUM(CASE WHEN is_own_drive = TRUE THEN size ELSE 0 END) AS own_drive_size,
			COUNT(CASE WHEN is_own_drive = FALSE THEN 1 END) AS shared_drive_count,
			SUM(CASE WHEN is_own_drive = FALSE THEN size ELSE 0 END) AS shared_drive_size,
			MAX(created_at) AS last_activity
		FROM classified_files
		GROUP BY uploader_id
	`
	var stats []UserStats
	if err := DB.Raw(statsQuery).Scan(&stats).Error; err != nil {
		log.Printf("Failed to fetch user stats: %v", err)
	}

	statsMap := make(map[string]UserStats)
	for _, s := range stats {
		statsMap[s.UploaderID] = s
	}

	type UserJSON struct {
		ID               string     `json:"id"`
		Email            string     `json:"email"`
		FullName         string     `json:"full_name"`
		Role             string     `json:"role"`
		Class            string     `json:"class"`
		Quota            int64      `json:"quota"`
		UsedSpace        int64      `json:"used_space"`
		IsActive         bool       `json:"is_active"`
		OwnDriveCount    int        `json:"own_drive_count"`
		OwnDriveSize     int64      `json:"own_drive_size"`
		SharedDriveCount int        `json:"shared_drive_count"`
		SharedDriveSize  int64      `json:"shared_drive_size"`
		LastActivity     *time.Time `json:"last_activity"`
		LastLogin        *time.Time `json:"last_login"`
	}

	results := make([]UserJSON, len(users))
	for i, user := range users {
		var totalSize int64
		DB.Model(&models.File{}).Where("user_id = ?", user.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

		userStats := statsMap[user.ID]

		results[i] = UserJSON{
			ID:               user.ID,
			Email:            user.Email,
			FullName:         user.FullName,
			Role:             user.Role,
			Class:            user.Class,
			Quota:            user.Quota,
			UsedSpace:        totalSize,
			IsActive:         user.IsActive,
			OwnDriveCount:    userStats.OwnDriveCount,
			OwnDriveSize:     userStats.OwnDriveSize,
			SharedDriveCount: userStats.SharedDriveCount,
			SharedDriveSize:  userStats.SharedDriveSize,
			LastActivity:     userStats.LastActivity,
			LastLogin:        user.LastLogin,
		}
	}

	c.JSON(http.StatusOK, gin.H{"users": results})
}

type UpdateUserRequest struct {
	Quota    int64   `json:"quota"`
	IsActive *bool   `json:"is_active"`
	Class    *string `json:"class"`
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
	if req.Class != nil {
		user.Class = *req.Class
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

// GetSpecialShareUsers returns allowed special share users and candidate Guru/TU users
func GetSpecialShareUsers(c *gin.Context) {
	var allowed []models.User
	var candidates []models.User

	if err := DB.Where("allowed_special_share = ?", true).Find(&allowed).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data user khusus"})
		return
	}

	// Fetch candidates: role is Guru or TU (case insensitive)
	if err := DB.Where("LOWER(role) = ? OR LOWER(role) = ?", "guru", "tu").Find(&candidates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data kandidat Guru/TU"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"allowed":    allowed,
		"candidates": candidates,
	})
}

type SetSpecialShareReq struct {
	Emails []string `json:"emails" binding:"required"`
}

// SetSpecialShareUsers updates the list of users allowed to do special shares (max 2)
func SetSpecialShareUsers(c *gin.Context) {
	var req SetSpecialShareReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format data tidak valid"})
		return
	}

	if len(req.Emails) > 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Maksimal hanya boleh memilih 2 orang Guru/TU"})
		return
	}

	tx := DB.Begin()

	// 1. Reset everyone to false
	if err := tx.Model(&models.User{}).Where("1 = 1").Update("allowed_special_share", false).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mereset status"})
		return
	}

	// 2. Set to true for selected emails
	if len(req.Emails) > 0 {
		if err := tx.Model(&models.User{}).Where("email IN ?", req.Emails).Update("allowed_special_share", true).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui status user"})
			return
		}
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Daftar Guru/TU yang diizinkan berhasil diperbarui"})
}

// GetAdminUserActivity returns a list of files uploaded by a user with classification and ownership info
func GetAdminUserActivity(c *gin.Context) {
	targetUID := c.Param("id") // user email/id

	type ActivityJSON struct {
		ID             uint       `json:"id"`
		Name           string     `json:"name"`
		Size           int64      `json:"size"`
		MimeType       string     `json:"mime_type"`
		CreatedAt      time.Time  `json:"created_at"`
		FolderID       *uint      `json:"folder_id"`
		FolderName     string     `json:"folder_name"`
		IsOwnDrive     bool       `json:"is_own_drive"`
		RootOwnerID    string     `json:"root_owner_id"`
		RootOwnerName  string     `json:"root_owner_name"`
		RootOwnerEmail string     `json:"root_owner_email"`
	}

	query := `
		WITH RECURSIVE folder_roots AS (
			SELECT id, parent_id, name, user_id AS root_owner_id
			FROM folders
			WHERE parent_id IS NULL AND deleted_at IS NULL
			UNION ALL
			SELECT f.id, f.parent_id, f.name, fr.root_owner_id
			FROM folders f
			INNER JOIN folder_roots fr ON f.parent_id = fr.id
			WHERE f.deleted_at IS NULL
		)
		SELECT 
			fi.id,
			fi.name,
			fi.size,
			fi.mime_type,
			fi.created_at,
			fi.folder_id,
			COALESCE(fo.name, '') AS folder_name,
			CASE 
				WHEN fi.folder_id IS NULL THEN TRUE
				WHEN fr.root_owner_id = fi.user_id THEN TRUE
				ELSE FALSE
			END AS is_own_drive,
			COALESCE(fr.root_owner_id, '') AS root_owner_id,
			COALESCE(u.full_name, '') AS root_owner_name,
			COALESCE(u.email, '') AS root_owner_email
		FROM files fi
		LEFT JOIN folders fo ON fi.folder_id = fo.id AND fo.deleted_at IS NULL
		LEFT JOIN folder_roots fr ON fi.folder_id = fr.id
		LEFT JOIN users u ON fr.root_owner_id = u.id AND u.deleted_at IS NULL
		WHERE fi.user_id = ? AND fi.deleted_at IS NULL
		ORDER BY fi.created_at DESC
	`

	var results []ActivityJSON
	if err := DB.Raw(query, targetUID).Scan(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user activity: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"activity": results})
}
