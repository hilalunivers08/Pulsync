package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	maxUploadSize = 3 * 1024 * 1024 * 1024
)

type FileItem struct {
	ID              string    `json:"id"`
	OriginalName    string    `json:"original_name"`
	FilePath        string    `json:"-"`
	FileSize        int64     `json:"file_size"`
	ExpiresAt       time.Time `json:"expires_at"`
	ActiveDownloads int       `json:"active_downloads"`
	DownloadURL     string    `json:"download_url"`
}

type Device struct {
	IP       string    `json:"ip"`
	Name     string    `json:"name"`
	Username string    `json:"username"`
	LastSeen time.Time `json:"last_seen"`
	Status   string    `json:"status"`
}

var (
	fileStore   = make(map[string]*FileItem)
	storeMutex  sync.RWMutex
	deviceStore = make(map[string]*Device)
	deviceMutex sync.RWMutex
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept, X-Requested-With, X-File-Name")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func ensureDownloadDir() {
	os.MkdirAll("Pulsync_Downloads", 0755)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	resp := map[string]string{
		"status":  "ok",
		"service": "pulsync-backend-go",
	}
	json.NewEncoder(w).Encode(resp)
}

func getClientIP(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip != "" {
		parts := strings.Split(ip, ",")
		ip = strings.TrimSpace(parts[0])
		if ip != "" {
			return ip
		}
	}
	ip = r.Header.Get("X-Real-IP")
	if ip != "" {
		return strings.TrimSpace(ip)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func getDeviceName(r *http.Request) string {
	ua := r.Header.Get("User-Agent")
	if strings.Contains(strings.ToLower(ua), "android") {
		return "Android Device"
	}
	if strings.Contains(strings.ToLower(ua), "iphone") || strings.Contains(strings.ToLower(ua), "ipad") {
		return "iOS Device"
	}
	if strings.Contains(strings.ToLower(ua), "windows") {
		return "Windows Device"
	}
	if strings.Contains(strings.ToLower(ua), "macintosh") || strings.Contains(strings.ToLower(ua), "mac os") {
		return "macOS Device"
	}
	if strings.Contains(strings.ToLower(ua), "linux") {
		return "Linux Device"
	}
	return "Unknown Device"
}

func presenceHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept, X-Requested-With, X-File-Name")
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}
	ip := getClientIP(r)
	name := getDeviceName(r)
	username := ""
	var payload map[string]string
	if err := json.NewDecoder(r.Body).Decode(&payload); err == nil {
		if v, ok := payload["username"]; ok {
			username = v
		}
		if v, ok := payload["name"]; ok && v != "" {
			name = v
		}
	}
	now := time.Now()
	deviceMutex.Lock()
	if dev, ok := deviceStore[ip]; ok {
		dev.LastSeen = now
		dev.Name = name
		if username != "" {
			dev.Username = username
		}
		dev.Status = "online"
	} else {
		deviceStore[ip] = &Device{
			IP:       ip,
			Name:     name,
			Username: username,
			LastSeen: now,
			Status:   "online",
		}
	}
	deviceMutex.Unlock()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func devicesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept, X-Requested-With, X-File-Name")
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}
	now := time.Now()
	deviceMutex.Lock()
	result := make([]*Device, 0)
	for ip, dev := range deviceStore {
		if now.Sub(dev.LastSeen) <= 45*time.Second {
			dev.Status = "online"
			result = append(result, dev)
		} else if now.Sub(dev.LastSeen) > 45*time.Second && now.Sub(dev.LastSeen) < 5*time.Minute {
			dev.Status = "offline"
			result = append(result, dev)
		} else {
			delete(deviceStore, ip)
		}
	}
	deviceMutex.Unlock()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(result)
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	resp := map[string]string{
		"status":  "ok",
		"service": "pulsync-backend-go",
	}
	json.NewEncoder(w).Encode(resp)
}

func generateID(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return hex.EncodeToString(b)[:n]
	}
	return hex.EncodeToString(b)[:n]
}

func startCleanupWorker() {
	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		for range ticker.C {
			now := time.Now()
			storeMutex.Lock()
			for id, item := range fileStore {
				if now.After(item.ExpiresAt) && item.ActiveDownloads == 0 {
					if item.FilePath != "" {
						os.Remove(item.FilePath)
					}
					delete(fileStore, id)
				}
			}
			storeMutex.Unlock()
		}
	}()
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept, X-Requested-With, X-File-Name")
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}
	ensureDownloadDir()

	if cl := r.Header.Get("Content-Length"); cl != "" {
		if v, err := strconv.ParseInt(cl, 10, 64); err == nil && v > maxUploadSize {
			log.Println("upload error: content-length exceeds limit")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			json.NewEncoder(w).Encode(map[string]string{"error": "Ukuran file melebihi batas 3 GB"})
			return
		}
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	var filename string
	var src io.Reader = r.Body
	var isMultipart bool

	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "multipart/form-data") {
		isMultipart = true
		if err := r.ParseMultipartForm(32 << 20); err == nil {
			if f, fh, err := r.FormFile("file"); err == nil {
				filename = fh.Filename
				src = f
				defer f.Close()
			} else {
				log.Println("upload error: failed to get form file:", err)
			}
		} else {
			log.Println("upload error: failed to parse multipart form:", err)
		}
	}

	if !isMultipart {
		filename = r.URL.Query().Get("name")
		if filename == "" {
			filename = r.Header.Get("X-File-Name")
		}
	}

	if filename == "" {
		filename = "upload.bin"
	}
	filename = filepath.Base(filename)

	id := generateID(8)
	ext := filepath.Ext(filename)
	if ext == "" {
		ext = filepath.Ext("upload.bin")
	}
	storedName := id + ext
	destPath := filepath.Join("Pulsync_Downloads", storedName)
	out, err := os.Create(destPath)
	if err != nil {
		log.Println("upload error: failed to create file:", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal membuat file"})
		return
	}
	defer out.Close()
	written, err := io.Copy(out, src)
	if err != nil {
		log.Println("upload error: failed to save file:", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal menyimpan file"})
		return
	}

	item := &FileItem{
		ID:               id,
		OriginalName:     filename,
		FilePath:         destPath,
		FileSize:         written,
		ExpiresAt:        time.Now().Add(10 * time.Minute),
		ActiveDownloads:  0,
		DownloadURL:      "/api/download/" + id,
	}
	storeMutex.Lock()
	fileStore[id] = item
	storeMutex.Unlock()

	log.Println("File berhasil diterima:", filename)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "ok",
		"message":       "File berhasil diunggah",
		"id":            item.ID,
		"original_name": item.OriginalName,
		"file_size":     item.FileSize,
		"expires_at":    item.ExpiresAt,
		"download_url":  item.DownloadURL,
	})
}

func filesListHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept, X-Requested-With, X-File-Name")
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}
	now := time.Now()
	storeMutex.RLock()
	result := make([]*FileItem, 0)
	for _, item := range fileStore {
		if now.Before(item.ExpiresAt) {
			result = append(result, item)
		}
	}
	storeMutex.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(result)
}

func downloadByIDHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept, X-Requested-With, X-File-Name")
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
		return
	}
	prefix := "/api/download/"
	path := r.URL.Path
	if !strings.HasPrefix(path, prefix) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Berkas sudah kadaluarsa atau tidak ditemukan"})
		return
	}
	id := strings.TrimPrefix(path, prefix)
	id = strings.Trim(id, "/")
	now := time.Now()
	var item *FileItem
	storeMutex.Lock()
	if it, ok := fileStore[id]; ok {
		if now.After(it.ExpiresAt) {
			storeMutex.Unlock()
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "Berkas sudah kadaluarsa atau tidak ditemukan"})
			return
		}
		it.ActiveDownloads++
		it.ExpiresAt = now.Add(10 * time.Minute)
		item = it
	} else {
		storeMutex.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Berkas sudah kadaluarsa atau tidak ditemukan"})
		return
	}
	storeMutex.Unlock()

	defer func() {
		storeMutex.Lock()
		if it, ok := fileStore[id]; ok {
			if it.ActiveDownloads > 0 {
				it.ActiveDownloads--
			}
		}
		storeMutex.Unlock()
	}()

	if _, err := os.Stat(item.FilePath); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Berkas sudah kadaluarsa atau tidak ditemukan"})
		return
	}
	w.Header().Set("Content-Disposition", "attachment; filename=\""+item.OriginalName+"\"")
	http.ServeFile(w, r, item.FilePath)
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	ensureDownloadDir()
	path := r.URL.Path
	prefix := "/api/download/"
	if !strings.HasPrefix(path, prefix) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "File tidak ditemukan"})
		return
	}
	filename := strings.TrimPrefix(path, prefix)
	filename = filepath.Base(filename)
	filePath := filepath.Join("Pulsync_Downloads", filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "File tidak ditemukan"})
		return
	}
	http.ServeFile(w, r, filePath)
}

func main() {
	ensureDownloadDir()
	startCleanupWorker()
	mux := http.NewServeMux()
	mux.HandleFunc("/", rootHandler)
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/upload", uploadHandler)
	mux.HandleFunc("/api/upload/", uploadHandler)
	mux.HandleFunc("/api/files", filesListHandler)
	mux.HandleFunc("/api/download/", downloadByIDHandler)
	mux.HandleFunc("/api/presence", presenceHandler)
	mux.HandleFunc("/api/devices", devicesHandler)
	http.ListenAndServe("0.0.0.0:8080", corsMiddleware(mux))
}
