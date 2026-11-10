package service

import (
	"encoding/base64"
	"strings"
	"testing"
)

func testKey(t *testing.T) []byte {
	t.Helper()
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i * 7)
	}
	return key
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := testKey(t)
	enc, err := EncryptSecret(key, "sk-secret-value")
	if err != nil {
		t.Fatalf("EncryptSecret: %v", err)
	}
	if !strings.HasPrefix(enc, "enc:v1:") {
		t.Fatalf("unexpected ciphertext prefix: %q", enc)
	}
	if !IsEncryptedSecret(enc) {
		t.Fatal("IsEncryptedSecret should detect ciphertext")
	}
	plain, err := DecryptSecret(key, enc)
	if err != nil {
		t.Fatalf("DecryptSecret: %v", err)
	}
	if plain != "sk-secret-value" {
		t.Fatalf("unexpected plaintext: %q", plain)
	}
}

func TestEncryptIsRandomized(t *testing.T) {
	key := testKey(t)
	a, err := EncryptSecret(key, "same")
	if err != nil {
		t.Fatalf("EncryptSecret: %v", err)
	}
	b, err := EncryptSecret(key, "same")
	if err != nil {
		t.Fatalf("EncryptSecret: %v", err)
	}
	if a == b {
		t.Fatal("GCM nonce should make ciphertexts differ")
	}
}

func TestDecryptKeepsLegacyPlaintext(t *testing.T) {
	plain, err := DecryptSecret(testKey(t), "legacy-plain")
	if err != nil {
		t.Fatalf("DecryptSecret: %v", err)
	}
	if plain != "legacy-plain" {
		t.Fatalf("legacy plaintext must pass through, got %q", plain)
	}
}

func TestDecodeEncKey(t *testing.T) {
	valid := base64.StdEncoding.EncodeToString(testKey(t))
	key, err := DecodeEncKey(valid)
	if err != nil || len(key) != 32 {
		t.Fatalf("DecodeEncKey: %v len=%d", err, len(key))
	}
	if _, err := DecodeEncKey(""); err == nil {
		t.Fatal("empty key must be rejected")
	}
	if _, err := DecodeEncKey(base64.StdEncoding.EncodeToString([]byte("short"))); err == nil {
		t.Fatal("short key must be rejected")
	}
}

func TestNormalizeBaseURL(t *testing.T) {
	cases := map[string]string{
		"http://127.0.0.1:4009/v1":                    "http://127.0.0.1:4009/v1/chat/completions",
		"https://api.example.com/v1/":                 "https://api.example.com/v1/chat/completions",
		"https://api.example.com/v1/chat/completions": "https://api.example.com/v1/chat/completions",
		"  https://api.example.com  ":                 "https://api.example.com/chat/completions",
	}
	for in, want := range cases {
		if got := NormalizeBaseURL(in); got != want {
			t.Errorf("NormalizeBaseURL(%q) = %q, want %q", in, got, want)
		}
	}
}
