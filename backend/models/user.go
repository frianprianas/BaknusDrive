package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a Mailcow account synced to BaknusDrive
type User struct {
	ID        string         `gorm:"primaryKey;type:varchar(255)" json:"id"` // This will be the email address
	Email     string         `gorm:"uniqueIndex;not null" json:"email"`
	FullName  string         `gorm:"not null" json:"full_name"`
	Role      string         `gorm:"default:'Siswa'" json:"role"`     // Maps to Mailcow Tag
	Class     string         `gorm:"type:varchar(50)" json:"class"`   // Stores the student's class (e.g. X RPL 2)
	Quota     int64          `gorm:"default:5368709120" json:"quota"` // Default 5GB
	UsedSpace int64          `gorm:"default:0" json:"used_space"`
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	WhatsApp  string         `gorm:"type:varchar(20)" json:"whatsapp"`
	Avatar    string         `gorm:"type:text" json:"avatar"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
