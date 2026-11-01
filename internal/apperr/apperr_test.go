package apperr

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
)

func TestMarshalError(t *testing.T) {
	data := MarshalError(&AppError{Code: "invalid_name", Message: "名称不能为空"})
	if data == nil {
		t.Fatal("MarshalError() = nil, want JSON")
	}

	var got AppError
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if got.Code != "invalid_name" || got.Message != "名称不能为空" {
		t.Fatalf("MarshalError() = %+v, want code=invalid_name", got)
	}

	if data := MarshalError(errors.New("plain error")); data != nil {
		t.Fatalf("MarshalError(plain) = %s, want nil", data)
	}
}

// 包装后的 AppError（errors.As 路径）也必须能被识别，
// 服务侧用 fmt.Errorf("%w", err) 加上下文时契约不能断。
func TestMarshalErrorWrapped(t *testing.T) {
	wrapped := fmt.Errorf("query users: %w", &AppError{Code: "db_down", Message: "数据库不可用"})

	data := MarshalError(wrapped)
	if data == nil {
		t.Fatal("MarshalError(wrapped) = nil, want JSON")
	}

	var got AppError
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}

	if got.Code != "db_down" {
		t.Fatalf("MarshalError(wrapped) = %+v, want code=db_down", got)
	}
}

func TestAppErrorMessage(t *testing.T) {
	err := error(&AppError{Message: "名称不能为空"})
	if err.Error() != "名称不能为空" {
		t.Fatalf("Error() = %q, want 名称不能为空", err.Error())
	}
}
