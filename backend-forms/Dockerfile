FROM golang:1.24-alpine

RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Install reflex for hot-reloading
RUN go install github.com/cespare/reflex@latest

# Copy go.mod (no external XLSX deps anymore, all stdlib)
COPY go.mod ./

# Download dependencies
RUN go mod tidy && go mod download

# Copy source code
COPY . .

EXPOSE 8080

CMD ["reflex", "-c", "reflex.conf"]
