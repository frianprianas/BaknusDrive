package models

import (
	"time"

	"gorm.io/gorm"
)

// File represents an uploaded file metadata
type File struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	Name             string         `gorm:"not null" json:"name"`
	MimeType         string         `gorm:"not null" json:"mime_type"`
	Size             int64          `gorm:"not null" json:"size"`
	Path             string         `gorm:"not null" json:"-"` // physical path on disk/S3
	FolderID         *uint          `json:"folder_id"`         // null if root
	DeviceID         *uint          `json:"device_id"`         // null if not part of a computer sync
	UserID           string         `gorm:"not null" json:"user_id"`
	User             User           `json:"-"`
	OwnerName        string         `gorm:"-" json:"owner_name,omitempty"`
	IsShared         bool           `gorm:"-" json:"is_shared,omitempty"`
	ShareID          *uint          `gorm:"-" json:"share_id,omitempty"`
	IsStarred        bool           `gorm:"default:false" json:"is_starred"`
	IsPublic         bool           `gorm:"default:false" json:"is_public"`
	PublicPassword   *string        `json:"public_password,omitempty"`   // null if no password
	PublicExpiration *time.Time     `json:"public_expiration,omitempty"` // null if no expiration
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}
