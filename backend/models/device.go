package models

import (
	"time"

	"gorm.io/gorm"
)

type Device struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"not null" json:"name"` // e.g. "Laptop-Kece", "PC-Lab-A"
	OS        string         `json:"os"`                   // e.g. "Windows 11", "macOS"
	UserID    string         `gorm:"not null" json:"user_id"`
	User      User           `json:"-"`
	IPAddress string         `json:"ip_address"`
	LastSync  time.Time      `json:"last_sync"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
