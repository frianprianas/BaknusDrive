package main

import (
	"baknusdrive/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetNotifications returns all notifications for the authenticated user, ordered by most recent
func GetNotifications(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}
	emailStr := userID.(string)

	var notifications []models.Notification
	if err := DB.Where("user_id = ?", emailStr).Order("created_at desc").Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}

	c.JSON(http.StatusOK, notifications)
}

// MarkNotificationRead marks a specific notification as read
func MarkNotificationRead(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}
	emailStr := userID.(string)

	id := c.Param("id")

	var notification models.Notification
	if err := DB.Where("id = ? AND user_id = ?", id, emailStr).First(&notification).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}

	notification.IsRead = true
	if err := DB.Save(&notification).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notification"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification marked as read"})
}

// MarkAllNotificationsRead marks all notifications for the authenticated user as read
func MarkAllNotificationsRead(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}
	emailStr := userID.(string)

	if err := DB.Model(&models.Notification{}).Where("user_id = ? AND is_read = ?", emailStr, false).Update("is_read", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}

// CreateNotification helper to create a notification
func CreateNotification(emailStr, title, message, notifType, link string) error {
	notification := models.Notification{
		UserID:  emailStr,
		Title:   title,
		Message: message,
		Type:    notifType,
		Link:    link,
	}
	return DB.Create(&notification).Error
}
