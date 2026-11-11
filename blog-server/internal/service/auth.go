package service

import (
	"errors"

	"github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"blog-server/internal/httpx"
	"blog-server/internal/model"
)

// bcryptCost 与旧版 bcryptjs.hash(password, 10) 一致。
const bcryptCost = 10

// AuthUser 是登录返回的主体视图。
type AuthUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

// PasswordMatches 校验明文与 bcrypt 哈希（$2a$/$2b$ 均可）。
func PasswordMatches(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// HashPassword 生成 bcrypt 哈希。
func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	return string(b), err
}

// IsDuplicateKey 判断 MySQL 唯一索引冲突。
func IsDuplicateKey(err error) bool {
	var me *mysql.MySQLError
	if errors.As(err, &me) {
		return me.Number == 1062
	}
	return false
}

// SeedAdmin 创建管理员，或把已存在管理员的密码重置为给定明文。
// 密码只以 bcrypt 哈希入库，明文不会落库。返回 "created" 或 "updated"。
func SeedAdmin(db *gorm.DB, username, password string) (string, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return "", err
	}

	var admin model.Admin
	err = db.Where("username = ?", username).Take(&admin).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		admin = model.Admin{ID: NewID(), Username: username, Password: hash}
		if err := db.Create(&admin).Error; err != nil {
			return "", err
		}
		return "created", nil
	case err != nil:
		return "", err
	}

	if err := db.Model(&admin).Update("password", hash).Error; err != nil {
		return "", err
	}
	return "updated", nil
}

// LoginAdmin 校验管理员密码并返回主体。
func LoginAdmin(db *gorm.DB, username, password string) (*AuthUser, error) {
	var admin model.Admin
	err := db.Where("username = ?", username).Take(&admin).Error
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && !PasswordMatches(admin.Password, password)) {
		return nil, httpx.Unauthorized("管理员账号或密码错误")
	}
	if err != nil {
		return nil, err
	}
	return &AuthUser{ID: admin.ID, Username: admin.Username, Role: "admin"}, nil
}

// FindAdmin 按 id 查管理员，用于 token 校验。
func FindAdmin(db *gorm.DB, id string) (*AuthUser, error) {
	var admin model.Admin
	if err := db.Select("id", "username").Where("id = ?", id).Take(&admin).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httpx.Unauthorized("管理员不存在")
		}
		return nil, err
	}
	return &AuthUser{ID: admin.ID, Username: admin.Username, Role: "admin"}, nil
}
