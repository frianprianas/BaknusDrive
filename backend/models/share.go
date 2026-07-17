package models

import (
	"time"
)

type Share struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	FileID     *uint     `json:"file_id"`
	FolderID   *uint     `json:"folder_id"`
	File       *File     `json:"file,omitempty"`
	Folder     *Folder   `json:"folder,omitempty"`
	SharedBy     string    `gorm:"not null" json:"shared_by"`
	SharedWith   string    `gorm:"not null" json:"shared_with"`
	IsBlindDrop  bool      `json:"is_blind_drop"` // if true, users can only see their own files inside
	CanEdit      *bool     `gorm:"default:true" json:"can_edit"`
	CanDownload  *bool     `gorm:"default:true" json:"can_download"`
	OwnerUser    *User     `gorm:"foreignKey:SharedBy;references:ID" json:"owner_user,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}
