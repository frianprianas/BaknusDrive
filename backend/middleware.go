package main

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware ensures the request has a valid token in Redis.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header format must be Bearer {token}"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Check token in Redis
		userID, err := RedisClient.Get(context.Background(), tokenString).Result()
		if err != nil || userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Attach user ID to context for downstream handlers
		c.Set("userID", userID)
		c.Next()
	}
}
