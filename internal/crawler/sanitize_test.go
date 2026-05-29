package crawler

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const sampleWikiHTML = `<div class="mw-parser-output">
<aside class="portable-infobox">
  <div data-source="race"><div class="pi-data-value">Half-elf</div></div>
  <div data-source="class"><div class="pi-data-value">Bard</div></div>
</aside>
<table class="infobox">
  <tbody>
    <tr><th>Race</th><td>Half-elf</td></tr>
    <tr><th>Class</th><td>Bard (College of Lore)</td></tr>
  </tbody>
</table>
<div class="toc" id="toc">Table of Contents</div>
<p>Elara Wynd is a half-elf bard.</p>
<h2>Appearance</h2>
<p>She wears a leather doublet.</p>
<div class="navbox">Navigation box content</div>
<h2>Personality</h2>
<p>She is cheerful.</p>
<ol class="references"><li>Ref 1</li></ol>
<ul class="gallery"><li>Gallery item</li></ul>
<p>Extra paragraph about personality.</p>
<h3>Subsection</h3>
<p>Sub content here.</p>
</div>`

func TestExtractInfobox_Portable(t *testing.T) {
	html := `<aside class="portable-infobox">
		<div data-source="race"><div class="pi-data-value">Half-elf</div></div>
		<div data-source="class"><div class="pi-data-value">Bard</div></div>
	</aside>`

	entries := ExtractInfobox(html)
	require.Len(t, entries, 2)
	assert.Equal(t, "race", entries[0].Key)
	assert.Equal(t, "Half-elf", entries[0].Value)
	assert.Equal(t, "class", entries[1].Key)
	assert.Equal(t, "Bard", entries[1].Value)
}

func TestExtractInfobox_Table(t *testing.T) {
	html := `<table class="infobox">
		<tbody>
			<tr><th>Race</th><td>Elf</td></tr>
			<tr><th>Weapon</th><td>Sword</td></tr>
		</tbody>
	</table>`

	entries := ExtractInfobox(html)
	require.Len(t, entries, 2)
	assert.Equal(t, "Race", entries[0].Key)
	assert.Equal(t, "Elf", entries[0].Value)
	assert.Equal(t, "Weapon", entries[1].Key)
	assert.Equal(t, "Sword", entries[1].Value)
}

func TestExtractInfobox_Empty(t *testing.T) {
	entries := ExtractInfobox("<p>No infobox here</p>")
	assert.Empty(t, entries)
}

func TestExtractInfobox_NoInfobox(t *testing.T) {
	entries := ExtractInfobox("<p>Just a paragraph</p>")
	assert.Empty(t, entries)
}

func TestExtractSections_Basic(t *testing.T) {
	html := `<h2>Appearance</h2><p>Tall and dark.</p><h2>Personality</h2><p>Friendly.</p>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 2)
	assert.Equal(t, "Appearance", sections[0].Heading)
	assert.Equal(t, "Tall and dark.", sections[0].Body)
	assert.Equal(t, "Personality", sections[1].Heading)
	assert.Equal(t, "Friendly.", sections[1].Body)
}

func TestExtractSections_WithLede(t *testing.T) {
	html := `<p>A lede paragraph without a heading.</p><h2>Section One</h2><p>Content here.</p>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 2)
	assert.Equal(t, "", sections[0].Heading)
	assert.Equal(t, "A lede paragraph without a heading.", sections[0].Body)
	assert.Equal(t, "Section One", sections[1].Heading)
}

func TestExtractSections_SkipsNavbox(t *testing.T) {
	html := `<h2>Good</h2><p>Content.</p><div class="navbox">Skip me</div>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 1)
	assert.Equal(t, "Good", sections[0].Heading)
	assert.NotContains(t, sections[0].Body, "Skip me")
}

func TestExtractSections_SkipsTOC(t *testing.T) {
	html := `<div id="toc">TOC</div><h2>Section</h2><p>Content.</p>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 1)
	assert.Equal(t, "Section", sections[0].Heading)
}

func TestExtractSections_SkipsReferences(t *testing.T) {
	html := `<h2>Section</h2><p>Content.</p><ol class="references"><li>Ref</li></ol>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 1)
	assert.NotContains(t, sections[0].Body, "Ref")
}

func TestExtractSections_SkipsGallery(t *testing.T) {
	html := `<h2>Section</h2><p>Content.</p><ul class="gallery"><li>Image</li></ul>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 1)
	assert.NotContains(t, sections[0].Body, "Image")
}

func TestExtractSections_IncludesGalleryWithOption(t *testing.T) {
	html := `<h2>Section</h2><p>Content.</p><ul class="gallery"><li>Image text</li></ul>`

	sections := ExtractSections(html, map[string]bool{"gallery": true})
	require.Len(t, sections, 1)
	assert.Contains(t, sections[0].Body, "Image text")
}

func TestExtractSections_SkipsScriptAndStyle(t *testing.T) {
	html := `<script>alert('xss')</script><h2>Safe</h2><p>Clean content.</p><style>.bad{}</style>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 1)
	assert.Equal(t, "Safe", sections[0].Heading)
	assert.Equal(t, "Clean content.", sections[0].Body)
}

func TestExtractSections_MultipleParagraphs(t *testing.T) {
	html := `<h2>Section</h2><p>First paragraph.</p><p>Second paragraph.</p>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 1)
	assert.Contains(t, sections[0].Body, "First paragraph.")
	assert.Contains(t, sections[0].Body, "Second paragraph.")
}

func TestExtractSections_ParagraphSeparation(t *testing.T) {
	html := `<h2>Section</h2><p>First paragraph.</p><p>Second paragraph.</p>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 1)
	assert.Equal(t, "First paragraph.\n\nSecond paragraph.", sections[0].Body)
}

func TestExtractSections_BrInParagraph(t *testing.T) {
	html := `<h2>Section</h2><p>Line one.<br>Line two.</p>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 1)
	assert.Contains(t, sections[0].Body, "Line one.\nLine two.")
}

func TestExtractSections_H3Headings(t *testing.T) {
	html := `<h2>Main</h2><p>Main content.</p><h3>Sub</h3><p>Sub content.</p>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 2)
	assert.Equal(t, "Main", sections[0].Heading)
	assert.Equal(t, 2, sections[0].Level)
	assert.Equal(t, "Sub", sections[1].Heading)
	assert.Equal(t, 3, sections[1].Level)
}

func TestExtractSections_EmptyInput(t *testing.T) {
	sections := ExtractSections("", nil)
	assert.Empty(t, sections)
}

func TestExtractSections_MalformedHTML(t *testing.T) {
	sections := ExtractSections("<p>Unclosed paragraph", nil)
	assert.Len(t, sections, 1)
	assert.Equal(t, "Unclosed paragraph", sections[0].Body)
}

func TestExtractSections_SkipsNavigationHeading(t *testing.T) {
	html := `<h2>Appearance</h2><p>Tall.</p><h2>Navigation</h2><h2>Personality</h2><p>Friendly.</p>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 2)
	assert.Equal(t, "Appearance", sections[0].Heading)
	assert.Equal(t, "Personality", sections[1].Heading)
}

func TestExtractSections_SkipsNavigationCaseInsensitive(t *testing.T) {
	html := `<h2>Appearance</h2><p>Tall.</p><h2>NAVIGATION</h2><h2>Personality</h2><p>Friendly.</p>`

	sections := ExtractSections(html, nil)
	require.Len(t, sections, 2)
	assert.Equal(t, "Appearance", sections[0].Heading)
	assert.Equal(t, "Personality", sections[1].Heading)
}

func TestSanitize_FullPipeline(t *testing.T) {
	sections, infobox := Sanitize(sampleWikiHTML, nil)

	assert.NotEmpty(t, infobox)
	assert.NotEmpty(t, sections)

	for _, s := range sections {
		assert.NotContains(t, s.Body, "Navigation box")
		assert.NotContains(t, s.Body, "Ref 1")
		assert.NotContains(t, s.Body, "Gallery item")
		assert.NotContains(t, s.Body, "Table of Contents")
	}
}

func TestWordCount_Empty(t *testing.T) {
	assert.Equal(t, 0, WordCount(""))
}

func TestWordCount_Basic(t *testing.T) {
	assert.Equal(t, 4, WordCount("One two three four"))
}

func TestWordCount_ExtraSpaces(t *testing.T) {
	assert.Equal(t, 3, WordCount("  Hello   world  test  "))
}

func TestWordCount_WithNewlines(t *testing.T) {
	assert.Equal(t, 3, WordCount("Hello\n\nWorld\nTest"))
}

func TestTotalWordCount(t *testing.T) {
	sections := []Section{
		{Heading: "Intro", Body: "Welcome to this page"},
		{Heading: "Details", Body: "More information here"},
	}
	infobox := []InfoboxEntry{
		{Key: "race", Value: "Elf"},
	}

	count := TotalWordCount(sections, infobox)
	assert.Greater(t, count, 5)
}

func TestSectionsFromRawHTML(t *testing.T) {
	html := `<p>Lede text here.</p><h2>Appearance</h2><p>Tall.</p><h2>Appearance</h2><p>Duplicate heading.</p>`

	sections, _ := SectionsFromRawHTML(html, nil)
	assert.NotEmpty(t, sections)

	if len(sections) > 0 && sections[0].Heading == "" {
		assert.Equal(t, 1, sections[0].Level)
	}
}

func TestCleanInfoboxText(t *testing.T) {
	result := cleanInfoboxText("  Hello\nWorld  ")
	assert.Equal(t, "Hello World", result)

	result = cleanInfoboxText("a\u00a0b")
	assert.Equal(t, "a b", result)
}

func TestCleanText(t *testing.T) {
	result := cleanText("  Hello\nWorld\tTest  ")
	assert.Equal(t, "Hello World Test", result)
}

func TestCleanParagraph(t *testing.T) {
	result := cleanParagraph("  Hello  World  ")
	assert.Equal(t, "Hello World", result)
}

func TestSanitize_MinePage(t *testing.T) {
	html := `<div class="mw-parser-output">
<aside class="portable-infobox pi-background pi-border-color pi-theme-wikia pi-layout-default">
<h2 class="pi-item pi-item-spacing pi-title pi-secondary-background" data-source="name">Mine</h2>
<div class="pi-item pi-data pi-item-spacing pi-border-color" data-source="katakana">
<h3 class="pi-data-label pi-secondary-font"><b>Kanji/Kana</b></h3>
<div class="pi-data-value pi-font">マイン</div>
</div>
<div class="pi-item pi-data pi-item-spacing pi-border-color" data-source="age">
<h3 class="pi-data-label pi-secondary-font"><b>Age</b></h3>
<div class="pi-data-value pi-font">Teens</div>
</div>
</aside>
<div id="toc" class="toc" role="navigation"><h2>Contents</h2></div>
<h2><span class="mw-headline" id="Appearance">Appearance</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><span class="mw-editsection-bracket">]</span></span></h2>
<p>Mine is a young girl of below-average height.</p>
<h2><span class="mw-headline" id="Personality">Personality</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><span class="mw-editsection-bracket">]</span></span></h2>
<p>Often quick to anger, and easily irritated.</p>
<h2><span class="mw-headline" id="Equipment_and_Skills">Equipment and Skills</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><span class="mw-editsection-bracket">]</span></span></h2>
<p>Mine wielded a powerful Teigu.</p>
<table class="toccolours mw-collapsible mw-collapsed"><tr><td>Navigation content</td></tr></table>
</div>`

	sections, infobox := Sanitize(html, nil)

	assert.NotEmpty(t, infobox)
	assert.Len(t, infobox, 3)
	assert.Equal(t, "name", infobox[0].Key)
	assert.Equal(t, "Mine", infobox[0].Value)
	assert.Equal(t, "katakana", infobox[1].Key)
	assert.Equal(t, "マイン", infobox[1].Value)
	assert.Equal(t, "age", infobox[2].Key)
	assert.Equal(t, "Teens", infobox[2].Value)

	for _, s := range sections {
		assert.NotContains(t, s.Heading, "[", "heading %q contains brackets", s.Heading)
		assert.NotContains(t, s.Heading, "]", "heading %q contains brackets", s.Heading)
		assert.NotContains(t, s.Heading, "edit", "heading %q contains edit", s.Heading)
		assert.NotEqual(t, "Kanji/Kana", s.Heading, "infobox key leaked into section heading")
		assert.NotEqual(t, "Age", s.Heading, "infobox key leaked into section heading")
		assert.NotContains(t, s.Body, "Navigation content", "nav table leaked into section body")
		assert.NotContains(t, s.Body, "Contents", "TOC leaked into section body")
	}

	var headings []string
	for _, s := range sections {
		if s.Heading != "" {
			headings = append(headings, s.Heading)
		}
	}
	assert.Contains(t, headings, "Appearance")
	assert.Contains(t, headings, "Personality")
	assert.Contains(t, headings, "Equipment and Skills")
}

func TestCleanHeading_StripsBrackets(t *testing.T) {
	assert.Equal(t, "Appearance", cleanHeading("Appearance[]"))
	assert.Equal(t, "Personality", cleanHeading("Personality[]"))
	assert.Equal(t, "Equipment and Skills", cleanHeading("Equipment and Skills[]"))
}

func TestCleanHeading_StripsEdit(t *testing.T) {
	assert.Equal(t, "Equipment and Skills", cleanHeading("Equipment and Skills edit"))
	assert.Equal(t, "Appearance", cleanHeading("Appearance edit"))
}

func TestCleanHeading_NoChange(t *testing.T) {
	assert.Equal(t, "Normal heading", cleanHeading("Normal heading"))
	assert.Equal(t, "Normal heading", cleanHeading("Normal heading "))
}

func TestCleanHeading_OnlyBrackets(t *testing.T) {
	assert.Equal(t, "", cleanHeading("[]"))
}

func TestGetTextContent_SkipsEditsection(t *testing.T) {
	html := `<h2><span class="mw-headline">Appearance</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a>edit</a><span class="mw-editsection-bracket">]</span></span></h2>`
	sections := ExtractSections(html, nil)
	require.Len(t, sections, 1)
	assert.Equal(t, "Appearance", sections[0].Heading)
}

func TestGetTextContent_SkipsPortableInfobox(t *testing.T) {
	html := `<aside class="portable-infobox"><h3>Should Not Appear</h3></aside><h2>Real Section</h2><p>Real content.</p>`
	sections := ExtractSections(html, nil)
	require.Len(t, sections, 1)
	assert.Equal(t, "Real Section", sections[0].Heading)
	assert.NotContains(t, sections[0].Heading, "Should")
}

func TestExtractSections_NavigationWithContent(t *testing.T) {
	html := `<h2>Introduction</h2><p>Intro text.</p><h2>Navigation</h2><p>Nav text.</p><h2>After</h2><p>After text.</p>`
	sections := ExtractSections(html, nil)
	require.Len(t, sections, 2)
	assert.Equal(t, "Introduction", sections[0].Heading)
	assert.Equal(t, "After", sections[1].Heading)
}
