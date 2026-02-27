package models

import (
	"time"

	"gorm.io/gorm"
)

// Folder represents a directory created by a User
type Folder struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"not null" json:"name"`
	ParentID  *uint          `json:"parent_id"` // null if root
	UserID    string         `gorm:"not null" json:"user_id"`
	User      User           `json:"-"`
	OwnerName string         `gorm:"-" json:"owner_name,omitempty"`
	IsShared  bool           `gorm:"-" json:"is_shared,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
