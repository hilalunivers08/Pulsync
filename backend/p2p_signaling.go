package main

import (
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

const (
	p2pPeerTTL   = 20 * time.Second
	p2pSignalTTL = 15 * time.Second
	p2pMaxSDP    = 256 * 1024
)

type p2pPeer struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	Network  string    `json:"-"`
	LastSeen time.Time `json:"last_seen"`
}

type p2pSignal struct {
	From      string    `json:"from"`
	To        string    `json:"to"`
	Type      string    `json:"type"`
	SDP       string    `json:"sdp"`
	CreatedAt time.Time `json:"created_at"`
}

type p2pSignalingState struct {
	mu      sync.Mutex
	peers   map[string]p2pPeer
	inboxes map[string][]p2pSignal
}

func newP2PSignalingState() *p2pSignalingState {
	return &p2pSignalingState{peers: make(map[string]p2pPeer), inboxes: make(map[string][]p2pSignal)}
}

func registerP2PRoutes(mux *http.ServeMux) {
	state := newP2PSignalingState()
	mux.HandleFunc("/api/p2p/hello", state.register)
	mux.HandleFunc("/api/p2p/peers", state.listPeers)
	mux.HandleFunc("/api/p2p/signal", state.postSignal)
	mux.HandleFunc("/api/p2p/signals", state.pollSignals)
	mux.HandleFunc("/api/p2p/leave", state.leave)
}

func (s *p2pSignalingState) cleanupLocked(now time.Time) {
	for id, p := range s.peers {
		if now.Sub(p.LastSeen) > p2pPeerTTL {
			delete(s.peers, id)
			delete(s.inboxes, id)
		}
	}
	for id, queue := range s.inboxes {
		fresh := queue[:0]
		for _, item := range queue {
			if now.Sub(item.CreatedAt) <= p2pSignalTTL {
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

func (s *p2pSignalingState) register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeP2PError(w, http.StatusMethodNotAllowed, "Use POST")
		return
	}
	var in struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := decodeP2PJSON(r, &in, 4*1024); err != nil {
		writeP2PError(w, http.StatusBadRequest, "Invalid request")
		return
	}
	in.ID = strings.TrimSpace(in.ID)
	in.Name = cleanP2PName(in.Name)
	if len(in.ID) < 12 || len(in.ID) > 80 || in.Name == "" {
		writeP2PError(w, http.StatusBadRequest, "Invalid peer ID or name")
		return
	}
	ip, err := p2pRequestIP(r)
	if err != nil {
		writeP2PError(w, http.StatusBadRequest, "Could not determine client IP")
		return
	}
	now := time.Now()
	bucket := p2pNetworkBucket(ip)
	s.mu.Lock()
	s.cleanupLocked(now)
	s.peers[in.ID] = p2pPeer{ID: in.ID, Name: in.Name, Network: bucket, LastSeen: now}
	active := len(s.peers)
	s.mu.Unlock()
	log.Printf("P2P REGISTER name=%q id=%s remote_ip=%s bucket=%s active_peers=%d", in.Name, in.ID, ip.String(), bucket, active)
	writeP2PJSON(w, http.StatusOK, map[string]any{"ok": true, "expires_in_seconds": int(p2pPeerTTL.Seconds())})
}

func (s *p2pSignalingState) listPeers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeP2PError(w, http.StatusMethodNotAllowed, "Use GET")
		return
	}
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	now := time.Now()
	s.mu.Lock()
	s.cleanupLocked(now)
	self, ok := s.peers[id]
	if !ok {
		s.mu.Unlock()
		writeP2PError(w, http.StatusUnauthorized, "Peer is not registered")
		return
	}
	result := make([]p2pPeer, 0)
	for otherID, p := range s.peers {
		if otherID != id && p.Network == self.Network && now.Sub(p.LastSeen) <= p2pPeerTTL {
			p.Network = ""
			result = append(result, p)
		}
	}
	bucket := self.Network
	active := len(s.peers)
	s.mu.Unlock()
	sort.Slice(result, func(i, j int) bool { return result[i].ID < result[j].ID })
	log.Printf("P2P DISCOVERY requester=%s bucket=%s matches=%d active_peers=%d", id, bucket, len(result), active)
	writeP2PJSON(w, http.StatusOK, result)
}

func (s *p2pSignalingState) postSignal(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeP2PError(w, http.StatusMethodNotAllowed, "Use POST")
		return
	}
	var in p2pSignal
	if err := decodeP2PJSON(r, &in, p2pMaxSDP+8*1024); err != nil {
		writeP2PError(w, http.StatusBadRequest, "Invalid signal")
		return
	}
	in.From = strings.TrimSpace(in.From)
	in.To = strings.TrimSpace(in.To)
	if in.From == "" || in.To == "" || in.From == in.To || (in.Type != "offer" && in.Type != "answer") || len(in.SDP) == 0 || len(in.SDP) > p2pMaxSDP {
		writeP2PError(w, http.StatusBadRequest, "Invalid signal fields")
		return
	}
	now := time.Now()
	s.mu.Lock()
	s.cleanupLocked(now)
	from, fromOK := s.peers[in.From]
	to, toOK := s.peers[in.To]
	if !fromOK || !toOK || now.Sub(from.LastSeen) > p2pPeerTTL || now.Sub(to.LastSeen) > p2pPeerTTL {
		s.mu.Unlock()
		writeP2PError(w, http.StatusGone, "Peer offline")
		return
	}
	if from.Network != to.Network {
		s.mu.Unlock()
		writeP2PError(w, http.StatusForbidden, "Peers are not in the same network bucket")
		return
	}
	in.CreatedAt = now
	s.inboxes[in.To] = append(s.inboxes[in.To], in)
	s.mu.Unlock()
	writeP2PJSON(w, http.StatusAccepted, map[string]bool{"queued": true})
}

func (s *p2pSignalingState) pollSignals(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeP2PError(w, http.StatusMethodNotAllowed, "Use GET")
		return
	}
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	now := time.Now()
	s.mu.Lock()
	s.cleanupLocked(now)
	if _, ok := s.peers[id]; !ok {
		s.mu.Unlock()
		writeP2PError(w, http.StatusUnauthorized, "Peer is not registered")
		return
	}
	queue := append([]p2pSignal{}, s.inboxes[id]...)
	delete(s.inboxes, id)
	s.mu.Unlock()
	writeP2PJSON(w, http.StatusOK, queue)
}

func (s *p2pSignalingState) leave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeP2PError(w, http.StatusMethodNotAllowed, "Use POST")
		return
	}
	var in struct {
		ID string `json:"id"`
	}
	if err := decodeP2PJSON(r, &in, 1024); err != nil {
		writeP2PError(w, http.StatusBadRequest, "Invalid request")
		return
	}
	id := strings.TrimSpace(in.ID)
	s.mu.Lock()
	delete(s.peers, id)
	delete(s.inboxes, id)
	for inboxID, queue := range s.inboxes {
		filtered := queue[:0]
		for _, item := range queue {
			if item.From != id && item.To != id {
				filtered = append(filtered, item)
			}
		}
		if len(filtered) == 0 {
			delete(s.inboxes, inboxID)
		} else {
			s.inboxes[inboxID] = filtered
		}
	}
	s.mu.Unlock()
	writeP2PJSON(w, http.StatusOK, map[string]bool{"left": true})
}

func p2pRequestIP(r *http.Request) (net.IP, error) {
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

// The network bucket is a matchmaking hint, not proof of shared LAN membership.
func p2pNetworkBucket(ip net.IP) string {
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

func cleanP2PName(name string) string {
	name = strings.Join(strings.Fields(name), " ")
	if len(name) > 32 {
		name = name[:32]
	}
	return name
}

func decodeP2PJSON(r *http.Request, out any, limit int64) error {
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

func writeP2PJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeP2PError(w http.ResponseWriter, status int, message string) {
	writeP2PJSON(w, status, map[string]string{"error": message})
}
