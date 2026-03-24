package main

import (
	"log"
	"net/http"

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
