FROM golang:1.23-alpine

WORKDIR /app

# Install reflex for hot-reloading
RUN go install github.com/cespare/reflex@latest

# Copy go mod and sum files
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Expose port
EXPOSE 8080

# Command to run the executable with hot-reloading
CMD ["reflex", "-c", "reflex.conf"]
