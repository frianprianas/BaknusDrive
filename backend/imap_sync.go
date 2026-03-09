package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"baknusdrive/models"

	"github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
	emersion_mail "github.com/emersion/go-message/mail"
)

// SyncAttachmentsBackground runs asynchronously to fetch attachments on login
func SyncAttachmentsBackground(emailStr, password, userID string) {
	go func() {
		log.Printf("[IMAP Sync] Start parsing attachments for %s", emailStr)

		imapServer := "mail.smk.baktinusantara666.sch.id:993"
		tlsConfig := &tls.Config{InsecureSkipVerify: true}

		cli, err := client.DialTLS(imapServer, tlsConfig)
		if err != nil {
			cli, err = client.Dial("mail.smk.baktinusantara666.sch.id:143")
			if err != nil {
				return
			}
			if err := cli.StartTLS(tlsConfig); err != nil {
				cli.Logout()
				return
			}
		}
		defer cli.Logout()

		if err := cli.Login(emailStr, password); err != nil {
			log.Printf("[IMAP Sync] Login failed for %s", emailStr)
			return
		}

		mbox, err := cli.Select("INBOX", true)
		if err != nil {
			log.Printf("[IMAP Sync] Select INBOX failed for %s: %v", emailStr, err)
			return
		}

		if mbox.Messages == 0 {
			return
		}

		// Fetch the last 10 emails to avoid overloading per login
		seqSet := new(imap.SeqSet)
		from := uint32(1)
		messagesToFetch := uint32(10)
		if mbox.Messages > messagesToFetch {
			from = mbox.Messages - messagesToFetch + 1
		}
		seqSet.AddRange(from, mbox.Messages)

		var section imap.BodySectionName
		items := []imap.FetchItem{section.FetchItem()}

		messages := make(chan *imap.Message, 10)
		done := make(chan error, 1)

		go func() {
			done <- cli.Fetch(seqSet, items, messages)
		}()

		for msg := range messages {
			r := msg.GetBody(&section)
			if r == nil {
				continue
			}

			// Use go-message/mail to parse MIME parts
			m, err := emersion_mail.CreateReader(r)
			if err != nil {
				continue
			}

			for {
				p, err := m.NextPart()
				if err == io.EOF {
					break
				} else if err != nil {
					break
				}

				switch h := p.Header.(type) {
				case *emersion_mail.AttachmentHeader:
					filename, err := h.Filename()
					if err == nil && filename != "" {
						saveAttachmentIfNew(userID, filename, p.Body)
					}
				}
			}
		}

		if err := <-done; err != nil {
			log.Printf("[IMAP Sync] Fetch error: %v", err)
		}

		log.Printf("[IMAP Sync] Sync completed for %s", emailStr)
	}()
}

func saveAttachmentIfNew(userID, filename string, reader io.Reader) {
	// Create parent folder 'Lampiran Email' if not exists
	var parentFolder models.Folder
	err := DB.Where("user_id = ? AND name = ? AND parent_id IS NULL", userID, "Lampiran Email").First(&parentFolder).Error
	if err != nil {
		parentFolder = models.Folder{
			Name:   "Lampiran Email",
			UserID: userID,
		}
		if err := DB.Create(&parentFolder).Error; err != nil {
			log.Printf("[IMAP Sync] Failed to create Lampiran Email folder: %v", err)
			return
		}
	}

	// Check if file already exists in this folder with exact name to prevent duplicate creation
	var count int64
	DB.Model(&models.File{}).Where("user_id = ? AND folder_id = ? AND name = ?", userID, parentFolder.ID, filename).Count(&count)
	if count > 0 {
		return // File already saved previously
	}

	bodyData, err := io.ReadAll(reader)
	if err != nil || len(bodyData) == 0 {
		return // Skip empty or broken attachments
	}
	size := int64(len(bodyData))

	userDir := filepath.Join(UploadDir, userID, "Lampiran Email")
	os.MkdirAll(userDir, 0755)

	ext := filepath.Ext(filename)
	nameWithoutExt := strings.TrimSuffix(filename, ext)

	physicalName := filename
	physicalPath := filepath.Join(userDir, physicalName)

	counter := 1
	for {
		if _, err := os.Stat(physicalPath); os.IsNotExist(err) {
			break
		}
		physicalName = fmt.Sprintf("%s_%d%s", nameWithoutExt, counter, ext)
		physicalPath = filepath.Join(userDir, physicalName)
		counter++
	}

	err = os.WriteFile(physicalPath, bodyData, 0644)
	if err != nil {
		log.Printf("[IMAP Sync] Write file error: %v", err)
		return
	}

	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		if len(bodyData) > 512 {
			mimeType = http.DetectContentType(bodyData[:512])
		} else {
			mimeType = http.DetectContentType(bodyData)
		}
	}

	newFile := models.File{
		Name:     filename,
		MimeType: mimeType,
		Size:     size,
		Path:     physicalPath,
		FolderID: &parentFolder.ID,
		UserID:   userID,
	}
	if err := DB.Create(&newFile).Error; err != nil {
		os.Remove(physicalPath) // revert
		log.Printf("[IMAP Sync] DB save error: %v", err)
	} else {
		log.Printf("[IMAP Sync] New attachment saved: %s", filename)
	}
}
