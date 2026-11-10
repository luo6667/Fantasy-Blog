package auth

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestSignParseRoundTrip(t *testing.T) {
	m := NewManager("0123456789abcdef", 7*24*time.Hour)
	token, err := m.Sign("0123456789abcdef01234567", "alice", "user")
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	claims, err := m.Parse(token)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if claims.Subject != "0123456789abcdef01234567" || claims.Username != "alice" || claims.Role != "user" {
		t.Fatalf("unexpected claims: %+v", claims)
	}
	if claims.ExpiresAt == nil || claims.IssuedAt == nil {
		t.Fatalf("missing iat/exp: %+v", claims)
	}
}

func TestParseRejectsTamperedToken(t *testing.T) {
	m := NewManager("0123456789abcdef", time.Hour)
	token, err := m.Sign("id", "alice", "user")
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("unexpected token shape: %q", token)
	}
	parts[1] = base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"id","username":"alice","role":"admin"}`))
	if _, err := m.Parse(strings.Join(parts, ".")); err == nil {
		t.Fatal("expected tampered token to be rejected")
	}
}

func TestParseRejectsOtherSecret(t *testing.T) {
	token, err := NewManager("0123456789abcdef", time.Hour).Sign("id", "alice", "user")
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	if _, err := NewManager("fedcba9876543210", time.Hour).Parse(token); err == nil {
		t.Fatal("expected token signed with another secret to be rejected")
	}
}

func TestClaimsJSONShape(t *testing.T) {
	m := NewManager("0123456789abcdef", time.Hour)
	token, err := m.Sign("id", "alice", "user")
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	payload := strings.Split(token, ".")[1]
	raw, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		t.Fatalf("decode payload: %v", err)
	}
	var claims map[string]any
	if err := json.Unmarshal(raw, &claims); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for _, key := range []string{"sub", "username", "role", "iat", "exp"} {
		if _, ok := claims[key]; !ok {
			t.Fatalf("missing claim %q in %v", key, claims)
		}
	}
}
