package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Form struct {
	ID          string         `gorm:"primaryKey;type:varchar(255)" json:"id"`
	Title       string         `gorm:"not null" json:"title"`
	Description string         `json:"description"`
	CreatorID   string         `gorm:"not null;index" json:"creator_id"` // Email dari Mailcow
	Questions   string         `gorm:"type:text" json:"questions"`      // JSON string of questions
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	FolderID    *uint          `json:"folder_id"`                       // ID folder di Drive untuk simpan hasil
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (f *Form) BeforeCreate(tx *gorm.DB) (err error) {
	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	return
}

type FormResponse struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	FormID       string         `gorm:"not null;index" json:"form_id"`
	Respondent   string         `json:"respondent"`                  // Email jika login, atau 'Anonymous'
	ResponseData string         `gorm:"type:text" json:"response_data"` // JSON string of answers
	CreatedAt    time.Time      `json:"created_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}
