package main

import (
	"baknusdrive/models"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// WopiCheckFileInfo provides file metadata for Collabora Online.
func WopiCheckFileInfo(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		log.Printf("[WOPI] CheckFileInfo: File not found %d", fileID)
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	var user models.User
	DB.Where("id = ?", file.UserID).First(&user)

	info, err := os.Stat(file.Path)
	if err != nil {
		log.Printf("[WOPI] CheckFileInfo: Physical file missing %s", file.Path)
		c.JSON(http.StatusNotFound, gin.H{"error": "Physical file missing"})
		return
	}

	resp := gin.H{
		"BaseFileName":            file.Name,
		"OwnerId":                 file.UserID,
		"Size":                    info.Size(),
		"UserId":                  file.UserID,
		"Version":                 fmt.Sprintf("%d", file.UpdatedAt.Unix()),
		"UserFriendlyName":        user.FullName,
		"UserCanWrite":            true,
		"SupportsUpdate":          true,
		"UserCanNotWriteRelative": true,
	}

	c.JSON(http.StatusOK, resp)
}

// WopiGetFile provides file content for Collabora Online.
func WopiGetFile(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

	var file models.File
	if err := DB.Where("id = ?", fileID).First(&file).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	fileBytes, err := os.ReadFile(file.Path)
	if err != nil {
		log.Printf("[WOPI] GetFile error reading %s: %v", file.Path, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot read file"})
		return
	}

	c.Data(http.StatusOK, "application/octet-stream", fileBytes)
}

// WopiPutFile receives updated file content from Collabora Online.
func WopiPutFile(c *gin.Context) {
	fileIDStr := c.Param("file_id")
	fileID, _ := strconv.Atoi(fileIDStr)

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
		err = os.WriteFile(file.Path, bodyBytes, 0644)
		if err != nil {
			log.Printf("[WOPI] PutFile error saving %s: %v", file.Path, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot save file"})
			return
		}

		file.Size = int64(len(bodyBytes))
		file.UpdatedAt = time.Now()
		DB.Save(&file)
	}

	c.Status(http.StatusOK)
}

func WopiRouter(r *gin.Engine) {
	wopi := r.Group("/wopi")

	wopi.GET("/files/:file_id", WopiCheckFileInfo)
	wopi.GET("/files/:file_id/contents", WopiGetFile)
	wopi.POST("/files/:file_id/contents", WopiPutFile)
}
