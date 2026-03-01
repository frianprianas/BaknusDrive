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
	r.MaxMultipartMemory = 512 << 20 // 512 MiB

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
			driveAPI.GET("/quota", GetStorageQuota)
			driveAPI.GET("/devices", ListDevices)
			driveAPI.POST("/devices", RegisterDevice)

			// Trash APIs
			driveAPI.GET("/trash", ListTrash)
			driveAPI.POST("/trash/:type/:id/restore", RestoreItem)
			driveAPI.DELETE("/trash/empty", EmptyTrash)

			// Share APIs
			driveAPI.POST("/share", ShareItem)
			driveAPI.GET("/shared-with-me", ListSharedWithMe)

			// BaknusDoc (OnlyOffice) APIs
			driveAPI.POST("/doc/create", CreateDoc)
			driveAPI.GET("/doc/config/:id", GetDocConfig)
		}
		// Public/Internal raw file access for OnlyOffice (with wildcard filename support)
		api.GET("/raw/doc/:id/*filename", RawFileAccess)
		api.POST("/doc/callback/:id", DocCallback)

		// Admin APIs
		adminAPI := api.Group("/admin")
		adminAPI.Use(AuthMiddleware(), AdminMiddleware())
		{
			adminAPI.GET("/users", GetAdminUsers)
			adminAPI.PUT("/user/:id", AdminUpdateUser)
			adminAPI.GET("/drive", AdminListDrive)
		}
	}

	log.Println("Starting server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
