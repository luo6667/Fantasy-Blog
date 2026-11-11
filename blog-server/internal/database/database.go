// Package database 负责 MySQL 连接与库存在性检查。
package database

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"blog-server/internal/config"
)

// Open 打开 GORM 连接并做一次 Ping。
func Open(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(mysql.Open(cfg.MySQLDSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
		// 关闭 GORM 的复数化猜测：所有表名都由模型显式声明。
		NamingStrategy: nil,
	})
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	// 连接池：保留空闲连接避免每个请求都重新握手；限制生命周期防止被 MySQL 单方面断开。
	// 之前 MaxIdleConns(0) 会在并发下不断新建 TCP 连接，压测时直接耗尽本机临时端口。
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	if err := sqlDB.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}

// EnsureDatabase 在目标库不存在时创建（与旧版 ensureDatabase 对齐）。
func EnsureDatabase(cfg *config.Config) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=true",
		cfg.MySQLUser, cfg.MySQLPass, cfg.MySQLHost, cfg.MySQLPort)
	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return err
	}
	defer conn.Close()

	dbName := cfg.MySQLDB
	for i := 0; i < len(dbName); i++ {
		if dbName[i] == '`' {
			dbName = dbName[:i] + dbName[i+1:]
			i--
		}
	}
	_, err = conn.Exec("CREATE DATABASE IF NOT EXISTS `" + dbName + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
	return err
}
