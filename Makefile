clean:
	rm -rf dist/*

sneed: clean
	npm run build
	cat ./dist/4chan-XZ.user.js | xclip -selection clipboard

diagnostic: 
	tsc >> temp.txt
	