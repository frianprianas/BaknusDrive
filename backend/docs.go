package main

import (
	"baknusdrive/models"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// CollaboraPublicURL is the externally accessible URL for Collabora Online.
// Collabora opens inside an iframe that the browser loads, so this must be reachable by the client browser.
const CollaboraPublicURL = "https://baknusdrive.smkbn666.sch.id/collabora"

// WopiBaseURL is the URL Collabora uses to call back to the WOPI host (backend).
// Must be reachable by the Collabora container (internal Docker network).
const WopiBaseURL = "http://backend:8080"

// WopiPublicBaseURL is the URL used when generating WOPI src sent TO COLLABORA,
// it must be the public-facing backend URL reachable from Collabora's container.
// Since Collabora is in the same Docker network, use internal URL.
const WopiPublicBaseURL = "http://backend:8080"

// ─────────────────────────────────────────────
// CreateDoc creates a new empty Office document
// ─────────────────────────────────────────────
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
	var templateBytes []byte
	var err error
	var mimeType string

	switch req.Type {
	case "docx":
		templateBytes, err = CreateEmptyDocx()
		mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case "xlsx":
		templateBytes, err = CreateEmptyXlsx()
		mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case "pptx":
		templateBytes, err = CreateEmptyPptx()
		mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported file type"})
		return
	}

	if err != nil {
		log.Printf("Failed to create template: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare template"})
		return
	}

	if err = os.WriteFile(savePath, templateBytes, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file"})
		return
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

// ─────────────────────────────────────────────────────────────────────────────
// OpenDoc generates a per-user WOPI token and returns the Collabora editor URL.
// Multiple users opening the same file will join the same collaborative session
// because Collabora tracks sessions by document (WOPI file_id), not by token.
// ─────────────────────────────────────────────────────────────────────────────
func OpenDoc(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	fileIDStr := c.Param("id")
	fileID, err := strconv.Atoi(fileIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	// Load file — must be owned by user OR shared with them
	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Determine if user can write
	canWrite := file.UserID == userID
	if !canWrite {
		// Check if shared with write access (current model: all shares allow write)
		var currentUser models.User
		if err := DB.Where("id = ?", userID).First(&currentUser).Error; err == nil {
			var share models.Share
			if DB.Where("file_id = ? AND (shared_with = ? OR shared_with = ?)",
				fileID, currentUser.Email, "ROLE:"+currentUser.Role).First(&share).Error == nil {
				canWrite = true
			} else if file.FolderID != nil && HasAccessToFolder(userID, *file.FolderID) {
				canWrite = true
			}
		}
	}

	if !canWrite && file.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// ── Generate per-user WOPI access token (TTL 8 hours) ──
	// Key: "wopi_token:<token>"  Value: "<userID>:<fileID>"
	token := fmt.Sprintf("wopi_%s_%d_%d", userID, fileID, time.Now().UnixNano())
	tokenKey := "wopi_token:" + token
	tokenValue := fmt.Sprintf("%s|%d", userID, fileID)
	if err := RedisClient.Set(context.Background(), tokenKey, tokenValue, 8*time.Hour).Err(); err != nil {
		log.Printf("[OpenDoc] Failed to store WOPI token in Redis: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create editor session"})
		return
	}

	// ── Determine Collabora action URL based on mime type ──
	// Collabora supports:  edit (read-write)  |  view (read-only)
	action := "edit"
	if !canWrite {
		action = "view"
	}

	// Map MIME to Collabora app path
	var appPath string
	switch file.MimeType {
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/msword":
		appPath = "/loleaflet/dist/loleaflet.html"
	case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/vnd.ms-excel":
		appPath = "/loleaflet/dist/loleaflet.html"
	case "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"application/vnd.ms-powerpoint":
		appPath = "/loleaflet/dist/loleaflet.html"
	default:
		appPath = "/loleaflet/dist/loleaflet.html"
	}
	_ = appPath
	_ = action

	// ── Build WOPI src URL (what Collabora fetches to get file info) ──
	wopiSrc := fmt.Sprintf("%s/wopi/files/%d", WopiPublicBaseURL, fileID)

	// ── Build the final Collabora URL ──
	// Format: https://<collabora>/loleaflet/<version>/loleaflet.html?WOPISrc=<src>&access_token=<token>
	collaboraURL := fmt.Sprintf(
		"%s/loleaflet/dist/loleaflet.html?WOPISrc=%s&access_token=%s&lang=id",
		CollaboraPublicURL,
		url.QueryEscape(wopiSrc),
		url.QueryEscape(token),
	)

	log.Printf("[OpenDoc] User=%s FileID=%d → %s", userID, fileID, collaboraURL)

	c.JSON(http.StatusOK, gin.H{
		"url":       collaboraURL,
		"token":     token,
		"file_id":   fileID,
		"file_name": file.Name,
		"can_write": canWrite,
		"wopi_src":  wopiSrc,
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// WopiCheckFileInfo — called by Collabora to get file metadata.
// Validates per-user token from Redis to identity the requesting user.
// ─────────────────────────────────────────────────────────────────────────────
func WopiCheckFileInfo(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

	// ── Resolve user identity from WOPI token ──
	accessToken := c.Query("access_token")
	userID, canWrite := resolveWopiToken(accessToken, fileID)
	if userID == "" {
		// Fallback to INTERNAL_DOC_TOKEN for system access (legacy)
		internalToken := os.Getenv("INTERNAL_SYSTEM_TOKEN")
		if accessToken != internalToken {
			log.Printf("[WOPI CheckFileInfo] Unauthorized token for file %d", fileID)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid WOPI token"})
			return
		}
		// System token — use file owner as identity
		var f models.File
		if DB.Where("id = ?", fileID).First(&f).Error != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
			return
		}
		userID = f.UserID
		canWrite = true
	}

	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		log.Printf("[WOPI] File not found %d", fileID)
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	var user models.User
	DB.Where("id = ?", userID).First(&user)

	info, err := os.Stat(file.Path)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Physical file missing"})
		return
	}

	// Collabora uses these fields to support co-authoring
	c.JSON(http.StatusOK, gin.H{
		// Mandatory
		"BaseFileName":     file.Name,
		"OwnerId":          file.UserID,
		"Size":             info.Size(),
		"UserId":           userID,
		"UserFriendlyName": user.FullName,
		"Version":          fmt.Sprintf("%d", file.UpdatedAt.Unix()),
		// Write permissions
		"UserCanWrite":            canWrite,
		"SupportsUpdate":          true,
		"UserCanNotWriteRelative": true,
		// ── Collaboration fields (Collabora/LibreOffice Online) ──
		"SupportsLocks":       true,
		"SupportsCoauthoring": true,
		// PostMessage for close button
		"PostMessageOrigin": "https://baknusdrive.smkbn666.sch.id",
		// Enable user list
		"DisablePrint":     false,
		"DisableExport":    false,
		"DisableCopy":      false,
		"HidePrintOption":  false,
		"HideExportOption": false,
		"HideSaveOption":   false,
	})
}

// resolveWopiToken looks up "wopi_token:<token>" in Redis.
// Returns (userID, canWrite). If not found, returns ("", false).
func resolveWopiToken(token string, fileID int) (string, bool) {
	if token == "" {
		return "", false
	}
	val, err := RedisClient.Get(context.Background(), "wopi_token:"+token).Result()
	if err != nil {
		return "", false
	}
	// val = "userID|fileID"
	parts := strings.SplitN(val, "|", 2)
	if len(parts) != 2 {
		return "", false
	}
	storedFileID, _ := strconv.Atoi(parts[1])
	if storedFileID != fileID {
		return "", false
	}
	return parts[0], true // canWrite is determined by share logic in OpenDoc; here assume true since token was issued
}

// ─────────────────────────────────────────────
// WopiGetFile — Collabora downloads file content
// ─────────────────────────────────────────────
func WopiGetFile(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

	// Validate token
	accessToken := c.Query("access_token")
	userID, _ := resolveWopiToken(accessToken, fileID)
	if userID == "" {
		internalToken := os.Getenv("INTERNAL_SYSTEM_TOKEN")
		if accessToken != internalToken {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid WOPI token"})
			return
		}
	}

	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	fileBytes, err := os.ReadFile(file.Path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot read file"})
		return
	}

	c.Data(http.StatusOK, "application/octet-stream", fileBytes)
}

// ─────────────────────────────────────────────────────────────
// WopiPutFile — Collabora saves updated content back to backend
// ─────────────────────────────────────────────────────────────
func WopiPutFile(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

	// Validate token
	accessToken := c.Query("access_token")
	userID, canWrite := resolveWopiToken(accessToken, fileID)
	if userID == "" {
		internalToken := os.Getenv("INTERNAL_SYSTEM_TOKEN")
		if accessToken != internalToken {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid WOPI token"})
			return
		}
		canWrite = true
	}
	if !canWrite {
		c.JSON(http.StatusForbidden, gin.H{"error": "Write access denied"})
		return
	}

	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read body"})
		return
	}
	defer c.Request.Body.Close()

	if len(bodyBytes) > 0 {
		if err = os.WriteFile(file.Path, bodyBytes, 0644); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot save file"})
			return
		}
		file.Size = int64(len(bodyBytes))
		file.UpdatedAt = time.Now()
		DB.Save(&file)
		log.Printf("[WOPI PutFile] Saved file %d (%d bytes) by user %s", fileID, len(bodyBytes), userID)
	}

	c.Status(http.StatusOK)
}

// ──────────────────────────────
// WopiRouter registers all WOPI routes
// ──────────────────────────────
func WopiRouter(r *gin.Engine) {
	wopi := r.Group("/wopi")
	wopi.GET("/files/:file_id", WopiCheckFileInfo)
	wopi.GET("/files/:file_id/contents", WopiGetFile)
	wopi.POST("/files/:file_id/contents", WopiPutFile)
}
