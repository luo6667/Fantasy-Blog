package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"strings"
)

// encryptedPrefix 标识数据库中的密文（便于识别旧明文并惰性迁移）。
const encryptedPrefix = "enc:v1:"

// ErrNoEncKey 表示未配置或主密钥格式非法。
var ErrNoEncKey = errors.New("AI_CONFIG_ENC_KEY missing or invalid")

// DecodeEncKey 解码 base64 主密钥（必须为 32 字节）。
func DecodeEncKey(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, ErrNoEncKey
	}
	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil || len(key) != 32 {
		return nil, ErrNoEncKey
	}
	return key, nil
}

// EncryptSecret 用 AES-256-GCM 加密明文，输出 enc:v1:<base64(nonce||ciphertext)>。
func EncryptSecret(key []byte, plaintext string) (string, error) {
	if len(key) != 32 {
		return "", ErrNoEncKey
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return encryptedPrefix + base64.StdEncoding.EncodeToString(sealed), nil
}

// IsEncryptedSecret 判断是否为密文格式。
func IsEncryptedSecret(s string) bool { return strings.HasPrefix(s, encryptedPrefix) }

// DecryptSecret 解密密文；明文原样返回（迁移期兼容）。
func DecryptSecret(key []byte, stored string) (string, error) {
	if !IsEncryptedSecret(stored) {
		return stored, nil
	}
	if len(key) != 32 {
		return "", ErrNoEncKey
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(stored, encryptedPrefix))
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce, ct := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
