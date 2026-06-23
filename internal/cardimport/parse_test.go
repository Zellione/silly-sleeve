package cardimport

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseCard_JSONv2(t *testing.T) {
	data := []byte(`{"spec":"chara_card_v2","spec_version":"2.0","data":{
		"name":"Ada","description":"### Appearance\ntall","personality":"calm",
		"first_mes":"Hi","tags":["sci-fi"],"creator_notes":"The Pilot"}}`)
	pc, err := ParseCard(data)
	require.NoError(t, err)
	assert.Equal(t, "v2", pc.SpecVersion)
	assert.Equal(t, "Ada", pc.Name)
	assert.Equal(t, "### Appearance\ntall", pc.Description)
	assert.Equal(t, "calm", pc.Personality)
	assert.Equal(t, "Hi", pc.FirstMes)
	assert.Equal(t, []string{"sci-fi"}, pc.Tags)
	assert.Equal(t, "The Pilot", pc.CreatorNotes)
}

func TestParseCard_JSONv1Flat(t *testing.T) {
	data := []byte(`{"name":"Bo","description":"d","first_mes":"yo","creatorcomment":"Cmt"}`)
	pc, err := ParseCard(data)
	require.NoError(t, err)
	assert.Equal(t, "v1", pc.SpecVersion)
	assert.Equal(t, "Bo", pc.Name)
	assert.Equal(t, "Cmt", pc.CreatorNotes)
}

func TestParseCard_Unrecognized(t *testing.T) {
	_, err := ParseCard([]byte("not a card"))
	assert.Error(t, err)
}

func TestParseCard_MalformedJSON(t *testing.T) {
	_, err := ParseCard([]byte("{bad"))
	assert.Error(t, err)
}
