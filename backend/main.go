package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	maxUploadSize = 3 * 1024 * 1024 * 1024
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

func rootHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	resp := map[string]string{
		"status":  "ok",
		"service": "pulsync-backend-go",
	}
	json.NewEncoder(w).Encode(resp)
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept, X-Requested-With")
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
	destPath := filepath.Join("Pulsync_Downloads", filename)
	out, err := os.Create(destPath)
	if err != nil {
		log.Println("upload error: failed to create file:", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal membuat file"})
		return
	}
	defer out.Close()
	_, err = io.Copy(out, src)
	if err != nil {
		log.Println("upload error: failed to save file:", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gagal menyimpan file"})
		return
	}
	log.Println("File berhasil diterima:", filename)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "ok",
		"message":  "File berhasil diunggah",
		"filename": filename,
	})
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
	mux := http.NewServeMux()
	mux.HandleFunc("/", rootHandler)
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/upload", uploadHandler)
	mux.HandleFunc("/api/upload/", uploadHandler)
	mux.HandleFunc("/api/download/", downloadHandler)
	http.ListenAndServe("0.0.0.0:8080", corsMiddleware(mux))
}
