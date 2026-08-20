package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"baknusdrive/models"

	"github.com/gin-gonic/gin"
)

// EnsureChatFolder checks if a "Chat" folder exists for the user; if not, creates it.
func EnsureChatFolder(user models.User) (*models.Folder, error) {
	var folder models.Folder
	err := DB.Where("name = ? AND user_id = ? AND parent_id IS NULL", "Chat", user.ID).First(&folder).Error
	if err != nil {
		folder = models.Folder{
			Name:     "Chat",
			UserID:   user.ID,
			IsPublic: false,
		}
		if err := DB.Create(&folder).Error; err != nil {
			return nil, err
		}
		log.Printf("[ChatAPI] Folder 'Chat' created for user: %s", user.Email)
	}
	return &folder, nil
}

// SetupChatFolder initializes the "Chat" folder for a given user or all users
func SetupChatFolder(c *gin.Context) {
	apiKey := c.GetHeader("X-Chat-API-Key")
	if apiKey == "" {
		apiKey = c.Query("api_key")
	}
	if apiKey != "BAKNUS_CHAT_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	var req struct {
		Email string `json:"email"`
	}
	c.ShouldBindJSON(&req)

	if req.Email != "" {
		var user models.User
		if err := DB.Where("email = ? OR id = ?", req.Email, req.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		folder, err := EnsureChatFolder(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Chat folder"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"message":   "Chat folder setup successfully for " + user.Email,
			"folder_id": folder.ID,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Chat folder setup endpoint ready"})
}

// UploadChatFile is an API for 3rd-party Chat applications (e.g. BaknusChat) to upload
// images/videos/documents directly into the sender's own BaknusDrive in the "Chat" folder.
func UploadChatFile(c *gin.Context) {
	apiKey := c.GetHeader("X-Chat-API-Key")
	if apiKey == "" {
		apiKey = c.Query("api_key")
	}
	if apiKey != "BAKNUS_CHAT_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	senderEmail := strings.TrimSpace(c.PostForm("email"))
	if senderEmail == "" {
		senderEmail = strings.TrimSpace(c.PostForm("sender_email"))
	}
	if senderEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email (or sender_email) is required"})
		return
	}

	peerEmail := strings.TrimSpace(c.PostForm("peer_email"))
	if peerEmail == "" {
		peerEmail = strings.TrimSpace(c.PostForm("recipient_email"))
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded (multipart form field 'file' is required)"})
		return
	}

	// 1. Retrieve Sender User
	var user models.User
	if err := DB.Where("email = ? OR id = ?", senderEmail, senderEmail).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("User with email '%s' not found in BaknusDrive", senderEmail)})
		return
	}

	// 2. Ensure "Chat" folder exists in user's drive
	chatFolder, err := EnsureChatFolder(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to ensure Chat folder"})
		return
	}

	// 3. Check User Storage Quota
	var totalUsed int64
	DB.Model(&models.File{}).Where("user_id = ?", user.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalUsed)
	if totalUsed+fileHeader.Size > user.Quota {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"error":      "Storage quota exceeded for user",
			"quota":      user.Quota,
			"used_space": totalUsed,
			"file_size":  fileHeader.Size,
		})
		return
	}

	// 4. Save file to physical storage directory (storage/{userID}/...)
	userStoragePath := filepath.Join("storage", user.ID)
	os.MkdirAll(userStoragePath, os.ModePerm)

	safeFilename := fmt.Sprintf("chat_%d_%s", time.Now().UnixNano(), fileHeader.Filename)
	savePath := filepath.Join(userStoragePath, safeFilename)

	if err := c.SaveUploadedFile(fileHeader, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file on disk: " + err.Error()})
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// 5. Create File Record with IsPublic: true (for direct rendering in chat app)
	newFile := models.File{
		Name:     fileHeader.Filename,
		MimeType: mimeType,
		Size:     fileHeader.Size,
		Path:     savePath,
		FolderID: &chatFolder.ID,
		UserID:   user.ID,
		IsPublic: true,
	}

	if err := DB.Create(&newFile).Error; err != nil {
		os.Remove(savePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file record: " + err.Error()})
		return
	}

	// 6. Update user's used_space
	DB.Model(&user).Update("used_space", totalUsed+fileHeader.Size)

	// 7. Optional: Share file with peer recipient if peer_email is provided
	if peerEmail != "" && !strings.EqualFold(peerEmail, senderEmail) {
		var peer models.User
		if err := DB.Where("email = ? OR id = ?", peerEmail, peerEmail).First(&peer).Error; err == nil {
			var existingShare models.Share
			if err := DB.Where("file_id = ? AND shared_with = ?", newFile.ID, peer.ID).First(&existingShare).Error; err != nil {
				share := models.Share{
					FileID:     &newFile.ID,
					SharedBy:   user.ID,
					SharedWith: peer.ID,
				}
				DB.Create(&share)
			}
		}
	}

	// 8. Construct direct access URL
	scheme := "https"
	if c.Request.TLS == nil && !strings.Contains(c.Request.Host, "baknusdrive") {
		scheme = "http"
	}
	host := c.Request.Host
	if host == "" {
		host = "baknusdrive.smkbn666.sch.id"
	}

	fileURL := fmt.Sprintf("%s://%s/api/public/file/%d/download", scheme, host, newFile.ID)

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "File uploaded successfully to Chat folder",
		"file_id":   newFile.ID,
		"file_name": newFile.Name,
		"file_url":  fileURL,
		"size":      newFile.Size,
		"mime_type": newFile.MimeType,
		"folder_id": chatFolder.ID,
	})
}
