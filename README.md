# DiscordDrinkingJenga
A bot to play drinking jenga in discord

Follow steps 1-6 (use this bot's directory for step 5) of this guide
https://www.digitaltrends.com/gaming/how-to-make-a-discord-bot/
in order to set up the bot

To convert a tile set from TSV to JSON:
Step 1: Execute this substitution regex:
find: ^([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)$
replace: "$1": {"text": "$2", "count": $3,"WAITSR": $4},
Step 2: Perform some postprocessing to properly form the JSON: add surrounding curly braces and remove the end-of-line comma on the final line
Step 3: Confirm that the JSON is properly formed, and fix any small discrepancies that may arise. We encountered some discrepancies after Steps 1 and 2, but we're unsure if they were user error or mistakes in the regular expression.
