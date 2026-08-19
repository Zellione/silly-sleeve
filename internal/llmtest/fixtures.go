package llmtest

import (
	"silly-sleeve/internal/compose"
	"silly-sleeve/internal/crawler"
	"silly-sleeve/internal/lorebook"
)

// The fixtures are a small self-contained fantasy wiki world. They are Go
// values rather than files so every scenario gets the exact same input on
// every run — consistency numbers would mean nothing otherwise.

// FixtureCrawl returns a canned wiki page crawl about the fixture character.
func FixtureCrawl() crawler.CrawlResult {
	return crawler.CrawlResult{
		Title:  "Mira Dawnhollow",
		URL:    "https://emberfall.fandom.com/wiki/Mira_Dawnhollow",
		Domain: "emberfall.fandom.com",
		Sections: []crawler.Section{
			{
				Heading: "Overview",
				Level:   2,
				Body: "Mira Dawnhollow is the last lamplighter of Emberfall, a walled " +
					"city that fears the dark between its towers. She tends the " +
					"forty-nine ember lanterns that keep the Hollow Mist outside the " +
					"gates, a duty she inherited from her mother at seventeen.",
			},
			{
				Heading: "Appearance",
				Level:   2,
				Body: "Mira is a wiry young woman in her early twenties with soot-grey " +
					"eyes and copper hair kept in a loose braid. She wears a patched " +
					"lamplighter's coat with brass buttons, fingerless gloves, and " +
					"carries a hooked brass pole taller than she is. A faint amber glow " +
					"clings to her fingertips after years of handling ember-glass.",
			},
			{
				Heading: "Personality",
				Level:   2,
				Body: "Outwardly cheerful and quick with a joke, Mira hides a deep " +
					"fear of failing the city the way her mother did the night the " +
					"western quarter went dark. She is stubborn about doing rounds " +
					"alone, keeps promises obsessively, and talks to the lanterns as " +
					"if they were old friends.",
			},
			{
				Heading: "Abilities",
				Level:   2,
				Body: "Years among the lanterns left Mira able to sense the Hollow " +
					"Mist before it thickens. She can rekindle a dying ember lantern " +
					"with her bare hands, a talent no other lamplighter has shown, " +
					"though each rekindling leaves her briefly blind in one eye.",
			},
			{
				Heading: "History",
				Level:   2,
				Body: "Born in the lamplighters' row beneath the Emberspire, Mira " +
					"was apprenticed to her mother Serah Dawnhollow. After the Night " +
					"of Cold Glass, when seven lanterns failed at once and the mist " +
					"took the western quarter, Serah vanished beyond the gates. Mira " +
					"has tended the wall alone since, trading rumours with the " +
					"gatekeeper Bren Callow for news of her mother.",
			},
		},
		Infobox: []crawler.InfoboxEntry{
			{Key: "Full name", Value: "Mira Dawnhollow"},
			{Key: "Occupation", Value: "Lamplighter of Emberfall"},
			{Key: "Age", Value: "22"},
			{Key: "Affiliation", Value: "Lamplighters' Guild"},
			{Key: "First appearance", Value: "Chapter 1: The Forty-Ninth Lantern"},
		},
		WordCount:   240,
		StatusCode:  200,
		IsMediaWiki: true,
	}
}

// FixtureCharacter returns a filled character card, used as the "existing"
// character for rerolls and as the subject of image prompt generation.
func FixtureCharacter() compose.Character {
	return compose.Character{
		ID:      1,
		Name:    "Mira Dawnhollow",
		Epithet: "The Last Lamplighter",
		Tags:    []string{"female", "lamplighter", "fantasy", "cheerful", "haunted"},
		Appearance: "A wiry young woman in her early twenties with soot-grey eyes and " +
			"copper hair in a loose braid. Wears a patched lamplighter's coat with " +
			"brass buttons and fingerless gloves; carries a hooked brass pole. A faint " +
			"amber glow clings to her fingertips.",
		Personality: "Outwardly cheerful and quick with a joke, but privately terrified " +
			"of failing Emberfall the way her mother did. Stubborn, keeps promises " +
			"obsessively, talks to lanterns like old friends.",
		Backstory: "Inherited the lamplighter's duty at seventeen after the Night of " +
			"Cold Glass, when seven lanterns failed and her mother Serah vanished " +
			"beyond the gates. Has tended the city's forty-nine lanterns alone since.",
		Abilities: "Senses the Hollow Mist before it thickens. Can rekindle a dying " +
			"ember lantern bare-handed, at the cost of brief blindness in one eye.",
		Relationships: "Daughter of the missing lamplighter Serah Dawnhollow. Trades " +
			"rumours with Bren Callow, the gatekeeper of the western gate.",
		Quotes: []string{
			"Forty-nine lights, forty-nine promises. I don't break either.",
			"The dark isn't empty. That's the whole problem.",
		},
		Stats: []compose.StatKV{
			{Key: "Class", Value: "Lamplighter"},
			{Key: "Alignment", Value: "Neutral Good"},
		},
	}
}

// FixtureCharacters returns the project roster: the fixture character plus a
// second character the lore passes can scope and link to.
func FixtureCharacters() []compose.Character {
	bren := compose.Character{
		ID:      2,
		Name:    "Bren Callow",
		Epithet: "Gatekeeper of the Western Gate",
		Tags:    []string{"male", "gatekeeper", "veteran"},
		Appearance: "A broad, grey-bearded man in his fifties with a lantern scar " +
			"across one cheek, wearing the rust-red watch coat of the gate guard.",
		Personality: "Gruff, superstitious, and quietly protective of Mira. Never " +
			"opens the gate after dusk, no matter who asks.",
		Backstory: "Survived the Night of Cold Glass as a young guard and has kept " +
			"the western gate ever since.",
		Relationships: "Old friend of Serah Dawnhollow; keeps an eye on her daughter Mira.",
	}
	return []compose.Character{FixtureCharacter(), bren}
}

// FixtureEntries returns a small lorebook with deliberate gaps: a keyless
// entry, an unscoped character mention and default rule settings, so the
// connect and optimize passes have real work to propose.
func FixtureEntries() []lorebook.Entry {
	return []lorebook.Entry{
		{
			UID:     1,
			Comment: "Emberfall",
			Key:     []string{"Emberfall", "walled city"},
			Content: "Emberfall is a walled city that fears the dark between its " +
				"towers. Forty-nine ember lanterns along its walls keep the Hollow " +
				"Mist outside the gates.",
			Order: 100, Position: 0, Probability: 100, UseProbability: true, Depth: 4,
			KeySecondary: []string{}, Characters: []string{},
		},
		{
			UID:     2,
			Comment: "The Hollow Mist",
			Key:     []string{},
			Content: "The Hollow Mist is a sentient fog that surrounds Emberfall. It " +
				"recoils from ember-light but swallows anything that walks unlit " +
				"streets. The Night of Cold Glass was its only breach of the walls.",
			Order: 100, Position: 0, Probability: 100, UseProbability: true, Depth: 4,
			KeySecondary: []string{}, Characters: []string{},
		},
		{
			UID:     3,
			Comment: "Night of Cold Glass",
			Key:     []string{"Night of Cold Glass"},
			Content: "The night seven lanterns failed at once and the mist took the " +
				"western quarter of Emberfall. The lamplighter Serah Dawnhollow " +
				"vanished beyond the gates during the disaster.",
			Order: 100, Position: 0, Probability: 100, UseProbability: true, Depth: 4,
			KeySecondary: []string{}, Characters: []string{},
		},
		{
			UID:     4,
			Comment: "Ember lanterns",
			Key:     []string{"ember lantern", "lanterns"},
			Content: "Brass-and-glass lanterns burning ember-glass cores. Only a " +
				"lamplighter's touch can rekindle a dying core, and Mira Dawnhollow " +
				"is the only one living who has done it bare-handed.",
			Order: 100, Position: 0, Probability: 100, UseProbability: true, Depth: 4,
			KeySecondary: []string{}, Characters: []string{},
		},
	}
}
