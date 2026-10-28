package main

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestP2PNetworkBucketGroupsPrivateIPv4By24(t *testing.T) {
	ips := []string{"192.168.1.3", "192.168.1.4"}
	var buckets []string
	for _, raw := range ips {
		ip := net.ParseIP(raw)
		buckets = append(buckets, p2pNetworkBucket(ip))
	}
	if buckets[0] != buckets[1] {
		t.Fatalf("expected same /24 bucket, got %q and %q", buckets[0], buckets[1])
	}
}

func TestP2PEmptySignalsIsJSONArray(t *testing.T) {
	mux := http.NewServeMux()
	registerP2PRoutes(mux)

	register := httptest.NewRequest(http.MethodPost, "/api/p2p/hello", strings.NewReader(`{"id":"peer-id-123456","name":"Nova"}`))
	register.RemoteAddr = "192.168.1.4:40000"
	registerRecorder := httptest.NewRecorder()
	mux.ServeHTTP(registerRecorder, register)
	if registerRecorder.Code != http.StatusOK {
		t.Fatalf("register status: got %d, want %d: %s", registerRecorder.Code, http.StatusOK, registerRecorder.Body.String())
	}

	poll := httptest.NewRequest(http.MethodGet, "/api/p2p/signals?id=peer-id-123456", nil)
	poll.RemoteAddr = "192.168.1.4:40000"
	pollRecorder := httptest.NewRecorder()
	mux.ServeHTTP(pollRecorder, poll)
	if pollRecorder.Code != http.StatusOK {
		t.Fatalf("poll status: got %d, want %d", pollRecorder.Code, http.StatusOK)
	}
	var body []json.RawMessage
	if err := json.Unmarshal(pollRecorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("poll should return a JSON array, got %q: %v", pollRecorder.Body.String(), err)
	}
	if body == nil || len(body) != 0 {
		t.Fatalf("expected empty JSON array, got %s", pollRecorder.Body.String())
	}
}

func TestP2PDiscoveryReturnsReportedDeviceType(t *testing.T) {
	mux := http.NewServeMux()
	registerP2PRoutes(mux)

	registerPeer := func(id, name, deviceType, remoteAddr string) {
		t.Helper()
		payload := `{"id":"` + id + `","name":"` + name + `","device_type":"` + deviceType + `"}`
		req := httptest.NewRequest(http.MethodPost, "/api/p2p/hello", strings.NewReader(payload))
		req.RemoteAddr = remoteAddr
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)
		if recorder.Code != http.StatusOK {
			t.Fatalf("register %s: got %d, want %d: %s", name, recorder.Code, http.StatusOK, recorder.Body.String())
		}
	}

	registerPeer("peer-id-desktop-1", "DesktopUser", "desktop", "192.168.1.4:40000")
	registerPeer("peer-id-phone-01", "PhoneUser", "phone", "192.168.1.3:40000")

	req := httptest.NewRequest(http.MethodGet, "/api/p2p/peers?id=peer-id-desktop-1", nil)
	req.RemoteAddr = "192.168.1.4:40000"
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("list peers: got %d, want %d: %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	var peers []p2pPeer
	if err := json.Unmarshal(recorder.Body.Bytes(), &peers); err != nil {
		t.Fatalf("decode peers: %v", err)
	}
	if len(peers) != 1 {
		t.Fatalf("expected one peer, got %d", len(peers))
	}
	if peers[0].DeviceType != "phone" {
		t.Fatalf("expected device_type phone, got %q", peers[0].DeviceType)
	}
}
