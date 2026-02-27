FROM golang:1.24-alpine

# Install git for private modules or certain gorm dependencies
RUN apk add --no-cache git

WORKDIR /app

# Install reflex for hot-reloading
RUN go install github.com/cespare/reflex@latest

# Copy go.mod and generate go.sum automatically to avoid checksum mismatches
COPY go.mod ./
RUN go mod tidy
RUN go mod download

# Copy the source code
COPY . .

# Expose port
EXPOSE 8080

# Command to run the executable with hot-reloading
CMD ["reflex", "-c", "reflex.conf"]
