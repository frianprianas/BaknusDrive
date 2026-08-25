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
		sqlDB.SetMaxIdleConns(5)            // Reduced from 10
		sqlDB.SetMaxOpenConns(40)           // Reduced from 100 to avoid exceeding PG default (100)
		sqlDB.SetConnMaxLifetime(time.Hour) // Set the maximum amount of time a connection may be reused
	}

	DB = db
	log.Println("PostgreSQL connected successfully with optimized connection pool")

	// Apply migrations
	err = DB.AutoMigrate(&models.User{}, &models.Folder{}, &models.File{}, &models.Share{}, &models.Device{}, &models.Notification{}, &models.ChatBackup{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	log.Println("Database migration completed")

	// Drop any legacy FK constraint on shares.shared_with (PostgreSQL doesn't remove via AutoMigrate)
	// This allows CLASS: and ROLE: prefixed values to be stored freely
	DB.Exec(`ALTER TABLE shares DROP CONSTRAINT IF EXISTS fk_shares_shared_user`)
	DB.Exec(`ALTER TABLE shares DROP CONSTRAINT IF EXISTS shares_shared_with_fkey`)

	// Clean up legacy "system role" virtual users that are no longer needed
	DB.Exec(`DELETE FROM users WHERE role = 'System' AND email LIKE 'ROLE:%'`)

	log.Println("Share constraint cleanup done")
}
