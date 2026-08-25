package models

import (
	"time"

	"gorm.io/gorm"
)

// ChatBackup represents a BaknusChat message backup file stored in BaknusDrive
type ChatBackup struct {
	ID           string         `gorm:"primaryKey;type:varchar(255)" json:"backup_id"`
	UserID       string         `gorm:"type:varchar(255);index;not null" json:"user_id"`
	Filename     string         `gorm:"type:varchar(255);not null" json:"filename"`
	FilePath     string         `gorm:"type:text;not null" json:"-"`
	FileSize     int64          `gorm:"not null" json:"file_size"`
	BackupType   string         `gorm:"type:varchar(50);default:'auto'" json:"backup_type"`
	MessageCount int            `gorm:"default:0" json:"message_count"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}
