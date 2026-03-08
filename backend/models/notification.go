package models

import (
	"time"
)

type Notification struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    string    `gorm:"type:varchar(255);index;not null" json:"userId"`
	Title     string    `gorm:"type:varchar(255)" json:"title"`
	Message   string    `gorm:"type:text" json:"message"`
	IsRead    bool      `gorm:"default:false" json:"isRead"`
	Type      string    `gorm:"type:varchar(50)" json:"type"`
	Link      string    `gorm:"type:varchar(255)" json:"link"` // optional link to view
	CreatedAt time.Time `json:"createdAt"`
}
