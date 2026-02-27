package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	stdRuntime "runtime"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx           context.Context
	backendURL    string
	token         string
	deviceID      uint
	syncFolder    string
	isSyncing     bool
}

type RegisterResp struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

// NewApp creates a new App struct
func NewApp() *App {
	return &App{
		backendURL: "https://baknusdrive.smkbn666.sch.id",
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// SetToken sets the authentication token
func (a *App) SetToken(token string) {
	a.token = token
}

// RegisterDevice registers this computer to the backend
func (a *App) RegisterDevice(name string) (string, error) {
	osName := stdRuntime.GOOS
	payload := map[string]string{
		"name": name,
		"os":   osName,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", a.backendURL+"/api/drive/devices", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+a.token)
	req.Header.Set("Content-Type", "json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to register device: %s", resp.Status)
	}

	var registerResp RegisterResp
	json.NewDecoder(resp.Body).Decode(&registerResp)
	a.deviceID = registerResp.ID

	return fmt.Sprintf("Device registered with ID: %d", a.deviceID), nil
}

// SelectFolder opens a folder dialog
func (a *App) SelectFolder() string {
	folder, err := wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select Folder to Sync",
	})
	if err != nil {
		return ""
	}
	a.syncFolder = folder
	return folder
}

// UploadFile uploads a single file to the server
func (a *App) UploadFile(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return err
	}
	io.Copy(part, file)

	writer.WriteField("device_id", fmt.Sprintf("%d", a.deviceID))
	// In real world, we would also reconstruct folder structure
	writer.Close()

	req, _ := http.NewRequest("POST", a.backendURL+"/api/drive/upload", body)
	req.Header.Set("Authorization", "Bearer "+a.token)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("upload failed: %s", resp.Status)
	}

	return nil
}

// StartSync starts the synchronization process
func (a *App) StartSync() string {
	if a.syncFolder == "" {
		return "Please select a folder first"
	}
	a.isSyncing = true
	
	// Simply walk the directory for now (in a real app, use fsnotify)
	go func() {
		filepath.Walk(a.syncFolder, func(path string, info os.FileInfo, err error) error {
			if err == nil && !info.IsDir() {
				a.UploadFile(path)
				wailsRuntime.EventsEmit(a.ctx, "file-synced", info.Name())
			}
			return nil
		})
		a.isSyncing = false
		wailsRuntime.EventsEmit(a.ctx, "sync-complete", "All files uploaded")
	}()

	return "Sync started..."
}
