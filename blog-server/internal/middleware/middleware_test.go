package middleware

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func clientIPFor(remote, xff string) string {
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = remote
	if xff != "" {
		req.Header.Set("X-Forwarded-For", xff)
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = req
	return ClientIP(c)
}

func TestClientIPOnlyTrustsConfiguredProxies(t *testing.T) {
	if err := ConfigureTrustedProxies([]string{"127.0.0.1", "::1", "10.0.0.0/8"}); err != nil {
		t.Fatalf("configure: %v", err)
	}
	t.Cleanup(func() { _ = ConfigureTrustedProxies(nil) })

	cases := []struct{ name, remote, xff, want string }{
		{"trusted proxy passes client", "127.0.0.1:5555", "203.0.113.7", "203.0.113.7"},
		{"skips trusted hops right to left", "127.0.0.1:5555", "203.0.113.7, 10.1.2.3", "203.0.113.7"},
		{"direct client cannot spoof", "198.51.100.9:5555", "1.2.3.4", "198.51.100.9"},
		{"trusted proxy without header", "127.0.0.1:5555", "", "127.0.0.1"},
		{"ipv6 loopback proxy", "[::1]:5555", "203.0.113.8", "203.0.113.8"},
	}
	for _, tc := range cases {
		if got := clientIPFor(tc.remote, tc.xff); got != tc.want {
			t.Errorf("%s: got %q want %q", tc.name, got, tc.want)
		}
	}
}

func TestConfigureTrustedProxiesRejectsInvalid(t *testing.T) {
	t.Cleanup(func() { _ = ConfigureTrustedProxies(nil) })
	if err := ConfigureTrustedProxies([]string{"not-an-ip"}); err == nil {
		t.Fatal("invalid proxy entry should fail")
	}
}

func TestRateLimiterSweepsExpiredEntries(t *testing.T) {
	rl := NewRateLimiter(2, time.Minute, "slow down", "2-in-1min")
	rl.entries["1.1.1.1"] = &rateEntry{windowStart: time.Now().Add(-2 * time.Minute)}
	rl.lastSweep = time.Now().Add(-2 * time.Minute)

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.RemoteAddr = "2.2.2.2:1234"

	rl.Handler()(c)

	if _, exists := rl.entries["1.1.1.1"]; exists {
		t.Fatal("expired rate-limit entry should be swept")
	}
	if policy := rec.Header().Get("RateLimit-Policy"); !strings.Contains(policy, "2-in-1min") {
		t.Fatalf("unexpected policy header: %q", policy)
	}
}
