package lorebook

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseWorldInfo_ObjectMap(t *testing.T) {
	data := []byte(`{"entries":{"1":{"uid":1,"comment":"B","key":["b"],"selectiveLogic":3,"probability":50,"characters":["7"]},"0":{"uid":0,"comment":"A","key":["a"]}}}`)
	entries, err := ParseWorldInfo(data)
	require.NoError(t, err)
	require.Len(t, entries, 2)
	assert.Equal(t, 0, entries[0].UID)
	assert.Equal(t, "A", entries[0].Comment)
	assert.Equal(t, 1, entries[1].UID)
	assert.Equal(t, 3, entries[1].SelectiveLogic)
	assert.Equal(t, 50, entries[1].Probability)
	assert.Equal(t, []string{"7"}, entries[1].Characters)
}

func TestParseWorldInfo_EntriesArray(t *testing.T) {
	data := []byte(`{"entries":[{"uid":5,"comment":"X","key":["x"]},{"uid":2,"comment":"Y"}]}`)
	entries, err := ParseWorldInfo(data)
	require.NoError(t, err)
	require.Len(t, entries, 2)
	assert.Equal(t, 2, entries[0].UID)
	assert.Equal(t, 5, entries[1].UID)
}

func TestParseWorldInfo_BareArray(t *testing.T) {
	data := []byte(`[{"uid":9,"comment":"Z"}]`)
	entries, err := ParseWorldInfo(data)
	require.NoError(t, err)
	require.Len(t, entries, 1)
	assert.Equal(t, 9, entries[0].UID)
}

func TestParseWorldInfo_EmptyInput(t *testing.T) {
	for _, in := range [][]byte{nil, []byte("   "), []byte(`{"entries":{}}`), []byte(`{}`)} {
		entries, err := ParseWorldInfo(in)
		require.NoError(t, err)
		assert.NotNil(t, entries, "expected empty slice, not nil (nil becomes null in JS and is treated as user-cancelled)")
		assert.Empty(t, entries)
	}
}

func TestParseWorldInfo_WrongFormat(t *testing.T) {
	// Valid JSON that is not a lorebook (no recognised entries field) must return an
	// empty slice — not nil — so the frontend shows "No entries found" instead of
	// treating it as user-cancelled.
	for _, in := range [][]byte{
		[]byte(`{"name":"Alice","description":"a character card"}`),
		[]byte(`{"entries":null}`),
		[]byte(`{"entries":"string instead of array"}`),
	} {
		entries, err := ParseWorldInfo(in)
		require.NoError(t, err)
		assert.NotNil(t, entries)
		assert.Empty(t, entries)
	}
}

func TestParseWorldInfo_Malformed(t *testing.T) {
	_, err := ParseWorldInfo([]byte(`{not json`))
	assert.Error(t, err)
}
