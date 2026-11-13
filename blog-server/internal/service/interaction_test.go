package service

import "testing"

func TestValidReaction(t *testing.T) {
	for _, reaction := range []string{ReactionLove, ReactionConfused, ReactionCorrection} {
		if !validReaction(reaction) {
			t.Fatalf("%q should be a supported reaction", reaction)
		}
	}
	if validReaction("like") || validReaction("") {
		t.Fatal("unsupported reactions must be rejected")
	}
}
