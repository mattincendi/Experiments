#!/bin/bash
# Mac: double-click to open the Awards Video app.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
	echo "Node.js isn't installed yet."
	echo "Install the LTS version from https://nodejs.org, then double-click this file again."
	read -r -p "Press Enter to close."
	exit 1
fi
if [ ! -d node_modules ]; then
	echo "First run: installing (this takes a minute or two)…"
	npm install || { read -r -p "Install failed. Press Enter to close."; exit 1; }
fi
npm start
