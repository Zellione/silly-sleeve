package server

import (
	"encoding/json"
	"net/http"
	"reflect"
	"strconv"
)

// maxRPCBody caps RPC request bodies. Arguments are small (form state,
// character fields); anything bigger indicates a bug or an attack, not a
// legitimate call.
const maxRPCBody = 16 << 20 // 16 MiB

// dispatch implements the JSON RPC bridge: POST /api/{Method} with a JSON
// array of positional arguments. The response body is the JSON-encoded return
// value ("null" for methods without one); a method error becomes
// {"error": "..."} with status 400.
//
// This mirrors the Wails bridge semantics the frontend was built against:
// one return value plus an error, the call "rejects" with the error message.
func (s *Server) dispatch(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("method")
	m, ok := s.methods[name]
	if !ok {
		writeError(w, http.StatusNotFound, "unknown method "+name)
		return
	}

	var raw []json.RawMessage
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRPCBody)).Decode(&raw); err != nil {
		writeError(w, http.StatusBadRequest, "arguments must be a JSON array: "+err.Error())
		return
	}

	mt := m.Type()
	if mt.NumIn() != len(raw) {
		writeError(w, http.StatusBadRequest,
			"method "+name+" takes "+strconv.Itoa(mt.NumIn())+" argument(s), got "+strconv.Itoa(len(raw)))
		return
	}

	args := make([]reflect.Value, len(raw))
	for i := range raw {
		v := reflect.New(mt.In(i))
		if err := json.Unmarshal(raw[i], v.Interface()); err != nil {
			writeError(w, http.StatusBadRequest, "argument "+strconv.Itoa(i+1)+": "+err.Error())
			return
		}
		args[i] = v.Elem()
	}

	outs := m.Call(args)

	hasErr := mt.NumOut() > 0 && mt.Out(mt.NumOut()-1) == errorType
	valueOuts := mt.NumOut() - boolInt(hasErr)
	if hasErr {
		if err := outs[valueOuts].Interface().(error); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	switch valueOuts {
	case 0:
		_, _ = w.Write([]byte("null"))
	case 1:
		if err := json.NewEncoder(w).Encode(outs[0].Interface()); err != nil {
			return
		}
	default:
		vals := make([]any, valueOuts)
		for i := range vals {
			vals[i] = outs[i].Interface()
		}
		if err := json.NewEncoder(w).Encode(vals); err != nil {
			return
		}
	}
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// writeError sends a JSON error body with the given status.
func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
