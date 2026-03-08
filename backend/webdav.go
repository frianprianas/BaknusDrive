package main

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/emersion/go-imap/client"
	"github.com/gin-gonic/gin"
	"golang.org/x/net/webdav"

	"baknusdrive/models"
)

var UploadDir = "storage"

// WebDAVHandler wraps standard WebDAV for a specific user
type WebDAVHandler struct {
	Handler *webdav.Handler
	UserID  string
}

// Global map to hold handlers (in real app, use LRU cache or create on fly dynamically)
// For simplicity, we just create a handler wrapper dynamically per request
func InitWebDAV(r *gin.Engine) {
	// Root webdav endpoint
	r.Any("/webdav/*filepath", AuthMiddlewareBasic(), func(c *gin.Context) {
		userID := c.GetString("userID")
		if userID == "" {
			c.Header("WWW-Authenticate", `Basic realm="BaknusDrive WebDAV"`)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		userDir := filepath.Join(UploadDir, userID)

		// Ensure base directory exists
		if _, err := os.Stat(userDir); os.IsNotExist(err) {
			os.MkdirAll(userDir, 0755)
		}

		handler := &webdav.Handler{
			Prefix:     "/webdav",
			FileSystem: webdav.Dir(userDir),
			LockSystem: webdav.NewMemLS(),
			Logger: func(r *http.Request, err error) {
				if err != nil && !strings.Contains(err.Error(), "no such file or directory") {
					fmt.Printf("WEBDAV [%s] %s %s: %v\n", userID, r.Method, r.URL.Path, err)
				}
			},
		}

		handler.ServeHTTP(c.Writer, c.Request)
	})
}

// Since WebDAV clients (like Windows Explorer, Finder) use Basic Auth prominently,
// we need a Basic Auth middleware that checks user against IMAP/DB.
func AuthMiddlewareBasic() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Just for simplicity, we first try Bearer Token in case some client uses it
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			userID, err := RedisClient.Get(c.Request.Context(), tokenString).Result()
			if err == nil && userID != "" {
				c.Set("userID", userID)
				c.Next()
				return
			}
		}

		// WebDAV standard Basic Auth
		username, password, hasAuth := c.Request.BasicAuth()
		if !hasAuth {
			c.Header("WWW-Authenticate", `Basic realm="BaknusDrive WebDAV"`)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		emailStr := strings.TrimSpace(username)

		// Auto append domain if only username is provided
		if !strings.Contains(emailStr, "@") {
			emailStr += "@smk.baktinusantara666.sch.id"
		}

		// Check if it's already in DB, maybe we don't need IMAP if we have another way,
		// but let's strictly use IMAP like in normal login to ensure password is correct.
		validPassword := ValidatePasswordWithIMAP(emailStr, password)
		if !validPassword {
			c.Header("WWW-Authenticate", `Basic realm="BaknusDrive WebDAV"`)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		// Perform basic auth checks against DB to get role or create stub
		var user models.User
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
			}
			DB.Create(&user)
		}

		// Success
		c.Set("userID", user.Email)
		c.Set("userRole", user.Role)
		c.Next()
	}
}

func ValidatePasswordWithIMAP(emailStr string, password string) bool {
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
			log.Printf("Gagal terhubung ke server autentikasi (IMAP)")
			return false
		}
		if err := cli.StartTLS(tlsConfig); err != nil {
			cli.Logout()
			log.Printf("Gagal negosiasi koneksi aman (StartTLS)")
			return false
		}
	}
	defer cli.Logout()

	if err := cli.Login(emailStr, password); err != nil {
		return false
	}

	return true
}
