package main

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"baknusdrive/models"

	"github.com/gin-gonic/gin"
)

type AttendPayload struct {
	NIS        string `json:"NIS" form:"NIS"`
	Nama       string `json:"Nama" form:"Nama"`
	Kelas      string `json:"kelas" form:"kelas"`
	Role       string `json:"role" form:"role"` // guru, TU, siswa
	WaktuTap   string `json:"waktu_tap" form:"waktu_tap"`
	Status     string `json:"status" form:"status"`
	Keterangan string `json:"keterangan" form:"keterangan"`
}

func EnsureAttendFolders(adminUser models.User, role, kelas string) (*models.Folder, error) {
	// Root Folder: Kehadiran
	var kehadiranFolder models.Folder
	err := DB.Where("name = ? AND user_id = ? AND parent_id IS NULL", "Kehadiran", adminUser.ID).First(&kehadiranFolder).Error
	if err != nil {
		kehadiranFolder = models.Folder{
			Name:   "Kehadiran",
			UserID: adminUser.ID,
		}
		if err := DB.Create(&kehadiranFolder).Error; err != nil {
			return nil, err
		}
	}

	// Share to Guru
	var shareGuru models.Share
	if err := DB.Where("folder_id = ? AND shared_with = ?", kehadiranFolder.ID, "ROLE:Guru").First(&shareGuru).Error; err != nil {
		newShareGuru := models.Share{
			FolderID:   &kehadiranFolder.ID,
			SharedBy:   adminUser.ID,
			SharedWith: "ROLE:Guru",
		}
		DB.Create(&newShareGuru)
	}

	// Share to TU
	var shareTu models.Share
	if err := DB.Where("folder_id = ? AND shared_with = ?", kehadiranFolder.ID, "ROLE:TU").First(&shareTu).Error; err != nil {
		newShareTu := models.Share{
			FolderID:   &kehadiranFolder.ID,
			SharedBy:   adminUser.ID,
			SharedWith: "ROLE:TU",
		}
		DB.Create(&newShareTu)
	}

	// guru_TU folder
	var guruTuFolder models.Folder
	if err := DB.Where("name = ? AND user_id = ? AND parent_id = ?", "guru_TU", adminUser.ID, kehadiranFolder.ID).First(&guruTuFolder).Error; err != nil {
		guruTuFolder = models.Folder{
			Name:     "guru_TU",
			ParentID: &kehadiranFolder.ID,
			UserID:   adminUser.ID,
		}
		DB.Create(&guruTuFolder)
	}

	// Siswa folder
	var siswaFolder models.Folder
	if err := DB.Where("name = ? AND user_id = ? AND parent_id = ?", "Siswa", adminUser.ID, kehadiranFolder.ID).First(&siswaFolder).Error; err != nil {
		siswaFolder = models.Folder{
			Name:     "Siswa",
			ParentID: &kehadiranFolder.ID,
			UserID:   adminUser.ID,
		}
		DB.Create(&siswaFolder)
	}

	// Target folder based on role
	var targetFolder models.Folder
	roleLower := strings.ToLower(role)

	if roleLower == "guru" {
		if err := DB.Where("name = ? AND user_id = ? AND parent_id = ?", "guru", adminUser.ID, guruTuFolder.ID).First(&targetFolder).Error; err != nil {
			targetFolder = models.Folder{
				Name:     "guru",
				ParentID: &guruTuFolder.ID,
				UserID:   adminUser.ID,
			}
			DB.Create(&targetFolder)
		}
	} else if roleLower == "tu" {
		if err := DB.Where("name = ? AND user_id = ? AND parent_id = ?", "TU", adminUser.ID, guruTuFolder.ID).First(&targetFolder).Error; err != nil {
			targetFolder = models.Folder{
				Name:     "TU",
				ParentID: &guruTuFolder.ID,
				UserID:   adminUser.ID,
			}
			DB.Create(&targetFolder)
		}
	} else { // default to siswa
		if kelas == "" {
			kelas = "Tanpa Kelas"
		}
		if err := DB.Where("name = ? AND user_id = ? AND parent_id = ?", kelas, adminUser.ID, siswaFolder.ID).First(&targetFolder).Error; err != nil {
			targetFolder = models.Folder{
				Name:     kelas,
				ParentID: &siswaFolder.ID,
				UserID:   adminUser.ID,
			}
			DB.Create(&targetFolder)
		}
	}

	return &targetFolder, nil
}

func UploadAttend(c *gin.Context) {
	apiKey := c.GetHeader("X-Attend-API-Key")
	if apiKey != "BAKNUS_ATTEND_SECRET" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid API Key"})
		return
	}

	var adminUser models.User
	if err := DB.Where("role = ?", "Admin").First(&adminUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Admin user not found in system"})
		return
	}

	var payload AttendPayload
	if err := c.ShouldBind(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	role := payload.Role
	if role == "" {
		if strings.ToLower(payload.Kelas) == "guru" {
			role = "guru"
		} else if strings.ToLower(payload.Kelas) == "tu" {
			role = "TU"
		} else {
			role = "siswa"
		}
	}

	targetFolder, err := EnsureAttendFolders(adminUser, role, payload.Kelas)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create/ensure folder structure"})
		return
	}

	fileName := fmt.Sprintf("%s.csv", time.Now().Format("2006-01-02")) // format: YYYY-MM-DD.csv

	var fileRecord models.File
	exists := DB.Where("name = ? AND user_id = ? AND folder_id = ?", fileName, adminUser.ID, targetFolder.ID).First(&fileRecord).Error == nil

	userStoragePath := filepath.Join("storage", adminUser.ID)
	os.MkdirAll(userStoragePath, os.ModePerm)

	var savePath string
	if exists {
		savePath = fileRecord.Path
	} else {
		safeFilename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), fileName)
		savePath = filepath.Join(userStoragePath, safeFilename)
	}

	appendMode := os.O_APPEND | os.O_WRONLY
	if !exists {
		appendMode = os.O_CREATE | appendMode
	}

	f, err := os.OpenFile(savePath, appendMode, 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open physical file"})
		return
	}
	defer f.Close()

	if !exists {
		f.WriteString("NIS,Nama,kelas,waktu_tap,status,keterangan\n")
	}

	record := []string{payload.NIS, payload.Nama, payload.Kelas, payload.WaktuTap, payload.Status, payload.Keterangan}
	csvWriter := csv.NewWriter(f)
	if err := csvWriter.Write(record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write csv data"})
		return
	}
	csvWriter.Flush()

	fi, err := os.Stat(savePath)
	var newSize int64
	if err == nil {
		newSize = fi.Size()
	}

	var totalSize int64
	DB.Model(&models.File{}).Where("user_id = ?", adminUser.ID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

	if exists {
		// Calculate the size difference to update user's used_space
		sizeDiff := newSize - fileRecord.Size
		fileRecord.Size = newSize
		DB.Save(&fileRecord)

		DB.Model(&adminUser).Update("used_space", totalSize+sizeDiff)
		c.JSON(http.StatusOK, gin.H{"message": "Attendance recorded successfully", "file": fileRecord, "folder_id": targetFolder.ID})
	} else {
		newFile := models.File{
			Name:     fileName,
			MimeType: "text/csv",
			Size:     newSize,
			Path:     savePath,
			FolderID: &targetFolder.ID,
			UserID:   adminUser.ID,
		}
		if err := DB.Create(&newFile).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file metadata"})
			return
		}
		DB.Model(&adminUser).Update("used_space", totalSize+newSize)
		c.JSON(http.StatusOK, gin.H{"message": "Attendance file created, and data recorded successfully", "file": newFile, "folder_id": targetFolder.ID})
	}
}
