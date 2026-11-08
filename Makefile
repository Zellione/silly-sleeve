.PHONY: build run dev

# Build frontend/dist and the production binary.
build:
	cd frontend && npm install && npm run build && cd ..
	go build -o build/bin/silly-sleeve .

# Build the frontend, then run the backend; the backend serves the frontend.
run:
	cd frontend && npm install && npm run build && cd ..
	go run .

# Same as run, but don't auto-open a browser (useful for headless development).
dev:
	cd frontend && npm install && npm run build && cd ..
	go run . -no-browser
