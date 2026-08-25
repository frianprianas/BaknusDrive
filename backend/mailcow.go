package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"baknusdrive/models"
)

const (
	MailcowURL    = "https://mail.smk.baktinusantara666.sch.id"
	MailcowAPIKey = "925B68-0FF6BB-36B760-F6C051-AAF343"
)

type MailcowMailbox struct {
	Username string   `json:"username"`
	Name     string   `json:"name"`
	Quota    int64    `json:"quota"` // Quote might be in bytes or MB based on Mailcow settings, mostly bytes.
	Tags     []string `json:"tags"`
}

func LoadStudentClasses() map[string]string {
	classes := make(map[string]string)

	loadCSV := func(filepath string) {
		file, err := os.Open(filepath)
		if err != nil {
			return
		}
		defer file.Close()

		reader := csv.NewReader(file)
		reader.Comma = ';'

		header, err := reader.Read()
		if err != nil {
			return
		}

		emailIdx := -1
		classIdx := -1
		for i, h := range header {
			cleanH := strings.ToUpper(strings.TrimSpace(h))
			if cleanH == "EMAIL" {
				emailIdx = i
			} else if cleanH == "KELAS" {
				classIdx = i
			}
		}

		if emailIdx == -1 || classIdx == -1 {
			return
		}

		for {
			record, err := reader.Read()
			if err == io.EOF {
				break
			}
			if err != nil {
				continue
			}

			if len(record) > emailIdx && len(record) > classIdx {
				email := strings.ToLower(strings.TrimSpace(record[emailIdx]))
				class := strings.TrimSpace(record[classIdx])
				if email != "" && class != "" {
					classes[email] = class
				}
			}
		}
	}

	// Load all available CSV files
	loadCSV("XII_PPLG.csv")
	loadCSV("backend/XII_PPLG.csv")
	loadCSV("kls_12.csv")
	loadCSV("backend/kls_12.csv")
	loadCSV("kls_XI.csv")
	loadCSV("backend/kls_XI.csv")

	log.Printf("Successfully loaded %d student classes from CSV files", len(classes))
	return classes
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
	// Load student classes
	studentClasses := LoadStudentClasses()

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

	// Build map of active mailboxes
	activeEmails := make(map[string]bool)
	for _, mb := range mailboxes {
		activeEmails[mb.Username] = true
		role := "Siswa" // default Role
		if len(mb.Tags) > 0 {
			role = mb.Tags[0]
		}
		var quota int64 = 5368709120 // 5 GB default for Siswa
		if role == "Guru" || role == "TU" || role == "Admin" {
			quota = 10737418240 // 10 GB
		}

		class := ""
		if c, ok := studentClasses[strings.ToLower(mb.Username)]; ok {
			class = c
			role = "Siswa" // Ensure role is Siswa if mapped in student classes
		}

		user := models.User{
			ID:       mb.Username,
			Email:    mb.Username,
			FullName: mb.Name,
			Role:     role,
			Class:    class,
			Quota:    quota,
			IsActive: true,
			Avatar:   fmt.Sprintf("https://baknusmail.smkbn666.sch.id/api/public/avatar/%s", mb.Username),
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

			// Only migrate quota if they are using one of the old/new default standard values.
			// If an admin manually set it to something else (e.g. 20GB), preserve it.
			if existingUser.Quota == 2147483648 || existingUser.Quota == 3221225472 || existingUser.Quota == 5368709120 || existingUser.Quota == 10737418240 {
				existingUser.Quota = user.Quota
			}

			existingUser.IsActive = true
			existingUser.Avatar = user.Avatar
			if user.WhatsApp != "" {
				existingUser.WhatsApp = user.WhatsApp
			}

			if user.FullName != mb.Username && user.FullName != "" {
				existingUser.FullName = user.FullName
			}
			if user.Class != "" {
				existingUser.Class = user.Class
			}
			if err := DB.Save(&existingUser).Error; err != nil {
				log.Printf("Failed to update user %s: %v", user.Email, err)
			}
		}
	}

	// Deactivate and Soft-delete users that are no longer in Mailcow
	var localUsers []models.User
	if err := DB.Find(&localUsers).Error; err == nil {
		for _, lu := range localUsers {
			if !activeEmails[lu.ID] {
				lu.IsActive = false
				DB.Save(&lu)
				if err := DB.Delete(&lu).Error; err != nil {
					log.Printf("Failed to soft-delete user %s: %v", lu.ID, err)
				} else {
					log.Printf("Soft-deleted user %s (no longer in Mailcow)", lu.ID)
				}
			}
		}
	}

	log.Printf("Successfully synced %d mailboxes from Mailcow with internal integration", len(mailboxes))
	return nil
}
