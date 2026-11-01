// Package apperr 定义跨 binding 返回给前端的业务错误契约。
//
// 独立成包的原因：main 包无法被其他包导入，业务服务拆包后仍需要
// 返回统一的 AppError，否则 MarshalError 无法识别（errors.As 匹配失败），
// 前端的 business 错误分支会静默失效。
package apperr

import (
	"encoding/json"
	"errors"
)

// AppError 是跨 binding 返回的结构化业务错误。
// Code 供前端分支处理，Message 是可展示给用户的文案。
type AppError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *AppError) Error() string {
	return e.Message
}

// MarshalError 只序列化 AppError；普通 error 返回 nil 走 Wails 默认处理。
func MarshalError(err error) []byte {
	var appErr *AppError
	if !errors.As(err, &appErr) {
		return nil
	}

	data, marshalErr := json.Marshal(appErr)
	if marshalErr != nil {
		return nil
	}

	return data
}
