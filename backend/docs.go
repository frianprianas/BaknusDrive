package main

import (
	"baknusdrive/models"
	"encoding/base64"
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

const (
	// Minimal valid DOCX (empty document)
	EmptyDocxBase64 = "UEsDBBQAAAAIAIi6S1YAAAAAAAAAAAAAAAALAAAAX3JlbHMvLnJlbHOskD1PwzAMhu9I/IfId5p2QAAmSExIgBN3SBy3TfyoNo707/PTtC6p47InP8eP7eTLuqrv+IB/Lp0QdJEECDhLepN/EvBz87I8gcBpcZp7Fig4QYbr69vLp7SshXmYmNShyvBLIHgBeFWLidY7AcikNE3Owf1fqgQC9jYV6H7LALsfhjGEeO8TMCWieCqViwUuGNDYVZUrwaicgV6V1pFMqcA9A71HlV0TSHUJ+lVqUiSjDNoKuj6q7IJAqlvQr1KbIJlk4HZA71ZlFwT8/2T8/5M0/p/f+/6m/9sc8X+r6f9Wde9vqvFfqfEPUEsDBBQAAAAIAIi6S1YAAAAAAAAAAAAAAAAOAAAAwordL2RvY3VtZW50LnhtbJWRTU7DMBCF70jcg8hz3Kbd0KogJS7AkTsgjlsWbtVIcRLp3+enSduSOnXZk5/jx3byZVPXdccH/HPphaCLNEDAWdKb8reAn5un5REPnBanutXOs0DBCdJfX18+pWUFzN3EpA5V+V8CwQvAq1p0tN4JQCZJInm0f5YqgYCDSQW636rAbof9EEO89gmYAlE8lkrFAhcMaOwqzVJmVM5Ar0pjSuM9AluB3p3KbgikugL9KlVJMp5AW0HXT5VdEEh1DfpVadJJYjwDui9VdkHA/0/G/z9J7X956T9L8n8Z8f+r8f9O9e5navIXdfIHUfIDUEsBAhQAFAAAAAgAiLpLVgAAAAAAAAAAAAAAAAsAAAAAAAAAAAAAAAAAAAAAAF9yZWxzLy5yZWxzUEsBAhQAFAAAAAgAiLpLVgAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAQwAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAACAAIAWAAAAIsAAAAAAA=="
	// Minimal valid XLSX (empty sheet)
	EmptyXlsxBase64 = "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"
	// Minimal valid PPTX (empty presentation)
	EmptyPptxBase64 = "UEsDBBQAAAAIAIi6S1YAAAAAAAAAAAAAAAALAAAAX3JlbHMvLnJlbHOskD1PwzAMhu9I/IfId5p2QAAmSExIgBN3SBy3TfyoNo707/PTtC6p47InP8eP7eTLuqrv+IB/Lp0QdJEECDhLepN/EvBz87I8gcBpcZp7Fig4QYbr69vLp7SshXmYmNShyvBLIHgBeFWLidY7AcikNE3Owf1fqgQC9jYV6H7LALsfhjGEeO8TMCWieCqViwUuGNDYVZUrwaicgV6V1pFMqcA9A71HlV0TSHUJ+lVqUiSjDNoKuj6q7IJAqlvQr1KbIJlk4HZA71ZlFwT8/2T8/5M0/p/f+/6m/9sc8X+r6f9Wde9vqvFfqfEPUEsDBBQAAAAIAIi6S1YAAAAAAAAAAAAAAAAQAAAAcHB0L3ByZXNlbnRhdGlvbi54bWydkdFOwzAMhu9IvIPId2rtYGDExIQEeOEOsdtySletFCeR/j0fOq1L6sTXefmZ/9fJl8PQ9mPD7fGvlS6ChkoBgmek9+VrwPd18uVjFDgtnVLeMUfECVxcvNxePyxlYfWkYlCHIsMvgeAF4FWNO1rfYSRvJUnOwP5dqgQCDiYVaHuLAPvYj2MMYacnYE5E8liqFApYMGHdS6V0IuwIrA9KvSuxE4jkBfSjVCoiSccDOge9AsrkCJG8AXWRWhfJOALQvVXZEQH/3xlf/ySl/YvV/psU/mNS+H81/ttW6z6rZr+onr+onL+omA9S6p6k1E9S6ieU+glSPlClu5Xy/uM6f9U9AKX+BFBLAwQUAAAACACluktWAAAAAAAAAAAAAAAAFgAAAHB0L3JlbHMvcHJlc2VudGF0aW9uLnhtbC5yZWxztJLBasMwEITvRd+B5L2S7RAKScMhhzS5Q+K4rYpdrRVL6N9T6e+p0t6SOnTZS0Y7X0Yz7/qqLvwOfl97KekYTRBwlrS2/Cnge3m7PkSB8+I099p5Fig4QYbry8mXpKyEubK0iUOV4bdA8ALwshYTrZ8SJJPUZMnB/FmqGAL2JhXofssA+xhPMYR47xMwBaJ4KpWLBS4Ysdg3lSOZUhYFvSjNFskkArcN+uqq9IRA9An6VaofkiQZeGyg96qyKwL+v3X879vU/p8v/Z9N/L9N9f+m6t7fVOW+qMqfVfOfVPM9Se5BSj5A6R6gdA9QugeofIAv9Q9UyiNKySNC9QNKnX+WUr8HUEsDBBQAAAAIAIi6S1YAAAAAAAAAAAAAAAAOAAAAcHB0L3ByZXNlbnRhdGlvbi54bWxQSwBAhQAFAAAAAgAiLpLVgAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAHBwdC9wcmVzZW50YXRpb24ueG1sUEsBAhQAFAAAAAgAiLpLVgAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAQAAAAGFwcC54bWxQSwECHAAUAAAACACluktWAAAAAAAAAAAAAAAAKAAAAAAAAGNvcmUueG1sUEsBAhQAFAAAAAgAiLpLVgAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAaAAAAHBwdC9fcmVscy9wcmVzZW50YXRpb24ueG1sLnJlbHNQSwUGAAAAAAYABgC6AQAAyQAAAAAA"
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
	config.Document.Key = fmt.Sprintf("%d-%d-%d", file.ID, file.UpdatedAt.Unix(), time.Now().Unix())
	config.Document.Title = file.Name

	// Use internal Docker URL with port 8888 for OnlyOffice communication.
	internalURL := "http://backend:8888"

	config.Document.URL = fmt.Sprintf("%s/api/raw/doc/%d?token=%s", internalURL, file.ID, "INTERNAL_DOC_TOKEN")
	config.EditorConfig.CallbackURL = fmt.Sprintf("%s/api/doc/callback/%d", internalURL, file.ID)
	log.Printf("Preparing Doc Config: %s", config.Document.URL)
	config.EditorConfig.User.ID = user.ID
	config.EditorConfig.User.Name = user.FullName

	// Public URL for browser-facing links
	publicURL := "http://" + c.Request.Host
	if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
		publicURL = "https://" + c.Request.Host
	}

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
	log.Printf("OnlyOffice fetching file: %s", c.Param("id"))
	fileID := c.Param("id")
	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Set correct Content-Type for OnlyOffice
	ext := strings.ToLower(filepath.Ext(file.Name))
	contentType := "application/octet-stream"
	switch ext {
	case ".docx":
		contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".xlsx":
		contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".pptx":
		contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", file.Name))
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

	// Template selection
	templateBase64 := EmptyDocxBase64
	if req.Type == "xlsx" {
		templateBase64 = EmptyXlsxBase64
	} else if req.Type == "pptx" {
		templateBase64 = EmptyPptxBase64
	}

	templateBytes, err := base64.StdEncoding.DecodeString(templateBase64)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare template"})
		return
	}

	err = os.WriteFile(savePath, templateBytes, 0644)
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
		Size:     int64(len(templateBytes)),
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
