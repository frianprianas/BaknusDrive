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
	// Set a lower memory limit for multipart forms (default is 32 MiB)
	// Files larger than this will be stored in temporary files to save RAM
	r.MaxMultipartMemory = 32 << 20 // 32 MiB


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

	api := r.Group("/api")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "BaknusDrive Backend is running!"})
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

			// Trash APIs
			driveAPI.GET("/trash", ListTrash)
			driveAPI.POST("/trash/:type/:id/restore", RestoreItem)
			driveAPI.DELETE("/trash/empty", EmptyTrash)

			// Share APIs
			driveAPI.POST("/share", ShareItem)
			driveAPI.GET("/shared-with-me", ListSharedWithMe)
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

	log.Println("Starting server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
