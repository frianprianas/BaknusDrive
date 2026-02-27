package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"baknusdrive/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	host := os.Getenv("DB_HOST")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	port := os.Getenv("DB_PORT")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta", host, user, password, dbname, port)
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Optimize Connection Pool
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(10)           // Set the maximum number of connections in the idle connection pool
		sqlDB.SetMaxOpenConns(100)          // Set the maximum number of open connections to the database
		sqlDB.SetConnMaxLifetime(time.Hour) // Set the maximum amount of time a connection may be reused
	}

	DB = db
	log.Println("PostgreSQL connected successfully with optimized connection pool")

	// Apply migrations
	err = DB.AutoMigrate(&models.User{}, &models.Folder{}, &models.File{}, &models.Share{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	log.Println("Database migration completed")

	// Seed System Roles for Share targets
	systemRoles := []string{"ROLE:Guru", "ROLE:Siswa", "ROLE:TU"}
	for _, role := range systemRoles {
		var user models.User
		if err := DB.Where("email = ?", role).First(&user).Error; err != nil {
			DB.Create(&models.User{
				ID:       role,
				Email:    role,
				FullName: role,
				Role:     "System",
			})
		}
	}
}
