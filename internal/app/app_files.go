package app

// Portrait and cover-image accessors live here rather than in app.go so the
// binding surface stays grouped by concern: app.go holds project/character
// lifecycle, this file holds image I/O. They are thin, mutex-guarded accessors
// over App state — there is no logic worth pushing into a separate service.

// GetPortrait returns the portrait bytes for a character, or nil when no
// character has that ID.
func (a *App) GetPortrait(charID int) []byte {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, c := range a.characters {
		if c.ID == charID {
			return c.Portrait
		}
	}
	return nil
}

// SavePortrait stores portrait bytes for a character.
func (a *App) SavePortrait(charID int, data []byte) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	for i, c := range a.characters {
		if c.ID == charID {
			a.characters[i].Portrait = data
			return nil
		}
	}
	return charNotFound(charID)
}

// GetProjectImage returns the project-level cover image.
func (a *App) GetProjectImage() []byte {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.projectImage
}

// SaveProjectImage stores the project-level cover image.
func (a *App) SaveProjectImage(data []byte) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.projectImage = data
}
