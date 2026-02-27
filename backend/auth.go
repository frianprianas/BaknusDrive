package main

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/emersion/go-imap/client"
	"github.com/gin-gonic/gin"

	"baknusdrive/models"
)

type LoginRequest struct {
	Email    string `json:"email" binding:"required"` // No longer enforce email binding strict format here
	Password string `json:"password" binding:"required"`
}

func LoginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Auto append domain if only username is provided
	emailStr := req.Email
	if !strings.Contains(emailStr, "@") {
		emailStr += "@smk.baktinusantara666.sch.id"
	}

	// 1. Verify credentials via IMAP to Mailcow server
	// Mailcow URL is http://mail.smk.baktinusantara666.sch.id
	// IMAP usually runs on port 993 (TLS) or 143 (STARTTLS).
	imapServer := "mail.smk.baktinusantara666.sch.id:143"
	
	cli, err := client.Dial(imapServer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to authentication server"})
		return
	}
	defer cli.Logout()

	tlsConfig := &tls.Config{InsecureSkipVerify: true} // Allow self-signed certs just in case
	if err := cli.StartTLS(tlsConfig); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to negotiate secure connection"})
		return
	}

	if err := cli.Login(emailStr, req.Password); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// 2. Setup Session token (simple random or JWT, here we will use a basic token stored in Redis)
	user := models.User{}
	if err := DB.Where("email = ?", emailStr).First(&user).Error; err != nil {
		// If user not in DB, sync them now or just create a stub
		user = models.User{
			ID:       emailStr,
			Email:    emailStr,
			FullName: emailStr, // fallback
			Role:     "Siswa",
			Quota:    2147483648,
			IsActive: true,
			Avatar:   fmt.Sprintf("https://baknusmail.smkbn666.sch.id/api/auth/avatar/%s", emailStr),
			WhatsApp: FetchExternalUserInfo(emailStr),
		}
		DB.Create(&user)
	} else {
		// Always update avatar and WhatsApp on login to stay sync'd
		updated := false
		newAvatar := fmt.Sprintf("https://baknusmail.smkbn666.sch.id/api/auth/avatar/%s", emailStr)
		if user.Avatar != newAvatar {
			user.Avatar = newAvatar
			updated = true
		}
		
		newWA := FetchExternalUserInfo(emailStr)
		if newWA != "" && user.WhatsApp != newWA {
			user.WhatsApp = newWA
			updated = true
		}
		
		if updated {
			DB.Save(&user)
		}
	}

	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akun Anda telah dinonaktifkan oleh Admin. Silakan hubungi Administrator."})
		return
	}

	// 3. Generate token and store in Redis
	// For simplicity in this example, we generate a pseudo-random token using time
	token := "baknus_" + user.ID + "_" + time.Now().Format("20060102150405")
	
	err = RedisClient.Set(Ctx, token, user.ID, 24*time.Hour).Err()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   token,
		"user":    user,
	})
}

func Me(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}
	email := userID.(string)
	log.Printf("DEBUG: Me handler called for email: [%s]", email)

	user := models.User{}
	if err := DB.Where("email = ?", email).First(&user).Error; err != nil {
		log.Printf("DEBUG: User not found in DB for email [%s]: %v", email, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found", "detail": email})
		return
	}

	// Refresh data
	updated := false
	newAvatar := fmt.Sprintf("https://baknusmail.smkbn666.sch.id/api/auth/avatar/%s", email)
	if user.Avatar != newAvatar {
		user.Avatar = newAvatar
		updated = true
	}
	
	newWA := FetchExternalUserInfo(email)
	log.Printf("DEBUG: External info for %s: WA=%s", email, newWA)
	if newWA != "" && user.WhatsApp != newWA {
		user.WhatsApp = newWA
		updated = true
	}
	if updated {
		DB.Save(&user)
	}

	c.JSON(http.StatusOK, user)
}
