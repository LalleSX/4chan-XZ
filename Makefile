clean:
	rm -rf dist/*

sneed: clean
	npm run build
	cat ./dist/4chan-XT.user.js | xclip -selection clipboard

diagnostic: 
	tsc >> temp.txt
	