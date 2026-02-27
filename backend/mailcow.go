package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"baknusdrive/models"
)

const (
	MailcowURL    = "http://mail.smk.baktinusantara666.sch.id"
	MailcowAPIKey = "925B68-0FF6BB-36B760-F6C051-AAF343"
)

type MailcowMailbox struct {
	Username string   `json:"username"`
	Name     string   `json:"name"`
	Quota    int64    `json:"quota"` // Quote might be in bytes or MB based on Mailcow settings, mostly bytes.
	Tags     []string `json:"tags"`
}

func FetchExternalUserInfo(email string) (whatsapp string) {
	resp, err := http.Get(fmt.Sprintf("https://baknusmail.smkbn666.sch.id/api/auth/info/%s", email))
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ""
	}

	var result map[string]interface{}
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &result); err != nil {
		return ""
	}

	// Helper to look for WA in a map
	extractWA := func(m map[string]interface{}) string {
		fields := []string{"whatsapp", "no_wa", "whatsapp_number", "wa", "phone", "telepon", "mobile", "no_hp"}
		for _, f := range fields {
			if v, ok := m[f]; ok && v != nil {
				if s, ok := v.(string); ok && s != "" {
					return s
				}
				if n, ok := v.(float64); ok { // Handle numbers
					return fmt.Sprintf("%.0f", n)
				}
			}
		}
		return ""
	}

	// Check top level
	if wa := extractWA(result); wa != "" {
		return wa
	}

	// Check nested 'data'
	if data, ok := result["data"].(map[string]interface{}); ok {
		if wa := extractWA(data); wa != "" {
			return wa
		}
	}

	return ""
}

func SyncMailcowUsers() error {
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/v1/get/mailbox/all", MailcowURL), nil)
	if err != nil {
		return err
	}

	req.Header.Set("X-API-Key", MailcowAPIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Mailcow API returned non-200 status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var mailboxes []MailcowMailbox
	if err := json.Unmarshal(body, &mailboxes); err != nil {
		return fmt.Errorf("failed to parse Mailcow JSON: %v", err)
	}

	for _, mb := range mailboxes {
		role := "Siswa" // default Role
		if len(mb.Tags) > 0 {
			role = mb.Tags[0]
		}
		
		var quota int64 = 2147483648
		if role == "Guru" || role == "TU" {
			quota = 3221225472
		} else if role == "Admin" {
			quota = 10737418240 // 10 GB for Admin
		}

		user := models.User{
			ID:       mb.Username, 
			Email:    mb.Username,
			FullName: mb.Name,
			Role:     role,
			Quota:    quota,
			IsActive: true,
			Avatar:   fmt.Sprintf("https://baknusmail.smkbn666.sch.id/api/auth/avatar/%s", mb.Username),
		}
		
		if user.FullName == "" {
			user.FullName = mb.Username
		}

		// Fetch WhatsApp
		user.WhatsApp = FetchExternalUserInfo(mb.Username)

		// Perform Upsert safely without overwriting used_space
		var existingUser models.User
		if err := DB.Where("id = ?", mb.Username).First(&existingUser).Error; err != nil {
			if err := DB.Create(&user).Error; err != nil {
				log.Printf("Failed to create user %s: %v", user.Email, err)
			}
		} else {
			existingUser.Role = user.Role
			existingUser.Quota = user.Quota
			existingUser.IsActive = true
			existingUser.Avatar = user.Avatar
			if user.WhatsApp != "" {
				existingUser.WhatsApp = user.WhatsApp
			}

			if user.FullName != mb.Username && user.FullName != "" {
				existingUser.FullName = user.FullName
			}
			if err := DB.Save(&existingUser).Error; err != nil {
				log.Printf("Failed to update user %s: %v", user.Email, err)
			}
		}
	}

	log.Printf("Successfully synced %d mailboxes from Mailcow with internal integration", len(mailboxes))
	return nil
}
