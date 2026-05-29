package crawler

// CrawlOptions configures a crawl operation.
type CrawlOptions struct {
	FollowLinks int              `json:"followLinks"`
	Include     map[string]bool  `json:"include"`
}

// Section represents a parsed heading + body pair.
type Section struct {
	Heading string `json:"heading"`
	Body    string `json:"body"`
	Level   int    `json:"level"`
}

// InfoboxEntry is a key/value pair from a wiki infobox.
type InfoboxEntry struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Section string `json:"section,omitempty"`
}

// CrawlResult holds the parsed content from a crawled page.
type CrawlResult struct {
	Title      string         `json:"title"`
	URL        string         `json:"url"`
	Domain     string         `json:"domain"`
	RawHTML    string         `json:"rawHtml"`
	Sections   []Section      `json:"sections"`
	Infobox    []InfoboxEntry `json:"infobox"`
	WordCount  int            `json:"wordCount"`
	StatusCode int            `json:"statusCode"`
	LatencyMs  int64          `json:"latencyMs"`
}
