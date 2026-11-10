// Package auth 负责 JWT 签发与校验。算法、claims 与密钥沿用旧 Node 实现，
// 使迁移期间旧 token 依旧有效。
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Actor 是鉴权后的请求主体。
type Actor struct {
	ID       string
	Username string
	Role     string
}

// Claims 是 JWT 负载：{sub, username, role, iat, exp}。
type Claims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// Manager 用一个密钥签发/校验 HS256 token。
type Manager struct {
	secret []byte
	ttl    time.Duration
}

// NewManager 构造 Manager。
func NewManager(secret string, ttl time.Duration) *Manager {
	return &Manager{secret: []byte(secret), ttl: ttl}
}

// Sign 签发 token。
func (m *Manager) Sign(id, username, role string) (string, error) {
	now := time.Now()
	claims := Claims{
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   id,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(m.ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
}

// ErrInvalidToken 表示签名/过期/格式错误。
var ErrInvalidToken = errors.New("invalid token")

// Parse 校验 token 并返回 claims。
func (m *Manager) Parse(token string) (*Claims, error) {
	claims := &Claims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, ErrInvalidToken
		}
		return m.secret, nil
	})
	if err != nil || !parsed.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
