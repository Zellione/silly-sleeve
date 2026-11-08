// Package server exposes the app to a normal browser: a JSON RPC bridge over
// the bound App methods (POST /api/{Method}), an SSE event stream for
// backend→UI push (GET /api/events), and static serving of the built frontend.
//
// It replaces the Wails v2 bridge. All heavy work stays in the Go backend;
// the browser is a thin input/output shell talking over localhost, so nothing
// here authenticates and the listener binds to the loopback interface.
package server

import (
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"reflect"
	"strconv"

	"silly-sleeve/internal/app"
)

// defaultPort is the first port the binary tries for the local server.
const defaultPort = 8090

// excludedMethods are exported App methods that must not be reachable through
// the RPC bridge: they are lifecycle wiring for the server layer itself, not
// user-facing operations.
var excludedMethods = map[string]bool{
	"SetEventSink": true,
	"Startup":      true,
}

// Server is the local HTTP server for one app instance.
type Server struct {
	app     *app.App
	hub     *Hub
	dist    fs.FS
	methods map[string]reflect.Value
}

// New creates a Server for a. dist is the built frontend tree (an fs.Sub of
// the embedded dist directory); pass nil in tests to disable static serving.
// The app's event sink is wired to the server's SSE hub.
func New(a *app.App, dist fs.FS) *Server {
	s := &Server{
		app:     a,
		hub:     NewHub(),
		dist:    dist,
		methods: map[string]reflect.Value{},
	}
	v := reflect.ValueOf(a)
	for i := 0; i < v.NumMethod(); i++ {
		name := v.Type().Method(i).Name
		m := v.Method(i)
		if excludedMethods[name] {
			continue
		}
		if !validBridgeSignature(m.Type()) {
			continue
		}
		s.methods[name] = m
	}
	a.SetEventSink(s.hub.Publish)
	return s
}

// validBridgeSignature reports whether a method can be exposed through the
// bridge: at most one return value plus an error (the same constraint the
// Wails bridge enforced, which is why the app returns wrapper structs like
// ImagePromptResult instead of multiple values).
func validBridgeSignature(t reflect.Type) bool {
	if t.NumOut() > 2 {
		return false
	}
	if t.NumOut() == 2 {
		return t.Out(1) == errorType
	}
	return true
}

// Handler assembles the HTTP handler tree.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("POST /api/upload", s.handleUpload)
	mux.HandleFunc("GET /api/download", s.handleDownload)
	mux.HandleFunc("POST /api/events", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusMethodNotAllowed, "use GET")
	})
	mux.HandleFunc("GET /api/events", s.handleEvents)
	mux.HandleFunc("POST /api/{method}", s.dispatch)
	mux.HandleFunc("/", s.handleStatic)
	return mux
}

// Serve serves HTTP on the given listener until it fails or is closed.
func (s *Server) Serve(ln net.Listener) error {
	return (&http.Server{Handler: s.Handler()}).Serve(ln)
}

// ProbePort returns the first free loopback TCP port at or after base,
// scanning forward. The caller must still retry the actual bind: a port can
// be taken between the probe and the Listen call.
func ProbePort(base int) (int, error) {
	const scan = 128
	for p := base; p < base+scan; p++ {
		// NOSONAR: loopback-only probe listener, closed immediately below;
		// the address is built from the fixed 127.0.0.1 prefix.
		ln, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(p)) // NOSONAR
		if err != nil {
			continue
		}
		// Probe only: a close error cannot affect port selection.
		_ = ln.Close()
		return p, nil
	}
	return 0, fmt.Errorf("no free port in %d..%d", base, base+scan-1)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"ok":true}`))
}

// DefaultAddr is the default listen address (loopback, defaultPort).
func DefaultAddr() string {
	return "127.0.0.1:" + strconv.Itoa(defaultPort)
}

// ListenDefault opens a loopback listener on defaultPort, scanning upward if
// the port is taken.
func ListenDefault() (net.Listener, int, error) {
	port, err := ProbePort(defaultPort)
	if err != nil {
		return nil, 0, err
	}
	ln, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(port))
	if err != nil {
		// The port was taken between probe and listen; scan again once.
		port, perr := ProbePort(defaultPort + 1)
		if perr != nil {
			return nil, 0, perr
		}
		ln, err = net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(port))
		if err != nil {
			return nil, 0, err
		}
	}
	return ln, port, nil
}

var errorType = reflect.TypeFor[error]()
