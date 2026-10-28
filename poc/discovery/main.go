package main

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

//go:embed index.html
var assets embed.FS

const (
	peerTTL   = 20 * time.Second
	signalTTL = 15 * time.Second
	maxSDP    = 256 * 1024
)

type peer struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Network  string    `json:"-"`
	LastSeen time.Time `json:"last_seen"`
}

type signal struct {
	From      string    `json:"from"`
	To        string    `json:"to"`
	Type      string    `json:"type"`
	SDP       string    `json:"sdp"`
	CreatedAt time.Time `json:"created_at"`
}

type serverState struct {
	mu      sync.Mutex
	peers   map[string]peer
	inboxes map[string][]signal
}

func newState() *serverState {
	return &serverState{peers: make(map[string]peer), inboxes: make(map[string][]signal)}
}

func (s *serverState) cleanupLocked(now time.Time) {
	for id, p := range s.peers {
		if now.Sub(p.LastSeen) > peerTTL {
			delete(s.peers, id)
			delete(s.inboxes, id)
		}
	}
	for id, queue := range s.inboxes {
		fresh := queue[:0]
		for _, item := range queue {
			if now.Sub(item.CreatedAt) <= signalTTL {
				fresh = append(fresh, item)
			}
		}
		if len(fresh) == 0 {
			delete(s.inboxes, id)
		} else {
			s.inboxes[id] = fresh
		}
	}
}

func (s *serverState) register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Use POST")
		return
	}
	var in struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &in, 4*1024); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request")
		return
	}
	in.ID = strings.TrimSpace(in.ID)
	in.Name = cleanName(in.Name)
	if len(in.ID) < 12 || len(in.ID) > 80 || in.Name == "" {
		writeError(w, http.StatusBadRequest, "Invalid peer ID or name")
		return
	}
	ip, err := requestIP(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Could not determine client IP")
		return
	}
	now := time.Now()
	bucket := networkBucket(ip)
	s.mu.Lock()
	s.cleanupLocked(now)
	s.peers[in.ID] = peer{ID: in.ID, Name: in.Name, Network: bucket, LastSeen: now}
	active := len(s.peers)
	s.mu.Unlock()
	// Diagnostic logging: helps distinguish a missing second client from a network-bucket mismatch.
	log.Printf("REGISTER name=%q id=%s remote_ip=%s bucket=%s active_peers=%d", in.Name, in.ID, ip.String(), bucket, active)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "expires_in_seconds": int(peerTTL.Seconds()), "observed_ip": ip.String(), "network_bucket": bucket})
}

func (s *serverState) listPeers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Use GET")
		return
	}
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	now := time.Now()
	s.mu.Lock()
	s.cleanupLocked(now)
	self, ok := s.peers[id]
	if !ok {
		s.mu.Unlock()
		writeError(w, http.StatusUnauthorized, "Peer is not registered")
		return
	}
	result := make([]peer, 0)
	for otherID, p := range s.peers {
		if otherID != id && p.Network == self.Network && now.Sub(p.LastSeen) <= peerTTL {
			p.Network = ""
			result = append(result, p)
		}
	}
	active := len(s.peers)
	requestBucket := self.Network
	s.mu.Unlock()
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	log.Printf("DISCOVERY requester=%s bucket=%s matches=%d active_peers=%d", id, requestBucket, len(result), active)
	writeJSON(w, http.StatusOK, result)
}

func (s *serverState) postSignal(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Use POST")
		return
	}
	var in signal
	if err := decodeJSON(r, &in, maxSDP+8*1024); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid signal")
		return
	}
	in.From = strings.TrimSpace(in.From)
	in.To = strings.TrimSpace(in.To)
	if in.From == "" || in.To == "" || in.From == in.To || (in.Type != "offer" && in.Type != "answer") || len(in.SDP) == 0 || len(in.SDP) > maxSDP {
		writeError(w, http.StatusBadRequest, "Invalid signal fields")
		return
	}
	now := time.Now()
	s.mu.Lock()
	s.cleanupLocked(now)
	from, fromOK := s.peers[in.From]
	to, toOK := s.peers[in.To]
	if !fromOK || !toOK || now.Sub(from.LastSeen) > peerTTL || now.Sub(to.LastSeen) > peerTTL {
		s.mu.Unlock()
		writeError(w, http.StatusGone, "Peer offline")
		return
	}
	if from.Network != to.Network {
		s.mu.Unlock()
		writeError(w, http.StatusForbidden, "Peers are not in the same network bucket")
		return
	}
	in.CreatedAt = now
	s.inboxes[in.To] = append(s.inboxes[in.To], in)
	s.mu.Unlock()
	writeJSON(w, http.StatusAccepted, map[string]bool{"queued": true})
}

func (s *serverState) pollSignals(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Use GET")
		return
	}
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	now := time.Now()
	s.mu.Lock()
	s.cleanupLocked(now)
	if _, ok := s.peers[id]; !ok {
		s.mu.Unlock()
		writeError(w, http.StatusUnauthorized, "Peer is not registered")
		return
	}
	// Always encode an empty inbox as [] rather than null so browser clients can iterate safely.
	queue := append([]signal{}, s.inboxes[id]...)
	delete(s.inboxes, id)
	s.mu.Unlock()
	writeJSON(w, http.StatusOK, queue)
}

func (s *serverState) leave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Use POST")
		return
	}
	var in struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &in, 1024); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request")
		return
	}
	s.mu.Lock()
	delete(s.peers, strings.TrimSpace(in.ID))
	delete(s.inboxes, strings.TrimSpace(in.ID))
	for id, queue := range s.inboxes {
		filtered := queue[:0]
		for _, item := range queue {
			if item.From != in.ID && item.To != in.ID {
				filtered = append(filtered, item)
			}
		}
		s.inboxes[id] = filtered
	}
	s.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]bool{"left": true})
}

func requestIP(r *http.Request) (net.IP, error) {
	// Forwarded headers are trusted only when the operator explicitly deploys
	// this behind a reverse proxy they control.
	if os.Getenv("PULSYNC_TRUST_PROXY") == "1" {
		if forwarded := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); forwarded != "" {
			if ip := net.ParseIP(forwarded); ip != nil {
				return ip, nil
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(strings.Trim(host, "[]"))
	if ip == nil {
		return nil, errors.New("invalid remote IP")
	}
	return ip, nil
}

// networkBucket is only a matchmaking hint, not proof that peers share a LAN.
// ICE below is intentionally limited to host candidates in private/local ranges.
func networkBucket(ip net.IP) string {
	if v4 := ip.To4(); v4 != nil {
		if v4[0] == 10 || v4[0] == 192 && v4[1] == 168 || v4[0] == 172 && v4[1] >= 16 && v4[1] <= 31 || v4[0] == 169 && v4[1] == 254 {
			return fmt.Sprintf("v4:%d.%d.%d.0/24", v4[0], v4[1], v4[2])
		}
		return "v4:" + v4.String()
	}
	if ip.IsLinkLocalUnicast() || ip.IsPrivate() {
		return "v6:" + fmt.Sprintf("%x:%x:%x:%x", ip[0:2], ip[2:4], ip[4:6], ip[6:8])
	}
	return "v6:" + ip.String()
}

func cleanName(name string) string {
	name = strings.Join(strings.Fields(name), " ")
	if len(name) > 32 {
		name = name[:32]
	}
	return name
}

func decodeJSON(r *http.Request, out any, limit int64) error {
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if err != nil {
		return err
	}
	if int64(len(body)) > limit {
		return errors.New("request body too large")
	}
	decoder := json.NewDecoder(strings.NewReader(string(body)))
	decoder.DisallowUnknownFields()
	return decoder.Decode(out)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func main() {
	state := newState()
	mux := http.NewServeMux()
	mux.HandleFunc("/api/hello", state.register)
	mux.HandleFunc("/api/peers", state.listPeers)
	mux.HandleFunc("/api/signal", state.postSignal)
	mux.HandleFunc("/api/signals", state.pollSignals)
	mux.HandleFunc("/api/leave", state.leave)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		data, err := assets.ReadFile("index.html")
		if err != nil {
			http.Error(w, "PoC page not found", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = io.WriteString(w, string(data))
	})
	port := strings.TrimSpace(os.Getenv("PULSYNC_POC_PORT"))
	if port == "" {
		port = "8081"
	}
	addr := ":" + port
	log.Printf("Pulsync discovery PoC listening on http://localhost%s", addr)
	log.Printf("LAN discovery is experimental; the IP grouping is only a hint, not proof of same LAN.")
	log.Fatal(http.ListenAndServe(addr, securityHeaders(mux)))
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}
