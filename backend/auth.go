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

	// Trim inputs
	emailStr := strings.TrimSpace(req.Email)
	password := req.Password

	// Auto append domain if only username is provided
	if !strings.Contains(emailStr, "@") {
		emailStr += "@smk.baktinusantara666.sch.id"
	}

	// 1. Verify credentials via IMAP to Mailcow server
	// Using Port 993 (IMAP over SSL) for better reliability
	imapServer := "mail.smk.baktinusantara666.sch.id:993"
	tlsConfig := &tls.Config{InsecureSkipVerify: true}

	cli, err := client.DialTLS(imapServer, tlsConfig)
	if err != nil {
		// Fallback to 143 if 993 fails (just in case)
		log.Printf("IMAP 993 failed: %v, trying 143 with StartTLS", err)
		imapServer = "mail.smk.baktinusantara666.sch.id:143"
		cli, err = client.Dial(imapServer)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal terhubung ke server autentikasi (IMAP)"})
			return
		}
		if err := cli.StartTLS(tlsConfig); err != nil {
			cli.Logout()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal negosiasi koneksi aman (StartTLS)"})
			return
		}
	}
	defer cli.Logout()

	if err := cli.Login(emailStr, password); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email atau password salah"})
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
			Quota:    5368709120, // 5 GB
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

	// Trigger email attachment background sync
	SyncAttachmentsBackground(emailStr, password, user.ID)

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
