package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

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
		Name:     GetUniqueFolderName(userID, req.ParentID, req.Name),
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

	// Admin has access to all folders
	if strings.ToLower(currentUser.Role) == "admin" {
		return true
	}

	currentFolderID := &folderID
	for currentFolderID != nil {
		var share models.Share
		if err := DB.Where("folder_id = ? AND (shared_with = ? OR shared_with = ? OR shared_with = ?)", *currentFolderID, currentUser.Email, "ROLE:"+currentUser.Role, "CLASS:"+currentUser.Class).First(&share).Error; err == nil {
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

func resolveOwnerRole(userID string, currentRole string) string {
	if currentRole != "" {
		return currentRole
	}
	var u models.User
	if err := DB.Where("LOWER(id) = LOWER(?)", userID).First(&u).Error; err == nil {
		return u.Role
	}
	return ""
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
		folders[i].OwnerRole = resolveOwnerRole(folders[i].UserID, folders[i].User.Role)
		var count int64
		DB.Model(&models.Share{}).Where("folder_id = ?", folders[i].ID).Count(&count)
		folders[i].IsShared = count > 0
	}
	for i := range files {
		if files[i].UserID != userID {
			files[i].OwnerName = files[i].User.FullName
		}
		files[i].OwnerRole = resolveOwnerRole(files[i].UserID, files[i].User.Role)
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
	var currentUser models.User
	DB.Where("id = ?", userID).First(&currentUser)
	isAdmin := strings.ToLower(currentUser.Role) == "admin"

	if isAdmin {
		if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
			return
		}
		goto proceedDownload
	}

	if err := DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		// If not owner, check if the file is shared with the user
		var currentUser models.User
		if errUser := DB.Where("id = ?", userID).First(&currentUser).Error; errUser == nil {
			var share models.Share
			if errShare := DB.Where("file_id = ? AND (shared_with = ? OR shared_with = ? OR shared_with = ?)", fileID, currentUser.Email, "ROLE:"+currentUser.Role, "CLASS:"+currentUser.Class).First(&share).Error; errShare == nil {
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

	// Get currentUser to check role
	var currentUser models.User
	DB.Where("id = ?", userID).First(&currentUser)
	isAdmin := strings.ToLower(currentUser.Role) == "admin"

	var file models.File
	query := DB.Where("id = ?", fileID)
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}

	if err := query.First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found or access denied"})
		return
	}

	if err := DB.Delete(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "File deleted successfully"})
}

func GetUniqueFileName(userID string, folderID *uint, name string) string {
	baseName := name
	extension := ""
	extIdx := -1
	for i := len(name) - 1; i >= 0; i-- {
		if name[i] == '.' {
			extIdx = i
			break
		}
	}

	if extIdx > 0 {
		baseName = name[:extIdx]
		extension = name[extIdx:]
	}

	finalName := name
	counter := 1
	for {
		var count int64
		query := DB.Model(&models.File{}).Where("name = ? AND user_id = ?", finalName, userID)
		if folderID != nil {
			query = query.Where("folder_id = ?", *folderID)
		} else {
			query = query.Where("folder_id IS NULL")
		}
		query.Count(&count)
		if count == 0 {
			break
		}
		finalName = fmt.Sprintf("%s (%d)%s", baseName, counter, extension)
		counter++
	}
	return finalName
}

func GetUniqueFolderName(userID string, parentID *uint, name string) string {
	finalName := name
	counter := 1
	for {
		var count int64
		query := DB.Model(&models.Folder{}).Where("name = ? AND user_id = ?", finalName, userID)
		if parentID != nil {
			query = query.Where("parent_id = ?", *parentID)
		} else {
			query = query.Where("parent_id IS NULL")
		}
		query.Count(&count)
		if count == 0 {
			break
		}
		finalName = fmt.Sprintf("%s (%d)", name, counter)
		counter++
	}
	return finalName
}

func ToggleFileStar(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	fileID := c.Param("id")

	var file models.File
	if err := DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	file.IsStarred = !file.IsStarred
	if err := DB.Save(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update star status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated", "is_starred": file.IsStarred})
}

func ToggleFolderStar(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	folderID := c.Param("id")

	var folder models.Folder
	if err := DB.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
		return
	}

	folder.IsStarred = !folder.IsStarred
	if err := DB.Save(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update star status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated", "is_starred": folder.IsStarred})
}

func ListStarred(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	var folders []models.Folder
	var files []models.File

	DB.Preload("User").Where("user_id = ? AND is_starred = ?", userID, true).Find(&folders)
	DB.Preload("User").Where("user_id = ? AND is_starred = ?", userID, true).Find(&files)

	for i := range folders {
		if folders[i].UserID != userID {
			folders[i].OwnerName = folders[i].User.FullName
		}
		folders[i].OwnerRole = resolveOwnerRole(folders[i].UserID, folders[i].User.Role)
		var count int64
		DB.Model(&models.Share{}).Where("folder_id = ?", folders[i].ID).Count(&count)
		folders[i].IsShared = count > 0
	}
	for i := range files {
		if files[i].UserID != userID {
			files[i].OwnerName = files[i].User.FullName
		}
		files[i].OwnerRole = resolveOwnerRole(files[i].UserID, files[i].User.Role)
		var count int64
		DB.Model(&models.Share{}).Where("file_id = ?", files[i].ID).Count(&count)
		files[i].IsShared = count > 0
	}

	c.JSON(http.StatusOK, gin.H{
		"folders": folders,
		"files":   files,
	})
}

func ListRecent(c *gin.Context) {
	userID := c.MustGet("userID").(string)

	var files []models.File

	// For recent, we fetch the latest updated files up to 50
	DB.Preload("User").
		Where("user_id = ?", userID).
		Order("updated_at desc").
		Limit(50).
		Find(&files)

	for i := range files {
		if files[i].UserID != userID {
			files[i].OwnerName = files[i].User.FullName
		}
		files[i].OwnerRole = resolveOwnerRole(files[i].UserID, files[i].User.Role)
		var count int64
		DB.Model(&models.Share{}).Where("file_id = ?", files[i].ID).Count(&count)
		files[i].IsShared = count > 0
	}

	c.JSON(http.StatusOK, gin.H{
		"folders": []models.Folder{}, // Typically we only show recent files, not folders, but keep format consistent.
		"files":   files,
	})
}

func SearchDrive(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	queryStr := c.Query("q")

	var folders []models.Folder
	var files []models.File

	if queryStr != "" {
		likeQuery := "%" + queryStr + "%"
		// Only search user's own items for now.
		// You could expand to search shared items as well if you join tables, but keeping it simple.
		DB.Preload("User").Where("user_id = ? AND name ILIKE ?", userID, likeQuery).Find(&folders)
		DB.Preload("User").Where("user_id = ? AND name ILIKE ?", userID, likeQuery).Find(&files)
	}

	for i := range folders {
		if folders[i].UserID != userID {
			folders[i].OwnerName = folders[i].User.FullName
		}
		folders[i].OwnerRole = resolveOwnerRole(folders[i].UserID, folders[i].User.Role)
		var count int64
		DB.Model(&models.Share{}).Where("folder_id = ?", folders[i].ID).Count(&count)
		folders[i].IsShared = count > 0
	}
	for i := range files {
		if files[i].UserID != userID {
			files[i].OwnerName = files[i].User.FullName
		}
		files[i].OwnerRole = resolveOwnerRole(files[i].UserID, files[i].User.Role)
		var count int64
		DB.Model(&models.Share{}).Where("file_id = ?", files[i].ID).Count(&count)
		files[i].IsShared = count > 0
	}

	c.JSON(http.StatusOK, gin.H{
		"folders": folders,
		"files":   files,
	})
}

func softDeleteFolderRecursive(folderID uint) {
	var files []models.File
	DB.Where("folder_id = ?", folderID).Find(&files)
	for _, f := range files {
		DB.Delete(&f)
	}

	var subfolders []models.Folder
	DB.Where("parent_id = ?", folderID).Find(&subfolders)
	for _, sf := range subfolders {
		softDeleteFolderRecursive(sf.ID)
		DB.Delete(&sf)
	}
}

func DeleteFolder(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	folderID := c.Param("id")

	// Get currentUser to check role
	var currentUser models.User
	DB.Where("id = ?", userID).First(&currentUser)
	isAdmin := strings.ToLower(currentUser.Role) == "admin"

	var folder models.Folder
	query := DB.Where("id = ?", folderID)
	if !isAdmin {
		query = query.Where("user_id = ?", userID)
	}

	if err := query.First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found or access denied"})
		return
	}

	if err := DB.Delete(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete folder"})
		return
	}

	softDeleteFolderRecursive(folder.ID)

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

	file.Name = GetUniqueFileName(userID, file.FolderID, req.Name)
	if err := DB.Save(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rename file"})
		return
	}

	c.JSON(http.StatusOK, file)
}

type CopyReq struct {
	TargetFolderID *uint `json:"target_folder_id"` // null means move to root
}

func CopyFile(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	fileID := c.Param("id")

	var req CopyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var file models.File
	if err := DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	if req.TargetFolderID != nil {
		var targetFolder models.Folder
		if err := DB.Where("id = ?", *req.TargetFolderID).First(&targetFolder).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Target folder not found"})
			return
		}
		if targetFolder.UserID != userID && !HasAccessToFolder(userID, *req.TargetFolderID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "No access to target folder"})
			return
		}
	}

	// Read old physical file
	sourceFile, err := os.Open(file.Path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read source file"})
		return
	}
	defer sourceFile.Close()

	// Verify Quota
	var currentUser models.User
	if err := DB.Where("id = ?", userID).First(&currentUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var totalSize int64
	DB.Model(&models.File{}).Where("user_id = ?", userID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

	if totalSize+file.Size > currentUser.Quota {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Kapasitas penyimpanan Anda sudah penuh."})
		return
	}

	userStoragePath := filepath.Join("storage", userID)
	os.MkdirAll(userStoragePath, os.ModePerm)

	safeFilename := fmt.Sprintf("%d_copy_%s", time.Now().UnixNano(), file.Name)
	savePath := filepath.Join(userStoragePath, safeFilename)

	destFile, err := os.Create(savePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create copied physical file"})
		return
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write copied data"})
		return
	}

	// Create new record
	newFile := models.File{
		Name:     GetUniqueFileName(userID, req.TargetFolderID, "Copy of "+file.Name),
		MimeType: file.MimeType,
		Size:     file.Size,
		Path:     savePath,
		FolderID: req.TargetFolderID,
		UserID:   userID,
	}

	if err := DB.Create(&newFile).Error; err != nil {
		os.Remove(savePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save copied file metadata"})
		return
	}

	// Update Quota
	DB.Model(&currentUser).Update("used_space", totalSize+file.Size)

	c.JSON(http.StatusOK, newFile)
}

func copyFolderRecursive(userID string, sourceFolderID uint, targetFolderID *uint, newFolderName string, currentSize *int64, quota int64) (uint, error) {
	var originalFolder models.Folder
	if err := DB.Where("id = ? AND user_id = ?", sourceFolderID, userID).First(&originalFolder).Error; err != nil {
		return 0, err
	}

	newFolder := models.Folder{
		Name:     newFolderName,
		ParentID: targetFolderID,
		UserID:   userID,
	}
	if err := DB.Create(&newFolder).Error; err != nil {
		return 0, err
	}

	var files []models.File
	DB.Where("folder_id = ? AND user_id = ?", sourceFolderID, userID).Find(&files)

	userStoragePath := filepath.Join("storage", userID)
	os.MkdirAll(userStoragePath, os.ModePerm)

	for _, file := range files {
		if *currentSize+file.Size > quota {
			return newFolder.ID, fmt.Errorf("quota exceeded")
		}

		sourceFile, err := os.Open(file.Path)
		if err != nil {
			continue
		}

		safeFilename := fmt.Sprintf("%d_copy_%s", time.Now().UnixNano(), file.Name)
		savePath := filepath.Join(userStoragePath, safeFilename)

		destFile, err := os.Create(savePath)
		if err != nil {
			sourceFile.Close()
			continue
		}

		if _, err := io.Copy(destFile, sourceFile); err == nil {
			newFile := models.File{
				Name:     file.Name,
				MimeType: file.MimeType,
				Size:     file.Size,
				Path:     savePath,
				FolderID: &newFolder.ID,
				UserID:   userID,
			}
			if DB.Create(&newFile).Error == nil {
				*currentSize += file.Size
			}
		}

		sourceFile.Close()
		destFile.Close()
	}

	var subfolders []models.Folder
	DB.Where("parent_id = ?", sourceFolderID).Find(&subfolders)
	for _, sf := range subfolders {
		_, err := copyFolderRecursive(userID, sf.ID, &newFolder.ID, sf.Name, currentSize, quota)
		if err != nil {
			return newFolder.ID, err
		}
	}

	return newFolder.ID, nil
}

func CopyFolder(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	folderIDStr := c.Param("id")

	folderID, err := strconv.Atoi(folderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var req CopyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var folder models.Folder
	if err := DB.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
		return
	}

	if req.TargetFolderID != nil {
		if *req.TargetFolderID == uint(folderID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot copy folder to itself"})
			return
		}
		// Also should technically check if target is a child of the folder being copied but it's okay for now.
		var targetFolder models.Folder
		if err := DB.Where("id = ?", *req.TargetFolderID).First(&targetFolder).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Target folder not found"})
			return
		}
		if targetFolder.UserID != userID && !HasAccessToFolder(userID, *req.TargetFolderID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "No access to target folder"})
			return
		}
	}

	var currentUser models.User
	if err := DB.Where("id = ?", userID).First(&currentUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	var totalSize int64
	DB.Model(&models.File{}).Where("user_id = ?", userID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

	newFolderName := GetUniqueFolderName(userID, req.TargetFolderID, "Copy of "+folder.Name)

	newFolderID, err := copyFolderRecursive(userID, uint(folderID), req.TargetFolderID, newFolderName, &totalSize, currentUser.Quota)

	DB.Model(&currentUser).Update("used_space", totalSize)

	if err != nil && err.Error() == "quota exceeded" {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Kapasitas penyimpanan Anda penuh, sebagian file mungkin tidak tersalin."})
		return
	}

	var returnedFolder models.Folder
	DB.Where("id = ?", newFolderID).First(&returnedFolder)

	c.JSON(http.StatusOK, returnedFolder)
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

	folder.Name = GetUniqueFolderName(userID, folder.ParentID, req.Name)
	if err := DB.Save(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rename folder"})
		return
	}

	c.JSON(http.StatusOK, folder)
}

type MoveReq struct {
	TargetFolderID *uint `json:"target_folder_id"` // null means move to root
}

func MoveFile(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	fileID := c.Param("id")

	var req MoveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var file models.File
	if err := DB.Where("id = ? AND user_id = ?", fileID, userID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	if req.TargetFolderID != nil {
		var targetFolder models.Folder
		if err := DB.Where("id = ?", *req.TargetFolderID).First(&targetFolder).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Target folder not found"})
			return
		}
		if targetFolder.UserID != userID && !HasAccessToFolder(userID, *req.TargetFolderID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "No access to target folder"})
			return
		}
	}

	file.FolderID = req.TargetFolderID
	if err := DB.Save(&file).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to move file"})
		return
	}

	c.JSON(http.StatusOK, file)
}

func MoveFolder(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	folderID := c.Param("id")

	var req MoveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var folder models.Folder
	if err := DB.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder not found"})
		return
	}

	if req.TargetFolderID != nil && *req.TargetFolderID == folder.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot move folder into itself"})
		return
	}

	if req.TargetFolderID != nil {
		var targetFolder models.Folder
		if err := DB.Where("id = ?", *req.TargetFolderID).First(&targetFolder).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Target folder not found"})
			return
		}
		if targetFolder.UserID != userID && !HasAccessToFolder(userID, *req.TargetFolderID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "No access to target folder"})
			return
		}
	}

	folder.ParentID = req.TargetFolderID
	if err := DB.Save(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to move folder"})
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

func restoreFolderRecursive(userID string, folderID uint) {
	DB.Unscoped().Model(&models.File{}).Where("folder_id = ? AND user_id = ?", folderID, userID).Update("deleted_at", nil)

	var subfolders []models.Folder
	DB.Unscoped().Where("parent_id = ? AND user_id = ?", folderID, userID).Find(&subfolders)
	for _, sf := range subfolders {
		restoreFolderRecursive(userID, sf.ID)
	}
	DB.Unscoped().Model(&models.Folder{}).Where("id = ? AND user_id = ?", folderID, userID).Update("deleted_at", nil)
}

func RestoreItem(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	itemType := c.Param("type") // "file" or "folder"
	itemID := c.Param("id")

	if itemType == "file" {
		DB.Unscoped().Model(&models.File{}).Where("id = ? AND user_id = ?", itemID, userID).Update("deleted_at", nil)
	} else if itemType == "folder" {
		folderIDInt, _ := strconv.Atoi(itemID)
		restoreFolderRecursive(userID, uint(folderIDInt))
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

func getFolderContentsRecursive(folderID uint, prefix string, promptBuilder *strings.Builder, depth int) {
	if depth > 5 { // Prevent deep recursion
		return
	}

	// Fetch files preloading user details
	var files []models.File
	DB.Preload("User").Where("folder_id = ?", folderID).Find(&files)
	for _, fl := range files {
		ownerDetails := fl.UserID
		if fl.User.FullName != "" {
			ownerDetails = fmt.Sprintf("%s (%s, Peran: %s)", fl.User.FullName, fl.UserID, fl.User.Role)
		}
		promptBuilder.WriteString(fmt.Sprintf("%s- %s (File, Pemilik/Pembuat: %s)\n", prefix, fl.Name, ownerDetails))
	}

	// Fetch subfolders preloading user details
	var subfolders []models.Folder
	DB.Preload("User").Where("parent_id = ?", folderID).Find(&subfolders)
	for _, sf := range subfolders {
		ownerDetails := sf.UserID
		if sf.User.FullName != "" {
			ownerDetails = fmt.Sprintf("%s (%s, Peran: %s)", sf.User.FullName, sf.UserID, sf.User.Role)
		}
		promptBuilder.WriteString(fmt.Sprintf("%s- %s/ (Folder, Pemilik/Pembuat: %s)\n", prefix, sf.Name, ownerDetails))
		getFolderContentsRecursive(sf.ID, prefix+"  ", promptBuilder, depth+1)
	}
}

func AnalyzeFolderAI(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	folderIDStr := c.Param("id")

	fid, err := strconv.ParseUint(folderIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
		return
	}
	folderID := uint(fid)

	// Verify access & preload creator user details
	var folder models.Folder
	if err := DB.Preload("User").Where("id = ?", folderID).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder tidak ditemukan"})
		return
	}

	if folder.UserID != userID && !HasAccessToFolder(userID, folderID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak"})
		return
	}

	// Fetch shares with OwnerUser preloaded to get official names
	var shares []models.Share
	DB.Preload("OwnerUser").Where("folder_id = ?", folderID).Find(&shares)

	// Formulate prompt
	var promptBuilder strings.Builder
	promptBuilder.WriteString("Sebagai asisten AI bernama BaknusAI, Anda wajib menganalisis data struktur folder berikut dan menampilkan hasilnya dalam format tabel Markdown yang rapi.\n\n")
	promptBuilder.WriteString("=== DATA FOLDER ===\n")
	promptBuilder.WriteString(fmt.Sprintf("Nama Folder Utama: %s\n", folder.Name))

	// Owner of the folder
	creatorName := folder.UserID
	if folder.User.FullName != "" {
		creatorName = fmt.Sprintf("%s (%s, Peran: %s)", folder.User.FullName, folder.UserID, folder.User.Role)
	}
	promptBuilder.WriteString(fmt.Sprintf("Pemilik Resmi / Pembuat Folder: %s\n", creatorName))

	promptBuilder.WriteString("\n=== DAFTAR HIERARKI SUBFOLDER & FILE ===\n")
	var hierarchyBuilder strings.Builder
	getFolderContentsRecursive(folderID, "", &hierarchyBuilder, 1)

	if hierarchyBuilder.Len() == 0 {
		promptBuilder.WriteString("- Folder ini kosong (tidak ada subfolder atau file)\n")
	} else {
		promptBuilder.WriteString(hierarchyBuilder.String())
	}

	promptBuilder.WriteString("\n=== DAFTAR BERBAGI/SHARING ===\n")
	if len(shares) == 0 {
		promptBuilder.WriteString("- Tidak dibagikan dengan siapa-siapa (hanya pemilik)\n")
	} else {
		for _, sh := range shares {
			roleOrEmail := sh.SharedWith
			if strings.HasPrefix(roleOrEmail, "ROLE:") {
				roleOrEmail = "Grup " + strings.TrimPrefix(roleOrEmail, "ROLE:")
			} else if strings.HasPrefix(roleOrEmail, "CLASS:") {
				roleOrEmail = "Kelas " + strings.TrimPrefix(roleOrEmail, "CLASS:")
			}

			sharerName := sh.SharedBy
			if sh.OwnerUser != nil && sh.OwnerUser.FullName != "" {
				sharerName = fmt.Sprintf("%s (%s, Peran: %s)", sh.OwnerUser.FullName, sh.SharedBy, sh.OwnerUser.Role)
			}
			promptBuilder.WriteString(fmt.Sprintf("- Dibagikan dengan: %s (Oleh: %s)\n", roleOrEmail, sharerName))
		}
	}

	promptBuilder.WriteString("\n=== INSTRUKSI STRUKTUR JAWABAN ===\n")
	promptBuilder.WriteString("Tampilkan respon Anda dengan susunan wajib berikut:\n")
	promptBuilder.WriteString("1. **Pembuat/Pemilik Resmi Folder**: Tuliskan nama lengkap resmi pembuat folder beserta email dan perannya secara jelas di bagian paling atas dengan format tebal.\n")
	promptBuilder.WriteString("2. **Tabel Struktur & Kepemilikan**: Buat sebuah tabel Markdown dengan kolom: `Tipe` (Folder/File), `Nama Item`, `Pemilik/Pembuat`, `Status Berbagi` (Dibagikan dengan siapa saja). Masukkan semua file (seperti file docx, pdf, xlsx, dll.) dan subfolder ke dalam tabel ini beserta pemilik resminya.\n")
	promptBuilder.WriteString("3. **Ringkasan Analisis**: Tulis 2-3 kalimat penjelasan ringkas tentang isi folder ini.\n")
	promptBuilder.WriteString("PENTING: Gunakan Bahasa Indonesia yang ramah, sopan, dan profesional. Pastikan format tabel Markdown Anda valid dan rapi agar mudah dibaca.\n")

	// Call local Ollama AI
	// URL: http://192.168.100.129:11434/api/generate
	// Method: POST
	// Body: {"model": "gemma2:9b", "prompt": "<prompt>", "stream": false}
	type OllamaRequest struct {
		Model  string `json:"model"`
		Prompt string `json:"prompt"`
		Stream bool   `json:"stream"`
	}

	ollamaReq := OllamaRequest{
		Model:  "gemma2:9b",
		Prompt: promptBuilder.String(),
		Stream: false,
	}

	jsonBytes, err := json.Marshal(ollamaReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses request AI"})
		return
	}

	// Create client with timeout to prevent hanging
	client := &http.Client{
		Timeout: 5 * time.Minute,
	}

	resp, err := client.Post("http://192.168.100.129:11434/api/generate", "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		log.Printf("Error calling local Ollama: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Tidak dapat terhubung ke server BaknusAI (%v). Pastikan server Ollama aktif.", err)})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Server BaknusAI mengembalikan status error: %d", resp.StatusCode)})
		return
	}

	type OllamaResponse struct {
		Response string `json:"response"`
	}

	var ollamaResp OllamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca respon dari BaknusAI"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"analysis": ollamaResp.Response,
	})
}

func SaveAIAnalysis(c *gin.Context) {
	userID := c.MustGet("userID").(string)
	folderIDStr := c.Param("id")

	fid, err := strconv.ParseUint(folderIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid folder ID"})
		return
	}
	folderID := uint(fid)

	// Verify access
	var folder models.Folder
	if err := DB.Where("id = ?", folderID).First(&folder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Folder tidak ditemukan"})
		return
	}

	if folder.UserID != userID && !HasAccessToFolder(userID, folderID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses ditolak"})
		return
	}

	type SaveReq struct {
		Analysis string `json:"analysis" binding:"required"`
	}
	var req SaveReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	userStoragePath := filepath.Join("storage", userID)
	os.MkdirAll(userStoragePath, os.ModePerm)

	// Clean folder name to use in filename
	cleanFolderName := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == ' ' {
			return r
		}
		return -1
	}, folder.Name)
	cleanFolderName = strings.TrimSpace(cleanFolderName)
	if cleanFolderName == "" {
		cleanFolderName = "Folder"
	}

	fileName := fmt.Sprintf("Analisis_BaknusAI_%s.md", cleanFolderName)
	safeFilename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), fileName)
	savePath := filepath.Join(userStoragePath, safeFilename)

	if err := os.WriteFile(savePath, []byte(req.Analysis), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file ke storage"})
		return
	}

	fileRecord := models.File{
		Name:     fileName,
		MimeType: "text/markdown",
		Size:     int64(len(req.Analysis)),
		Path:     savePath,
		FolderID: &folderID,
		UserID:   userID,
	}

	if err := DB.Create(&fileRecord).Error; err != nil {
		os.Remove(savePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan metadata file ke database"})
		return
	}

	c.JSON(http.StatusOK, fileRecord)
}
