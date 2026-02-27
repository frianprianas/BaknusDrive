FROM golang:1.24-alpine

# Install git for private modules or certain gorm dependencies
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Install reflex for hot-reloading
RUN go install github.com/cespare/reflex@latest

# Set GONOSUMCHECK to bypass sum verification issues for new packages
ENV GONOSUMCHECK=*
ENV GOFLAGS=-mod=mod

# Copy only go.mod first (go.sum may be incomplete/missing entries)
COPY go.mod ./

# Run go mod tidy to generate a complete go.sum
RUN go mod tidy

# Copy the source code
COPY . .

# Expose port
EXPOSE 8080

# At startup: run go mod tidy again (because volume mount replaces /app),
# then start reflex for hot-reloading
CMD sh -c "go mod tidy && reflex -c reflex.conf"
