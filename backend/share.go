// share.go
package main

import (
	"net/http"
	"strings"

	"baknusdrive/models"

	"github.com/gin-gonic/gin"
)

func ListUsers(c *gin.Context) {
	var users []models.User
	DB.Select("email, full_name, role").Find(&users)
	c.JSON(http.StatusOK, gin.H{"users": users})
}

type ShareReq struct {
	Type       string `json:"type" binding:"required"` // "file" or "folder"
	ID         uint   `json:"id" binding:"required"`
	SharedWith string `json:"shared_with" binding:"required"`
}

func ShareItem(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	var req ShareReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if !strings.HasPrefix(req.SharedWith, "ROLE:") {
		// Verify target user exists
		var targetUser models.User
		if err := DB.Where("email = ?", req.SharedWith).First(&targetUser).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User to share with not found"})
			return
		}

		if targetUser.ID == userID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot share with yourself"})
			return
		}
	}

	var share models.Share
	share.SharedBy = userID
	share.SharedWith = req.SharedWith

	if req.Type == "file" {
		// Verify ownership
		var file models.File
		if err := DB.Where("id = ? AND user_id = ?", req.ID, userID).First(&file).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "File not found or unauthorized"})
			return
		}

		// Check if already shared
		var existing models.Share
		if err := DB.Where("file_id = ? AND shared_with = ?", req.ID, req.SharedWith).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"message": "Already shared"})
			return
		}
		
		share.FileID = &req.ID
	} else if req.Type == "folder" {
		// Verify ownership
		var folder models.Folder
		if err := DB.Where("id = ? AND user_id = ?", req.ID, userID).First(&folder).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found or unauthorized"})
			return
		}

		// Check if already shared
		var existing models.Share
		if err := DB.Where("folder_id = ? AND shared_with = ?", req.ID, req.SharedWith).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"message": "Already shared"})
			return
		}

		share.FolderID = &req.ID
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid type"})
		return
	}

	if err := DB.Create(&share).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to share item"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item shared successfully", "share": share})
}

func ListSharedWithMe(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	var currentUser models.User
	if err := DB.Where("id = ?", userID).First(&currentUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}
	userEmail := currentUser.Email
	userRole := currentUser.Role

	var shares []models.Share
	DB.Preload("File").Preload("Folder").Preload("OwnerUser").
		Where("shared_with = ? OR shared_with = ?", userEmail, "ROLE:"+userRole).
		Find(&shares)

	var files []models.File
	var folders []models.Folder

	seenFiles := make(map[uint]bool)
	seenFolders := make(map[uint]bool)

	for _, s := range shares {
		if s.FileID != nil && s.File != nil {
			if !seenFiles[*s.FileID] {
				f := *s.File
				f.IsShared = true
				if s.OwnerUser != nil && s.OwnerUser.FullName != "" {
					f.OwnerName = s.OwnerUser.FullName
				} else {
					f.OwnerName = s.SharedBy
				}
				files = append(files, f)
				seenFiles[*s.FileID] = true
			}
		} else if s.FolderID != nil && s.Folder != nil {
			if !seenFolders[*s.FolderID] {
				f := *s.Folder
				f.IsShared = true
				if s.OwnerUser != nil && s.OwnerUser.FullName != "" {
					f.OwnerName = s.OwnerUser.FullName
				} else {
					f.OwnerName = s.SharedBy
				}
				folders = append(folders, f)
				seenFolders[*s.FolderID] = true
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"folders": folders,
		"files":   files,
	})
}
