package main

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"baknusdrive/models"

	"log"
	"time"

	"github.com/gin-gonic/gin"
)

type CreateFolderReq struct {
	Name     string `json:"name" binding:"required"`
	ParentID *uint  `json:"parent_id"` // Optional
	DeviceID *uint  `json:"device_id"` // Optional (for computer sync)
}

func CreateFolder(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	var req CreateFolderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if req.ParentID != nil {
		var parentFolder models.Folder
		if err := DB.Where("id = ?", *req.ParentID).First(&parentFolder).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Parent folder not found"})
			return
		}
		if parentFolder.UserID != userID && !HasAccessToFolder(userID, *req.ParentID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to create folders here"})
			return
		}
	}

	folder := models.Folder{
		Name:     req.Name,
		ParentID: req.ParentID,
		UserID:   userID,
		DeviceID: req.DeviceID,
	}

	if err := DB.Create(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create folder"})
		return
	}

	c.JSON(http.StatusOK, folder)
}

func HasAccessToFolder(userID string, folderID uint) bool {
	var currentUser models.User
	if err := DB.Where("id = ?", userID).First(&currentUser).Error; err != nil {
		return false
	}

	currentFolderID := &folderID
	for currentFolderID != nil {
		var share models.Share
		if err := DB.Where("folder_id = ? AND (shared_with = ? OR shared_with = ?)", *currentFolderID, currentUser.Email, "ROLE:"+currentUser.Role).First(&share).Error; err == nil {
			return true
		}

		var folder models.Folder
		if err := DB.Where("id = ?", *currentFolderID).First(&folder).Error; err != nil || folder.ParentID == nil {
			break
		}
		currentFolderID = folder.ParentID
	}
	return false
}

func ListDrive(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	deviceIDStr := c.Query("device_id")
	parentIDStr := c.Query("parent_id")

	var folders []models.Folder
	var files []models.File

	if parentIDStr != "" && parentIDStr != "null" {
		parentID, err := strconv.Atoi(parentIDStr)
		if err == nil {
			pid := uint(parentID)

			// Verify ownership OR recursive shared access
			var parentFolder models.Folder
			if err := DB.Where("id = ?", pid).First(&parentFolder).Error; err == nil {
				if parentFolder.UserID == userID || HasAccessToFolder(userID, pid) {
					DB.Preload("User").Where("parent_id = ?", pid).Find(&folders)
					DB.Preload("User").Where("folder_id = ?", pid).Find(&files)
				} else {
					c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
					return
				}
			} else {
				c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
				return
			}
		}
	} else if deviceIDStr != "" && deviceIDStr != "null" {
		deviceID, err := strconv.Atoi(deviceIDStr)
		if err == nil {
			did := uint(deviceID)
			DB.Preload("User").Where("user_id = ? AND device_id = ? AND parent_id IS NULL", userID, did).Find(&folders)
			DB.Preload("User").Where("user_id = ? AND device_id = ? AND folder_id IS NULL", userID, did).Find(&files)
		}
	} else {
		DB.Preload("User").Where("user_id = ? AND parent_id IS NULL AND device_id IS NULL", userID).Find(&folders)
		DB.Preload("User").Where("user_id = ? AND folder_id IS NULL AND device_id IS NULL", userID).Find(&files)
	}

	for i := range folders {
		if folders[i].UserID != userID {
			folders[i].OwnerName = folders[i].User.FullName
		}
		var count int64
		DB.Model(&models.Share{}).Where("folder_id = ?", folders[i].ID).Count(&count)
		folders[i].IsShared = count > 0
	}
	for i := range files {
		if files[i].UserID != userID {
			files[i].OwnerName = files[i].User.FullName
		}
		var count int64
		DB.Model(&models.Share{}).Where("file_id = ?", files[i].ID).Count(&count)
		files[i].IsShared = count > 0
	}

	c.JSON(http.StatusOK, gin.H{
		"folders": folders,
		"files":   files,
	})
}

func UploadFile(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	parentIDStr := c.PostForm("folder_id")
	deviceIDStr := c.PostForm("device_id")

	var folderID *uint
	if parentIDStr != "" && parentIDStr != "null" {
		pid, err := strconv.Atoi(parentIDStr)
		if err == nil {
			val := uint(pid)
			folderID = &val
		}
	}

	var deviceID *uint
	if deviceIDStr != "" && deviceIDStr != "null" {
		did, err := strconv.Atoi(deviceIDStr)
		if err == nil {
			val := uint(did)
			deviceID = &val
		}
	}

	if folderID != nil {
		var parentFolder models.Folder
		if err := DB.Where("id = ?", *folderID).First(&parentFolder).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Target folder not found"})
			return
		}
		if parentFolder.UserID != userID && !HasAccessToFolder(userID, *folderID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to upload files here"})
			return
		}
	}

	// Overwrite logic: if a file with the same name exists in same folder, replace it.
	var oldFile models.File
	query := DB.Where("name = ? AND user_id = ?", fileHeader.Filename, userID)
	if folderID != nil {
		query = query.Where("folder_id = ?", *folderID)
	} else {
		query = query.Where("folder_id IS NULL")
	}

	exists := query.First(&oldFile).Error == nil

	// Verify Quota
	var currentUser models.User
	if err := DB.Where("id = ?", userID).First(&currentUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var totalSize int64
	DB.Model(&models.File{}).Where("user_id = ?", userID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

	sizeDiff := fileHeader.Size
	if exists {
		sizeDiff -= oldFile.Size
	}

	if totalSize+sizeDiff > currentUser.Quota {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Kapasitas penyimpanan Anda sudah penuh."})
		return
	}

	// Create physical directory for user if it doesn't exist
	userStoragePath := filepath.Join("storage", userID)
	os.MkdirAll(userStoragePath, os.ModePerm)

	// Generate safe filename to avoid conflicts (but consistent if overwriting)
	safeFilename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), fileHeader.Filename)
	savePath := filepath.Join(userStoragePath, safeFilename)

	if err := c.SaveUploadedFile(fileHeader, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save physical file"})
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	if exists {
		// Remove old physical file
		os.Remove(oldFile.Path)
		// Update record
		oldFile.Size = fileHeader.Size
		oldFile.Path = savePath
		oldFile.MimeType = mimeType
		oldFile.DeviceID = deviceID
		if err := DB.Save(&oldFile).Error; err != nil {
			os.Remove(savePath) // rollback
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update file metadata"})
			return
		}
		// Update UsedSpace
		DB.Model(&currentUser).Update("used_space", totalSize+sizeDiff)
		c.JSON(http.StatusOK, oldFile)
	} else {
		fileRecord := models.File{
			Name:     fileHeader.Filename,
			MimeType: mimeType,
			Size:     fileHeader.Size,
			Path:     savePath,
			FolderID: folderID,
			UserID:   userID,
			DeviceID: deviceID,
		}
		if err := DB.Create(&fileRecord).Error; err != nil {
			os.Remove(savePath) // rollback
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file metadata"})
			return
		}
		// Update UsedSpace
		DB.Model(&currentUser).Update("used_space", totalSize+fileHeader.Size)
		c.JSON(http.StatusOK, fileRecord)
	}
}

func DownloadFile(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	fileID := c.Param("id")

	var file models.File
	if err := DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		// If not owner, check if the file is shared with the user
		var currentUser models.User
		if errUser := DB.Where("id = ?", userID).First(&currentUser).Error; errUser == nil {
			var share models.Share
			if errShare := DB.Where("file_id = ? AND (shared_with = ? OR shared_with = ?)", fileID, currentUser.Email, "ROLE:"+currentUser.Role).First(&share).Error; errShare == nil {
				// File is directly shared
				if errSharedItem := DB.Where("id = ?", fileID).First(&file).Error; errSharedItem == nil {
					goto proceedDownload
				}
			} else {
				// File might be inside a shared folder, evaluate its parent
				if errFileDetails := DB.Where("id = ?", fileID).First(&file).Error; errFileDetails == nil && file.FolderID != nil {
					if HasAccessToFolder(userID, *file.FolderID) {
						goto proceedDownload
					}
				}
			}
		}

		c.JSON(http.StatusNotFound, gin.H{"error": "File not found or access denied"})
		return
	}

proceedDownload:
	c.Header("Content-Disposition", "inline; filename=\""+file.Name+"\"")
	c.File(file.Path)
}

func addFilesToZip(zipWriter *zip.Writer, folderID uint, currentPath string) error {
	var files []models.File
	if err := DB.Where("folder_id = ?", folderID).Find(&files).Error; err == nil {
		for _, file := range files {
			f, err := os.Open(file.Path)
			if err != nil {
				continue
			}

			w, err := zipWriter.Create(filepath.Join(currentPath, file.Name))
			if err != nil {
				f.Close()
				continue
			}
			io.Copy(w, f)
			f.Close()
		}
	}

	var subFolders []models.Folder
	if err := DB.Where("parent_id = ?", folderID).Find(&subFolders).Error; err == nil {
		for _, subFolder := range subFolders {
			subFolderPath := filepath.Join(currentPath, subFolder.Name)
			// Add empty folder entry
			zipWriter.Create(subFolderPath + "/")
			addFilesToZip(zipWriter, subFolder.ID, subFolderPath)
		}
	}
	return nil
}

func DownloadFolder(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	folderIDStr := c.Param("id")

	folderID, err := strconv.Atoi(folderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
		return
	}

	fid := uint(folderID)
	var folder models.Folder
	if err := DB.Where("id = ?", fid).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
		return
	}

	// Verify access
	if folder.UserID != userID && !HasAccessToFolder(userID, fid) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Set headers for zip stream
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.zip\"", folder.Name))
	c.Header("Content-Type", "application/zip")

	zipWriter := zip.NewWriter(c.Writer)

	// Ensure the parent directory itself acts as root or its contents act as root.
	// We will package the contents of the folder into the root of the zip.
	addFilesToZip(zipWriter, fid, "")

	if err := zipWriter.Close(); err != nil {
		log.Printf("Error closing zip writer: %v", err)
	}
}

func DeleteFile(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	fileID := c.Param("id")

	var file models.File
	if err := DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	if err := DB.Delete(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "File deleted successfully"})
}

func DeleteFolder(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	folderID := c.Param("id")

	var folder models.Folder
	if err := DB.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
		return
	}

	if err := DB.Delete(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete folder"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Folder deleted successfully"})
}

type RenameReq struct {
	Name string `json:"name" binding:"required"`
}

func RenameFile(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	fileID := c.Param("id")

	var req RenameReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var file models.File
	if err := DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	file.Name = req.Name
	if err := DB.Save(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rename file"})
		return
	}

	c.JSON(http.StatusOK, file)
}

func RenameFolder(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	folderID := c.Param("id")

	var req RenameReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var folder models.Folder
	if err := DB.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
		return
	}

	folder.Name = req.Name
	if err := DB.Save(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rename folder"})
		return
	}

	c.JSON(http.StatusOK, folder)
}

func ListTrash(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	var folders []models.Folder
	var files []models.File

	DB.Unscoped().Where("user_id = ? AND deleted_at IS NOT NULL", userID).Find(&folders)
	DB.Unscoped().Where("user_id = ? AND deleted_at IS NOT NULL", userID).Find(&files)

	c.JSON(http.StatusOK, gin.H{
		"folders": folders,
		"files":   files,
	})
}

func RestoreItem(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	itemType := c.Param("type") // "file" or "folder"
	itemID := c.Param("id")

	if itemType == "file" {
		DB.Unscoped().Model(&models.File{}).Where("id = ? AND user_id = ?", itemID, userID).Update("deleted_at", nil)
	} else if itemType == "folder" {
		DB.Unscoped().Model(&models.Folder{}).Where("id = ? AND user_id = ?", itemID, userID).Update("deleted_at", nil)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid type"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item restored"})
}

func EmptyTrash(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	var files []models.File
	DB.Unscoped().Where("user_id = ? AND deleted_at IS NOT NULL", userID).Find(&files)

	for _, f := range files {
		os.Remove(f.Path)
	}

	DB.Unscoped().Where("user_id = ? AND deleted_at IS NOT NULL", userID).Delete(&models.File{})
	DB.Unscoped().Where("user_id = ? AND deleted_at IS NOT NULL", userID).Delete(&models.Folder{})

	c.JSON(http.StatusOK, gin.H{"message": "Trash emptied"})
}

func GetStorageQuota(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	var currentUser models.User
	if err := DB.Where("id = ?", userID).First(&currentUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var totalSize int64
	DB.Model(&models.File{}).Where("user_id = ?", userID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

	// Perbarui db cache if necessary (tapi gak harus, ini buat memastikan cache uptodate aja)
	DB.Model(&currentUser).Update("used_space", totalSize)

	c.JSON(http.StatusOK, gin.H{
		"used":  totalSize,
		"quota": currentUser.Quota,
	})
}

func ListDevices(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	var devices []models.Device
	DB.Where("user_id = ?", userID).Find(&devices)
	c.JSON(http.StatusOK, devices)
}

func RegisterDevice(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	var req struct {
		Name      string `json:"name" binding:"required"`
		OS        string `json:"os"`
		IPAddress string `json:"ip_address"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var device models.Device
	// Upsert based on Name and UserID (or could use a Hardware ID if available)
	err := DB.Where("user_id = ? AND name = ?", userID, req.Name).First(&device).Error
	if err != nil {
		// New device
		device = models.Device{
			Name:      req.Name,
			OS:        req.OS,
			UserID:    userID,
			IPAddress: req.IPAddress,
			LastSync:  time.Now(),
		}
		if err := DB.Create(&device).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register device"})
			return
		}
	} else {
		// Update existing device
		device.OS = req.OS
		device.IPAddress = req.IPAddress
		device.LastSync = time.Now()
		DB.Save(&device)
	}

	c.JSON(http.StatusOK, device)
}
