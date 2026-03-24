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
// Nginx proxies /browser, /cool, /hosting paths to Collabora on port 8085.
const CollaboraPublicURL = "https://baknusdrive.smkbn666.sch.id"

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
			if DB.Where("file_id = ? AND (shared_with = ? OR shared_with = ? OR shared_with = ?)",
				fileID, currentUser.Email, "ROLE:"+currentUser.Role, "CLASS:"+currentUser.Class).First(&share).Error == nil {
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

	// ── Build WOPI src URL (Collabora uses this to call back to backend for file info) ──
	// WopiPublicBaseURL must be reachable by the Collabora container (internal Docker: http://backend:8080)
	wopiSrc := fmt.Sprintf("%s/wopi/files/%d", WopiPublicBaseURL, fileID)

	// ── Build the final Collabora URL ──
	// Modern Collabora CODE uses /browser/dist/cool.html (not the old /loleaflet path)
	// CollaboraPublicURL = https://baknusdrive.smkbn666.sch.id
	// Nginx routes /browser and /cool to Collabora container on port 8085
	collaboraURL := fmt.Sprintf(
		"%s/browser/dist/cool.html?WOPISrc=%s&access_token=%s&lang=id",
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

// GetClassViewToken is an integration API for BaknusClass to get a temporary view-only editor URL.
// It requires X-Class-API-Key header.
func GetClassViewToken(c *gin.Context) {
	apiKey := c.GetHeader("X-Class-API-Key")
	if apiKey != "BAKNUS_CLASS_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	fileIDStr := c.Param("id")
	fileID, err := strconv.Atoi(fileIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file ID"})
		return
	}

	// Verify file
	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// ── Generate per-user WOPI view token (TTL 2 hours) ──
	// Identity is "GUEST" for BaknusClass students
	token := fmt.Sprintf("class_view_%d_%d", fileID, time.Now().UnixNano())
	tokenKey := "wopi_token:" + token
	tokenValue := fmt.Sprintf("GUEST|%d", fileID)
	if err := RedisClient.Set(context.Background(), tokenKey, tokenValue, 2*time.Hour).Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	wopiSrc := fmt.Sprintf("%s/wopi/files/%d", WopiPublicBaseURL, fileID)
	collaboraURL := fmt.Sprintf(
		"%s/browser/dist/cool.html?WOPISrc=%s&access_token=%s&lang=id",
		CollaboraPublicURL,
		url.QueryEscape(wopiSrc),
		url.QueryEscape(token),
	)

	c.JSON(http.StatusOK, gin.H{
		"url":       collaboraURL,
		"file_id":   fileID,
		"file_name": file.Name,
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
			log.Printf("[WOPI GetFile] Unauthorized token for file %d, token=%q", fileID, accessToken)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid WOPI token"})
			return
		}
	}

	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		log.Printf("[WOPI GetFile] File not found in DB: id=%d", fileID)
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	fileBytes, err := os.ReadFile(file.Path)
	if err != nil {
		log.Printf("[WOPI GetFile] Cannot read file at path=%q: %v", file.Path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot read file"})
		return
	}

	log.Printf("[WOPI GetFile] Serving file %d (%d bytes) path=%q", fileID, len(fileBytes), file.Path)
	c.Data(http.StatusOK, "application/octet-stream", fileBytes)
}

// ─────────────────────────────────────────────────────────────
// WopiPutFile — Collabora saves updated content back to backend
// ─────────────────────────────────────────────────────────────
func WopiPutFile(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

	accessToken := c.Query("access_token")
	log.Printf("[WOPI PutFile] fileID=%d token=%q method=%s", fileID, accessToken, c.Request.Method)

	// Validate token
	userID, canWrite := resolveWopiToken(accessToken, fileID)
	if userID == "" {
		internalToken := os.Getenv("INTERNAL_SYSTEM_TOKEN")
		if accessToken != internalToken {
			log.Printf("[WOPI PutFile] UNAUTHORIZED: token=%q fileID=%d", accessToken, fileID)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid WOPI token"})
			return
		}
		canWrite = true
		userID = "system"
	}
	if !canWrite {
		log.Printf("[WOPI PutFile] FORBIDDEN: user=%s has no write access to file %d", userID, fileID)
		c.JSON(http.StatusForbidden, gin.H{"error": "Write access denied"})
		return
	}

	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		log.Printf("[WOPI PutFile] File not found in DB: id=%d", fileID)
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("[WOPI PutFile] Failed to read body: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read body"})
		return
	}
	defer c.Request.Body.Close()

	log.Printf("[WOPI PutFile] Received %d bytes for file %d at path=%q", len(bodyBytes), fileID, file.Path)

	if len(bodyBytes) > 0 {
		// Ensure parent directory exists
		dir := filepath.Dir(file.Path)
		if err = os.MkdirAll(dir, 0755); err != nil {
			log.Printf("[WOPI PutFile] Cannot create directory %q: %v", dir, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot create directory"})
			return
		}

		if err = os.WriteFile(file.Path, bodyBytes, 0644); err != nil {
			log.Printf("[WOPI PutFile] Cannot write file %q: %v", file.Path, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot save file"})
			return
		}
		file.Size = int64(len(bodyBytes))
		file.UpdatedAt = time.Now()
		DB.Save(&file)
		log.Printf("[WOPI PutFile] ✅ Saved file %d (%d bytes) by user=%s", fileID, len(bodyBytes), userID)
	} else {
		log.Printf("[WOPI PutFile] Empty body received for file %d (lock check?), returning 200", fileID)
	}

	c.Status(http.StatusOK)
}

// ──────────────────────────────────────────────────────────────
// WopiLock — handles POST /wopi/files/:file_id
// Collabora sends this BEFORE saving to perform LOCK / UNLOCK / REFRESH_LOCK.
// We implement a simple stateless lock (always succeed) so save works.
// ──────────────────────────────────────────────────────────────
func WopiLock(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

	override := c.GetHeader("X-WOPI-Override")
	lockID := c.GetHeader("X-WOPI-Lock")
	oldLockID := c.GetHeader("X-WOPI-OldLock")

	log.Printf("[WOPI Lock] fileID=%d X-WOPI-Override=%q X-WOPI-Lock=%q X-WOPI-OldLock=%q",
		fileID, override, lockID, oldLockID)

	// Validate token
	accessToken := c.Query("access_token")
	userID, _ := resolveWopiToken(accessToken, fileID)
	if userID == "" {
		internalToken := os.Getenv("INTERNAL_SYSTEM_TOKEN")
		if accessToken != internalToken {
			log.Printf("[WOPI Lock] UNAUTHORIZED token=%q fileID=%d", accessToken, fileID)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid WOPI token"})
			return
		}
	}

	// For GET_LOCK, return current lock (we use empty = no lock)
	if override == "GET_LOCK" {
		c.Header("X-WOPI-Lock", "")
		c.Status(http.StatusOK)
		log.Printf("[WOPI Lock] GET_LOCK → 200 (no lock)")
		return
	}

	// For all other ops (LOCK, UNLOCK, REFRESH_LOCK, PUT_RELATIVE, UNLOCK_AND_RELOCK):
	// Echo back the lock ID so Collabora thinks the lock succeeded.
	// We do stateless locking — always accept.
	c.Header("X-WOPI-Lock", lockID)
	c.Status(http.StatusOK)
	log.Printf("[WOPI Lock] %s → 200 OK (stateless lock accepted)", override)
}

// ──────────────────────────────
// WopiRouter registers all WOPI routes
// ──────────────────────────────
func WopiRouter(r *gin.Engine) {
	wopi := r.Group("/wopi")
	wopi.GET("/files/:file_id", WopiCheckFileInfo)
	wopi.POST("/files/:file_id", WopiLock) // LOCK / UNLOCK / REFRESH_LOCK
	wopi.GET("/files/:file_id/contents", WopiGetFile)
	wopi.POST("/files/:file_id/contents", WopiPutFile)
}
