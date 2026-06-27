package models

import (
	"time"

	"gorm.io/gorm"
)

// Folder represents a directory created by a User
type Folder struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	Name             string         `gorm:"not null" json:"name"`
	ParentID         *uint          `json:"parent_id"` // null if root
	DeviceID         *uint          `json:"device_id"` // null if not part of a computer sync
	UserID           string         `gorm:"not null" json:"user_id"`
	User             User           `json:"-"`
	OwnerName        string         `gorm:"-" json:"owner_name,omitempty"`
	OwnerRole        string         `gorm:"-" json:"owner_role,omitempty"`
	IsShared         bool           `gorm:"-" json:"is_shared,omitempty"`
	IsSpecial        bool           `gorm:"-" json:"is_special,omitempty"`
	IsStarred        bool           `gorm:"default:false" json:"is_starred"`
	IsPublic         bool           `gorm:"default:false" json:"is_public"`
	PublicPassword   *string        `json:"public_password,omitempty"`   // null if no password
	PublicExpiration *time.Time     `json:"public_expiration,omitempty"` // null if no expiration
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}
