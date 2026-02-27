package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client
var Ctx = context.Background()

func InitRedis() {
	host := os.Getenv("REDIS_HOST")
	port := os.Getenv("REDIS_PORT")
	addr := fmt.Sprintf("%s:%s", host, port)

	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     "",  // no password set
		DB:           0,   // use default DB
		PoolSize:     100, // Maximum number of socket connections
		MinIdleConns: 10,  // Minimum number of idle connections
	})

	_, err := rdb.Ping(Ctx).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	RedisClient = rdb
	log.Println("Redis connected successfully")
}
