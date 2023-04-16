clean:
	rm -rf dist/*

install:
	npm run build

sneed: clean install
	cat dist/4chan-XT.user.js | xclip -selection clipboard