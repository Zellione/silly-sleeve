package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"strconv"

	"github.com/pkg/browser"

	"silly-sleeve/internal/app"
	"silly-sleeve/internal/server"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	listen := flag.String("listen", server.DefaultAddr(),
		"listen address; if the port is taken the next free one is used (use :0 for any free port)")
	noBrowser := flag.Bool("no-browser", false, "do not open a browser window")
	flag.Parse()

	application := app.NewApp()
	// The application context bounds long-running operations; the process
	// lifetime is the right bound here.
	application.Startup(context.Background())

	dist, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		log.Fatalf("embedded frontend unavailable: %v (run `npm run build` in frontend/)", err)
	}

	srv := server.New(application, dist)
	ln, port, err := bind(*listen)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	log.Printf("Silly Sleeve is running at http://127.0.0.1:%d (Ctrl+C to stop)", port)

	if !*noBrowser {
		go openBrowser(port)
	}

	if err := srv.Serve(ln); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

// bind opens a loopback listener on the requested address. A numeric port is
// probed upward when taken; port 0 asks the OS for any free port.
func bind(addr string) (net.Listener, int, error) {
	host, portStr, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid listen address %q: %w", addr, err)
	}
	if host == "" {
		host = "127.0.0.1"
	}
	port, perr := strconv.Atoi(portStr)
	if perr != nil || port == 0 {
		ln, err := net.Listen("tcp", net.JoinHostPort(host, "0"))
		if err != nil {
			return nil, 0, err
		}
		return ln, ln.Addr().(*net.TCPAddr).Port, nil
	}
	port, err = server.ProbePort(port)
	if err != nil {
		return nil, 0, err
	}
	ln, err := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return nil, 0, err
	}
	return ln, port, nil
}

func openBrowser(port int) {
	url := fmt.Sprintf("http://127.0.0.1:%d", port)
	if err := browser.OpenURL(url); err != nil {
		log.Printf("could not open a browser automatically (%v) — open %s", err, url)
	}
}
