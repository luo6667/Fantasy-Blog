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

// AuthUser 是登录/注册返回的主体视图。
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

// Register 注册普通用户；用户名与管理员/普通用户冲突时返回 409。
func Register(db *gorm.DB, username, password string) (*AuthUser, error) {
	var count int64
	if err := db.Model(&model.Admin{}).Where("username = ?", username).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, httpx.Conflict("该用户名已被占用")
	}
	if err := db.Model(&model.User{}).Where("username = ?", username).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, httpx.Conflict("该用户名已被占用")
	}

	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}
	user := model.User{ID: NewID(), Username: username, Password: hash}
	if err := db.Create(&user).Error; err != nil {
		if IsDuplicateKey(err) {
			return nil, httpx.Conflict("该用户名已被占用")
		}
		return nil, err
	}
	return &AuthUser{ID: user.ID, Username: user.Username, Role: "user"}, nil
}

// LoginUser 校验普通用户密码并返回主体（token 由 handler 层签发）。
func LoginUser(db *gorm.DB, username, password string) (*AuthUser, error) {
	var user model.User
	err := db.Where("username = ?", username).Take(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && !PasswordMatches(user.Password, password)) {
		return nil, httpx.Unauthorized("用户名或密码错误")
	}
	if err != nil {
		return nil, err
	}
	return &AuthUser{ID: user.ID, Username: user.Username, Role: "user"}, nil
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
