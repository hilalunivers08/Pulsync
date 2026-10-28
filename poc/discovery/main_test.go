package main

import (
	"bytes"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNetworkBucket(t *testing.T) {
	tests := []struct {
		name  string
		left  string
		right string
		same  bool
	}{
		{name: "same private /24", left: "192.168.1.10", right: "192.168.1.77", same: true},
		{name: "different private /24", left: "192.168.1.10", right: "192.168.2.10", same: false},
		{name: "public addresses are distinct", left: "8.8.8.8", right: "1.1.1.1", same: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			left, right := net.ParseIP(tt.left), net.ParseIP(tt.right)
			got := networkBucket(left) == networkBucket(right)
			if got != tt.same {
				t.Fatalf("same bucket = %v, want %v", got, tt.same)
			}
		})
	}
}

func TestRegisterThenDiscoverSamePrivateSubnet(t *testing.T) {
	state := newState()
	register := func(id, name, remote string) {
		t.Helper()
		body, _ := json.Marshal(map[string]string{"id": id, "name": name})
		req := httptest.NewRequest(http.MethodPost, "/api/hello", bytes.NewReader(body))
		req.RemoteAddr = remote
		w := httptest.NewRecorder()
		state.register(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("register status = %d, body=%s", w.Code, w.Body.String())
		}
	}
	register("peer-test-aaaaaaaa", "Laptop A", "192.168.1.10:5000")
	register("peer-test-bbbbbbbb", "Phone B", "192.168.1.20:6000")

	req := httptest.NewRequest(http.MethodGet, "/api/peers?id=peer-test-aaaaaaaa", nil)
	req.RemoteAddr = "192.168.1.10:5000"
	w := httptest.NewRecorder()
	state.listPeers(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("list status = %d, body=%s", w.Code, w.Body.String())
	}
	var got []peer
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != "peer-test-bbbbbbbb" {
		t.Fatalf("discovered peers = %#v, want Phone B only", got)
	}
}

func TestPollSignalsReturnsEmptyArrayWhenNoPendingSignals(t *testing.T) {
	state := newState()
	id := "peer-test-empty-inbox"
	body, _ := json.Marshal(map[string]string{"id": id, "name": "Empty Inbox"})
	register := httptest.NewRequest(http.MethodPost, "/api/hello", bytes.NewReader(body))
	register.RemoteAddr = "192.168.60.10:1234"
	registered := httptest.NewRecorder()
	state.register(registered, register)
	if registered.Code != http.StatusOK {
		t.Fatalf("register status = %d, body=%s", registered.Code, registered.Body.String())
	}

	poll := httptest.NewRequest(http.MethodGet, "/api/signals?id="+id, nil)
	poll.RemoteAddr = "192.168.60.10:1234"
	polled := httptest.NewRecorder()
	state.pollSignals(polled, poll)
	if polled.Code != http.StatusOK {
		t.Fatalf("poll status = %d, body=%s", polled.Code, polled.Body.String())
	}
	var got []signal
	if err := json.Unmarshal(polled.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got == nil {
		t.Fatalf("empty inbox must be JSON array [], got %s", polled.Body.String())
	}
	if len(got) != 0 {
		t.Fatalf("pending signals = %#v, want empty array", got)
	}
}

func TestSignalQueue(t *testing.T) {
	state := newState()
	register := func(id string) {
		t.Helper()
		body, _ := json.Marshal(map[string]string{"id": id, "name": "Test"})
		req := httptest.NewRequest(http.MethodPost, "/api/hello", bytes.NewReader(body))
		req.RemoteAddr = "192.168.50.10:1234"
		w := httptest.NewRecorder()
		state.register(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("register status = %d", w.Code)
		}
	}
	from, to := "peer-test-aaaaaaaa", "peer-test-bbbbbbbb"
	register(from)
	register(to)

	body, _ := json.Marshal(signal{From: from, To: to, Type: "offer", SDP: "v=0"})
	req := httptest.NewRequest(http.MethodPost, "/api/signal", bytes.NewReader(body))
	req.RemoteAddr = "192.168.50.10:1234"
	w := httptest.NewRecorder()
	state.postSignal(w, req)
	if w.Code != http.StatusAccepted {
		t.Fatalf("signal status = %d, body=%s", w.Code, w.Body.String())
	}

	poll := httptest.NewRequest(http.MethodGet, "/api/signals?id="+to, nil)
	poll.RemoteAddr = "192.168.50.10:1234"
	polled := httptest.NewRecorder()
	state.pollSignals(polled, poll)
	if polled.Code != http.StatusOK {
		t.Fatalf("poll status = %d, body=%s", polled.Code, polled.Body.String())
	}
	var got []signal
	if err := json.Unmarshal(polled.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].From != from || got[0].Type != "offer" {
		t.Fatalf("polled signals = %#v, want one offer from sender", got)
	}
}
