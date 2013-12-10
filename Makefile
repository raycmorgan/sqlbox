test:
	SQLBOX_ENV=TEST ./node_modules/.bin/mocha test/*.test.js test/*/*.test.js

.PHONY: test