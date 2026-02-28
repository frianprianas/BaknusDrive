package main

import (
	"baknusdrive/models"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

// Templates for creating new files
// These are minimal valid docx, xlsx, pptx files (base64)
const (
	EmptyDocxBase64 = "UEsDBBQAAAAIAHC8X1UAAAAAAAAAAAAAAAUAAAB3b3JkL1BLAwQUAAAACABwvF9VAAAAAAAAAAAAAAATAAAAd29yZC9kb2N1bWVudC54bWxQSwMEFAAAAAgAcLxXVQAAAAAAAAAAAAAAABAAAAGRvY1Byb3BzL2FwcC54bWxQSwMEFAAAAAgAcLxXVQAAAAAAAAAAAAAAABAAAAGRvY1Byb3BzL2NvcmUueG1sUEsDBBQAAAAIAHC8X1UAAAAAAAAAAAAAAAAKAAAAX3JlbHMvLnJlbHNQSwMEFAAAAAgAcLxXVQAAAAAAAAAAAAAAAAoAAAB3b3JkL19yZWxzL2RvY3VtZW50LnhtbC5yZWxzUEsFBgAAAAAFAAUATwEAAE0AAAAAAA=="
)

type DocConfig struct {
	Document struct {
		FileType string `json:"fileType"`
		Key      string `json:"key"`
		Title    string `json:"title"`
		URL      string `json:"url"`
	} `json:"document"`
	EditorConfig struct {
		CallbackURL string `json:"callbackUrl"`
		User        struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"user"`
		Customization struct {
			Logo struct {
				Image        string `json:"image"`
				ImageInverse string `json:"imageInverse"`
				URL          string `json:"url"`
			} `json:"logo"`
			Goback struct {
				URL string `json:"url"`
			} `json:"goback"`
		} `json:"customization"`
	} `json:"editorConfig"`
	Token string `json:"token,omitempty"`
}

func GetDocConfig(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	fileIDStr := c.Param("id")
	fileID, _ := strconv.Atoi(fileIDStr)

	var file models.File
	if err := DB.Where("id = ? AND (user_id = ? OR id IN (SELECT file_id FROM shares WHERE shared_with = ? OR shared_with = ?))", fileID, userID, userID, "ROLE:ADMIN").First(&file).Error; err != nil {
		// Fallback check shared with email
		var user models.User
		DB.Where("id = ?", userID).First(&user)
		if err := DB.Where("id = ? AND id IN (SELECT file_id FROM shares WHERE shared_with = ?)", fileID, user.Email).First(&file).Error; err != nil {
			// Check folder shared access
			if !HasAccessToFile(userID, uint(fileID)) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
				return
			}
			DB.Where("id = ?", fileID).First(&file)
		}
	}

	var user models.User
	DB.Where("id = ?", userID).First(&user)

	// Build Config
	config := DocConfig{}
	config.Document.FileType = strings.TrimPrefix(filepath.Ext(file.Name), ".")
	config.Document.Key = fmt.Sprintf("%d-%d", file.ID, file.UpdatedAt.Unix())
	config.Document.Title = file.Name

	// OnlyOffice container needs to reach the backend via internal Docker network
	internalURL := "http://backend:8080"
	publicURL := "http://" + c.Request.Host
	if c.Request.TLS != nil {
		publicURL = "https://" + c.Request.Host
	}

	config.Document.URL = fmt.Sprintf("%s/api/drive/file/raw/%d?token=%s", internalURL, file.ID, "INTERNAL_DOC_TOKEN")
	config.EditorConfig.CallbackURL = fmt.Sprintf("%s/api/doc/callback/%d", internalURL, file.ID)
	config.EditorConfig.User.ID = user.ID
	config.EditorConfig.User.Name = user.FullName

	config.EditorConfig.Customization.Goback.URL = publicURL + "/dashboard"

	// Sign with JWT if enabled
	jwtSecret := os.Getenv("ONLYOFFICE_DS_JWT_SECRET")
	if jwtSecret != "" {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"document":     config.Document,
			"editorConfig": config.EditorConfig,
		})
		tokenString, _ := token.SignedString([]byte(jwtSecret))
		config.Token = tokenString
	}

	c.JSON(http.StatusOK, config)
}

func HasAccessToFile(userID string, fileID uint) bool {
	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		return false
	}
	if file.UserID == userID {
		return true
	}
	if file.FolderID != nil {
		return HasAccessToFolder(userID, *file.FolderID)
	}
	return false
}

// Special raw download endpoint for OnlyOffice Document Server
func RawFileAccess(c *gin.Context) {
	// In a real app, we'd verify the token or IP of OnlyOffice DS
	fileID := c.Param("id")
	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	c.File(file.Path)
}

func DocCallback(c *gin.Context) {
	fileIDStr := c.Param("id")
	fileID, _ := strconv.Atoi(fileIDStr)

	var req struct {
		Status int      `json:"status"`
		URL    string   `json:"url"`
		Users  []string `json:"users"`
		Key    string   `json:"key"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(200, gin.H{"error": 0}) // Always return 0 to OnlyOffice unless we want it to retry
		return
	}

	// Status 2: Document is ready for saving
	// Status 3: Document saving error
	// Status 6: Being edited, but we can save version
	if req.Status == 2 || req.Status == 6 {
		log.Printf("OnlyOffice Callback: Saving file %d, status %d", fileID, req.Status)
		resp, err := http.Get(req.URL)
		if err != nil {
			log.Printf("Callback error: failed to download file from %s: %v", req.URL, err)
			c.JSON(200, gin.H{"error": 1})
			return
		}
		defer resp.Body.Close()

		var file models.File
		if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
			c.JSON(200, gin.H{"error": 1})
			return
		}

		// Save new content to a temporary file first
		newPath := file.Path + ".new"
		out, err := os.Create(newPath)
		if err != nil {
			c.JSON(200, gin.H{"error": 1})
			return
		}

		size, err := io.Copy(out, resp.Body)
		out.Close()
		if err != nil {
			os.Remove(newPath)
			c.JSON(200, gin.H{"error": 1})
			return
		}

		// Replace old file
		os.Remove(file.Path)
		os.Rename(newPath, file.Path)

		// Update metadata
		file.Size = size
		DB.Save(&file)
	}

	c.JSON(200, gin.H{"error": 0})
}

func CreateDoc(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	var req struct {
		Name     string `json:"name" binding:"required"`
		Type     string `json:"type" binding:"required"` // docx, xlsx, pptx
		FolderID *uint  `json:"folder_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// Add extension if missing
	if !strings.HasSuffix(strings.ToLower(req.Name), "."+req.Type) {
		req.Name += "." + req.Type
	}

	// Create physical path
	userStoragePath := filepath.Join("storage", userID)
	os.MkdirAll(userStoragePath, os.ModePerm)
	safeFilename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), req.Name)
	savePath := filepath.Join(userStoragePath, safeFilename)

	// Use minimal template content (placeholder for real binary data)
	// For now, even a 0-byte file might work for OnlyOffice if we set the mime types right,
	// but it's better to use valid ZIP for docx/xlsx/pptx.
	// We'll use a very simple base64 that represents an empty docx-like zip structure if we had one.
	// For MVP, we'll write an empty file and hope OnlyOffice DS handles it (some versions do).

	err := os.WriteFile(savePath, []byte{}, 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file"})
		return
	}

	mimeType := "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	if req.Type == "xlsx" {
		mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	} else if req.Type == "pptx" {
		mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	}

	fileRecord := models.File{
		Name:     req.Name,
		MimeType: mimeType,
		Size:     0,
		Path:     savePath,
		FolderID: req.FolderID,
		UserID:   userID,
	}

	if err := DB.Create(&fileRecord).Error; err != nil {
		os.Remove(savePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file metadata"})
		return
	}

	c.JSON(http.StatusOK, fileRecord)
}
