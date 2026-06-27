// share.go
package main

import (
	"archive/zip"
	"crypto/tls"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"baknusdrive/models"

	"github.com/gin-gonic/gin"
)

// ─── Mailcow SMTP config ────────────────────────────────────────────────────
const (
	SMTPHost   = "mail.smk.baktinusantara666.sch.id"
	SMTPPort   = "587" // STARTTLS
	SMTPUser   = "noreply@smk.baktinusantara666.sch.id"
	SMTPPass   = "925B68-0FF6BB-36B760-F6C051-AAF343" // same as Mailcow API key — change if separate
	SMTPFrom   = "BaknusDrive <noreply@smk.baktinusantara666.sch.id>"
	AppBaseURL = "https://baknusdrive.smkbn666.sch.id"
)

// sendShareNotification sends a Mailcow SMTP email to the target user
// notifying them that a file/folder was shared with them.
func sendShareNotification(toEmail, senderName, itemType, itemName string) {
	subject := fmt.Sprintf("[BaknusDrive] %s berbagi %s dengan Anda", senderName, itemType)
	body := fmt.Sprintf(`Halo,

%s telah berbagi %s "%s" dengan Anda di BaknusDrive.

Anda dapat membuka dan mengedit dokumen tersebut secara langsung di:
%s

Salam,
Tim BaknusDrive - SMK Bakti Nusantara 666
`, senderName, itemType, itemName, AppBaseURL)

	msg := "From: " + SMTPFrom + "\r\n" +
		"To: " + toEmail + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"\r\n" +
		body

	go func() {
		addr := SMTPHost + ":" + SMTPPort

		// Try STARTTLS first (port 587)
		tlsConfig := &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         SMTPHost,
		}

		conn, err := smtp.Dial(addr)
		if err != nil {
			log.Printf("[SMTP] Dial failed: %v", err)
			return
		}
		defer conn.Close()

		if ok, _ := conn.Extension("STARTTLS"); ok {
			if err = conn.StartTLS(tlsConfig); err != nil {
				log.Printf("[SMTP] STARTTLS failed: %v", err)
				return
			}
		}

		auth := smtp.PlainAuth("", SMTPUser, SMTPPass, SMTPHost)
		if err = conn.Auth(auth); err != nil {
			log.Printf("[SMTP] Auth failed: %v", err)
			return
		}

		if err = conn.Mail(SMTPUser); err != nil {
			log.Printf("[SMTP] MAIL FROM failed: %v", err)
			return
		}
		if err = conn.Rcpt(toEmail); err != nil {
			log.Printf("[SMTP] RCPT TO failed: %v", err)
			return
		}

		wc, err := conn.Data()
		if err != nil {
			log.Printf("[SMTP] DATA failed: %v", err)
			return
		}
		defer wc.Close()

		if _, err = fmt.Fprint(wc, msg); err != nil {
			log.Printf("[SMTP] Write failed: %v", err)
			return
		}

		log.Printf("[SMTP] Share notification sent to %s", toEmail)
	}()
}

// ─────────────────────────────────────────────────────────────────────────────

func ListUsers(c *gin.Context) {
	var users []models.User
	DB.Select("email, full_name, role, class").Find(&users)
	c.JSON(http.StatusOK, gin.H{"users": users})
}

type ShareReq struct {
	Type        string `json:"type" binding:"required"` // "file" or "folder"
	ID          uint   `json:"id" binding:"required"`
	SharedWith  string `json:"shared_with" binding:"required"`
	IsBlindDrop bool   `json:"is_blind_drop"`
}

func ShareItem(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	var req ShareReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// Load sender info for notification
	var sender models.User
	DB.Where("id = ?", userID).First(&sender)
	senderName := sender.FullName
	if senderName == "" {
		senderName = userID
	}

	var targetEmail string
	var itemName string

	if !strings.HasPrefix(req.SharedWith, "ROLE:") && !strings.HasPrefix(req.SharedWith, "CLASS:") {
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
		targetEmail = targetUser.Email
	}

	var share models.Share
	share.SharedBy = userID
	share.SharedWith = req.SharedWith
	share.IsBlindDrop = req.IsBlindDrop

	if req.Type == "file" {
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
		itemName = file.Name

	} else if req.Type == "folder" {
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
		itemName = folder.Name

	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid type"})
		return
	}

	if err := DB.Create(&share).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to share item"})
		return
	}

	// ── Send email notification (non-blocking) ──
	if targetEmail != "" && itemName != "" {
		sendShareNotification(targetEmail, senderName, req.Type, itemName)
		CreateNotification(targetEmail, "Berbagi "+req.Type, senderName+" membagikan "+req.Type+" '"+itemName+"' dengan Anda.", "SHARE", "")
	} else if strings.HasPrefix(req.SharedWith, "ROLE:") {
		// Broadcast to all users with that role
		roleName := strings.TrimPrefix(req.SharedWith, "ROLE:")
		var roleUsers []models.User
		DB.Where("role = ?", roleName).Find(&roleUsers)
		for _, u := range roleUsers {
			if u.Email != userID {
				sendShareNotification(u.Email, senderName, req.Type, itemName)
				CreateNotification(u.Email, "Berbagi "+req.Type, senderName+" membagikan "+req.Type+" '"+itemName+"' dengan grup Anda.", "SHARE", "")
			}
		}
	} else if strings.HasPrefix(req.SharedWith, "CLASS:") {
		// Broadcast to all users in that class
		className := strings.TrimPrefix(req.SharedWith, "CLASS:")
		var classUsers []models.User
		DB.Where("class = ?", className).Find(&classUsers)
		for _, u := range classUsers {
			if u.Email != userID {
				sendShareNotification(u.Email, senderName, req.Type, itemName)
				CreateNotification(u.Email, "Berbagi "+req.Type, senderName+" membagikan "+req.Type+" '"+itemName+"' dengan kelas Anda.", "SHARE", "")
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item shared successfully", "share": share})
}

// ListItemShares returns all shares for a specific file or folder owned by the current user
func ListItemShares(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	itemType := c.Query("type") // "file" or "folder"
	itemIDStr := c.Query("id")

	var shares []models.Share
	if itemType == "file" {
		DB.Where("file_id = ? AND shared_by = ?", itemIDStr, userID).Find(&shares)
	} else if itemType == "folder" {
		DB.Where("folder_id = ? AND shared_by = ?", itemIDStr, userID).Find(&shares)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid type"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"shares": shares})
}

// UnshareItem deletes a share record by its ID, only if owned by the requesting user
func UnshareItem(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	shareIDStr := c.Param("id")

	var currentUser models.User
	if err := DB.Where("id = ?", userID).First(&currentUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var share models.Share
	if err := DB.Where("id = ?", shareIDStr).First(&share).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Share not found"})
		return
	}

	isReceiver := share.SharedWith == currentUser.Email || share.SharedWith == "ROLE:"+currentUser.Role || share.SharedWith == "CLASS:"+currentUser.Class
	if share.SharedBy != userID && !isReceiver {
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized to unshare this item"})
		return
	}

	if err := DB.Delete(&share).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove share"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Share removed successfully"})
}

// ListMyShares returns all shares created by the current user, with file/folder details
func ListMyShares(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	type ShareEntry struct {
		ShareID    uint        `json:"share_id"`
		SharedWith string      `json:"shared_with"`
		ItemType   string      `json:"item_type"` // "file" or "folder"
		ItemID     interface{} `json:"item_id"`
		ItemName   string      `json:"item_name"`
		CreatedAt  interface{} `json:"created_at"`
	}

	var shares []models.Share
	DB.Preload("File").Preload("Folder").
		Where("shared_by = ?", userID).
		Order("id DESC").
		Find(&shares)

	var result []ShareEntry
	for _, s := range shares {
		entry := ShareEntry{
			ShareID:    s.ID,
			SharedWith: s.SharedWith,
			CreatedAt:  s.CreatedAt,
		}
		if s.FileID != nil && s.File != nil {
			entry.ItemType = "file"
			entry.ItemID = *s.FileID
			entry.ItemName = s.File.Name
		} else if s.FolderID != nil && s.Folder != nil {
			entry.ItemType = "folder"
			entry.ItemID = *s.FolderID
			entry.ItemName = s.Folder.Name
		} else {
			continue // skip orphan shares
		}
		result = append(result, entry)
	}

	if result == nil {
		result = []ShareEntry{}
	}
	c.JSON(http.StatusOK, gin.H{"shares": result})
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
	DB.Preload("File.User").Preload("Folder.User").Preload("OwnerUser").
		Where("LOWER(shared_with) = LOWER(?) OR LOWER(shared_with) = LOWER(?) OR LOWER(shared_with) = LOWER(?)", userEmail, "ROLE:"+userRole, "CLASS:"+currentUser.Class).
		Find(&shares)

	// Use anonymous structs so share_id is included in JSON without touching the GORM model
	type SharedFile struct {
		models.File
		ShareID uint `json:"share_id"`
	}
	type SharedFolder struct {
		models.Folder
		ShareID uint `json:"share_id"`
	}

	var files []SharedFile
	var folders []SharedFolder

	seenFiles := make(map[uint]bool)
	seenFolders := make(map[uint]bool)

	for _, s := range shares {
		if s.FileID != nil && s.File != nil {
			if !seenFiles[*s.FileID] {
				f := *s.File
				f.IsShared = true
				f.IsSpecial = getIsSpecial(f.UserID, s.File.User)
				if s.File.User.Role != "" {
					f.OwnerRole = s.File.User.Role
				} else if s.OwnerUser != nil {
					f.OwnerRole = s.OwnerUser.Role
				}
				if f.OwnerRole == "" {
					var u models.User
					if err := DB.Where("LOWER(id) = LOWER(?)", f.UserID).First(&u).Error; err == nil {
						f.OwnerRole = u.Role
					}
				}
				if s.OwnerUser != nil {
					if s.OwnerUser.FullName != "" {
						f.OwnerName = s.OwnerUser.FullName
					} else {
						f.OwnerName = s.SharedBy
					}
				} else {
					f.OwnerName = s.SharedBy
				}
				files = append(files, SharedFile{File: f, ShareID: s.ID})
				seenFiles[*s.FileID] = true
			}
		} else if s.FolderID != nil && s.Folder != nil {
			if !seenFolders[*s.FolderID] {
				f := *s.Folder
				f.IsShared = true
				f.IsSpecial = getIsSpecial(f.UserID, s.Folder.User)
				if s.Folder.User.Role != "" {
					f.OwnerRole = s.Folder.User.Role
				} else if s.OwnerUser != nil {
					f.OwnerRole = s.OwnerUser.Role
				}
				if f.OwnerRole == "" {
					var u models.User
					if err := DB.Where("LOWER(id) = LOWER(?)", f.UserID).First(&u).Error; err == nil {
						f.OwnerRole = u.Role
					}
				}
				if s.OwnerUser != nil {
					if s.OwnerUser.FullName != "" {
						f.OwnerName = s.OwnerUser.FullName
					} else {
						f.OwnerName = s.SharedBy
					}
				} else {
					f.OwnerName = s.SharedBy
				}
				folders = append(folders, SharedFolder{Folder: f, ShareID: s.ID})
				seenFolders[*s.FolderID] = true
			}
		}
	}

	if files == nil {
		files = []SharedFile{}
	}
	if folders == nil {
		folders = []SharedFolder{}
	}

	c.JSON(http.StatusOK, gin.H{
		"folders": folders,
		"files":   files,
	})
}


// ─────────────────────────────────────────────────────────────────────────────
// Public Link Feature

type TogglePublicReq struct {
	IsPublic         *bool      `json:"is_public"`
	PublicPassword   *string    `json:"public_password"`
	PublicExpiration *time.Time `json:"public_expiration"`
}

func ToggleFilePublic(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	fileID := c.Param("id")

	var file models.File
	if err := DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	var req TogglePublicReq
	if err := c.ShouldBindJSON(&req); err == nil {
		if req.IsPublic != nil {
			file.IsPublic = *req.IsPublic
		} else {
			file.IsPublic = !file.IsPublic
		}

		// Map empty string to null string
		if req.PublicPassword != nil {
			if *req.PublicPassword == "" {
				file.PublicPassword = nil
			} else {
				file.PublicPassword = req.PublicPassword
			}
		}
		file.PublicExpiration = req.PublicExpiration
	} else {
		// Fallback for empty body
		file.IsPublic = !file.IsPublic
	}

	if err := DB.Save(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update public status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated", "is_public": file.IsPublic})
}

func ToggleFolderPublic(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	folderID := c.Param("id")

	var folder models.Folder
	if err := DB.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
		return
	}

	var req TogglePublicReq
	if err := c.ShouldBindJSON(&req); err == nil {
		if req.IsPublic != nil {
			folder.IsPublic = *req.IsPublic
		} else {
			folder.IsPublic = !folder.IsPublic
		}

		if req.PublicPassword != nil {
			if *req.PublicPassword == "" {
				folder.PublicPassword = nil
			} else {
				folder.PublicPassword = req.PublicPassword
			}
		}
		folder.PublicExpiration = req.PublicExpiration
	} else {
		// Fallback for empty body
		folder.IsPublic = !folder.IsPublic
	}

	if err := DB.Save(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update public status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated", "is_public": folder.IsPublic})
}

func ViewPublicFileMetadata(c *gin.Context) {
	fileID := c.Param("id")
	var file models.File
	if err := DB.Preload("User").Where("id = ? AND is_public = ?", fileID, true).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found or not public"})
		return
	}

	// Check Expiration
	if file.PublicExpiration != nil && time.Now().After(*file.PublicExpiration) {
		c.JSON(http.StatusForbidden, gin.H{"error": "This link has expired"})
		return
	}

	// Handled Password protection on metadata route to require password before even getting metadata if desired, but
	// typically metadata is safe. But let's protect metadata to be strict if requested.
	// We check query string "pwd"
	if file.PublicPassword != nil {
		pwd := c.Query("pwd")
		if pwd != *file.PublicPassword {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Password required", "require_password": true})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         file.ID,
		"name":       file.Name,
		"size":       file.Size,
		"mime_type":  file.MimeType,
		"created_at": file.CreatedAt,
		"owner":      file.User.FullName,
		"type":       "file",
	})
}

func DownloadPublicFile(c *gin.Context) {
	fileID := c.Param("id")
	var file models.File
	if err := DB.Where("id = ? AND is_public = ?", fileID, true).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found or not public"})
		return
	}

	if file.PublicExpiration != nil && time.Now().After(*file.PublicExpiration) {
		c.JSON(http.StatusForbidden, gin.H{"error": "This link has expired"})
		return
	}

	if file.PublicPassword != nil {
		pwd := c.Query("pwd")
		if pwd != *file.PublicPassword {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Password required or incorrect password"})
			return
		}
	}

	c.Header("Content-Disposition", "inline; filename=\""+file.Name+"\"")
	c.Header("Content-Type", file.MimeType)
	c.File(file.Path)
}

func ViewPublicFolderMetadata(c *gin.Context) {
	folderID := c.Param("id")
	var folder models.Folder
	if err := DB.Preload("User").Where("id = ? AND is_public = ?", folderID, true).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found or not public"})
		return
	}

	if folder.PublicExpiration != nil && time.Now().After(*folder.PublicExpiration) {
		c.JSON(http.StatusForbidden, gin.H{"error": "This link has expired"})
		return
	}

	if folder.PublicPassword != nil {
		pwd := c.Query("pwd")
		if pwd != *folder.PublicPassword {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Password required", "require_password": true})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         folder.ID,
		"name":       folder.Name,
		"created_at": folder.CreatedAt,
		"owner":      folder.User.FullName,
		"type":       "folder",
	})
}

func DownloadPublicFolder(c *gin.Context) {
	folderIDStr := c.Param("id")

	var folder models.Folder
	if err := DB.Where("id = ? AND is_public = ?", folderIDStr, true).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found or not public"})
		return
	}

	if folder.PublicExpiration != nil && time.Now().After(*folder.PublicExpiration) {
		c.JSON(http.StatusForbidden, gin.H{"error": "This link has expired"})
		return
	}

	if folder.PublicPassword != nil {
		pwd := c.Query("pwd")
		if pwd != *folder.PublicPassword {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Password required or incorrect password"})
			return
		}
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", folder.Name))
	c.Header("Content-Type", "application/zip")

	zipWriter := zip.NewWriter(c.Writer)

	addFilesToZip(zipWriter, folder.ID, "")

	if err := zipWriter.Close(); err != nil {
		log.Printf("Error closing zip writer: %v", err)
	}
}
