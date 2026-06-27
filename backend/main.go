package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize connections
	InitDB()
	InitRedis()

	// Perform initial sync (Non-blocking)
	go func() {
		if err := SyncMailcowUsers(); err != nil {
			log.Printf("Error syncing Mailcow users: %v", err)
		}
	}()

	r := gin.Default()
	// Increase memory limit for multipart forms to handle large uploads smoothly
	r.MaxMultipartMemory = 1024 << 20 // 1024 MiB (1 GB)

	// CORS Setup
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return true
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	WopiRouter(r)
	r.Static("/downloads", "./static")

	api := r.Group("/api")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "BaknusDrive Backend is running!"})
		})

		// DEBUG: Direct template test
		api.GET("/debug/template/:type", func(c *gin.Context) {
			fileType := c.Param("type")
			var b []byte
			switch fileType {
			case "docx":
				b, _ = CreateEmptyDocx()
				c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
				c.Header("Content-Disposition", "attachment; filename=\"debug.docx\"")
			case "xlsx":
				b, _ = CreateEmptyXlsx()
				c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
				c.Header("Content-Disposition", "attachment; filename=\"debug.xlsx\"")
			case "pptx":
				b, _ = CreateEmptyPptx()
				c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation")
				c.Header("Content-Disposition", "attachment; filename=\"debug.pptx\"")
			}
			c.Data(200, c.Writer.Header().Get("Content-Type"), b)
		})

		api.POST("/login", LoginHandler)
		api.GET("/me", AuthMiddleware(), Me)
		api.GET("/users", ListUsers)

		// Public Shared APIs (No Auth required)
		publicAPI := api.Group("/public")
		{
			publicAPI.GET("/file/:id", ViewPublicFileMetadata)
			publicAPI.GET("/file/:id/download", DownloadPublicFile)
			publicAPI.GET("/folder/:id", ViewPublicFolderMetadata)
			publicAPI.GET("/folder/:id/download", DownloadPublicFolder)
		}

		// Integration API for Aplikasi Surat (Needs X-Surat-API-Key header)
		api.POST("/surat/upload", UploadSurat)

		// Integration API for Aplikasi Kehadiran (Needs X-Attend-API-Key header)
		api.POST("/attend/upload", UploadAttend)

		// Integration API for Aplikasi BaknusClass (Needs X-Class-API-Key header)
		api.POST("/class/create-event", CreateClassEvent)
		api.POST("/class/create-subject", CreateClassSubject)
		api.POST("/class/upload-soal", UploadClassSoal)
		api.POST("/class/upload-materi", UploadClassMateri)
		api.POST("/class/upload-tugas", UploadClassTugas)
		api.GET("/class/doc/open/:id", GetClassViewToken)

		// Integration API for Aplikasi BaknusMeet (Needs X-Meet-API-Key header)
		api.POST("/meet/setup", SetupMeetFolders)
		api.POST("/meet/upload", UploadMeetFile)

		// Protected Drive APIs
		driveAPI := api.Group("/drive")
		driveAPI.Use(AuthMiddleware())
		{
			driveAPI.GET("", ListDrive)
			driveAPI.POST("/folder", CreateFolder)
			driveAPI.POST("/upload", UploadFile)
			driveAPI.GET("/file/:id/download", DownloadFile)
			driveAPI.GET("/folder/:id/download", DownloadFolder)
			driveAPI.DELETE("/file/:id", DeleteFile)
			driveAPI.DELETE("/folder/:id", DeleteFolder)
			driveAPI.PUT("/file/:id/rename", RenameFile)
			driveAPI.PUT("/folder/:id/rename", RenameFolder)
			driveAPI.PUT("/file/:id/move", MoveFile)
			driveAPI.POST("/file/:id/copy", CopyFile)
			driveAPI.PUT("/folder/:id/move", MoveFolder)
			driveAPI.POST("/folder/:id/copy", CopyFolder)
			driveAPI.GET("/quota", GetStorageQuota)
			driveAPI.GET("/devices", ListDevices)
			driveAPI.POST("/devices", RegisterDevice)

			// Star APIs
			driveAPI.PUT("/file/:id/star", ToggleFileStar)
			driveAPI.PUT("/folder/:id/star", ToggleFolderStar)
			driveAPI.GET("/starred", ListStarred)

			// Recent APIs
			driveAPI.GET("/recent", ListRecent)
			driveAPI.GET("/search", SearchDrive)

			// Trash APIs
			driveAPI.GET("/trash", ListTrash)
			driveAPI.POST("/trash/:type/:id/restore", RestoreItem)
			driveAPI.DELETE("/trash/empty", EmptyTrash)

			// Share APIs
			driveAPI.POST("/share", ShareItem)
			driveAPI.GET("/shares", ListItemShares)
			driveAPI.DELETE("/share/:id", UnshareItem)
			driveAPI.GET("/shared-with-me", ListSharedWithMe)
			driveAPI.GET("/my-shares", ListMyShares)
			driveAPI.PUT("/file/:id/public", ToggleFilePublic)
			driveAPI.PUT("/folder/:id/public", ToggleFolderPublic)

			// BaknusDoc (Collabora) APIs
			driveAPI.POST("/doc/create", CreateDoc)
			driveAPI.GET("/doc/open/:id", OpenDoc) // returns Collabora editor URL with per-user WOPI token
		}

		// Notification APIs
		notifAPI := api.Group("/notifications")
		notifAPI.Use(AuthMiddleware())
		{
			notifAPI.GET("", GetNotifications)
			notifAPI.PUT("/:id/read", MarkNotificationRead)
			notifAPI.PUT("/read-all", MarkAllNotificationsRead)
		}

		// Admin APIs
		adminAPI := api.Group("/admin")
		adminAPI.Use(AuthMiddleware(), AdminMiddleware())
		{
			adminAPI.GET("/users", GetAdminUsers)
			adminAPI.PUT("/user/:id", AdminUpdateUser)
			adminAPI.GET("/drive", AdminListDrive)
		}
	}

	// Initialize WebDAV endpoints
	InitWebDAV(r)

	log.Println("Starting server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
