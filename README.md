# DiscordDrinkingJenga
A bot to play drinking jenga in discord

Follow steps 1-6 (use this bot's directory for step 5) of this guide
https://www.digitaltrends.com/gaming/how-to-make-a-discord-bot/
in order to set up the bot

Going from TSV to JSON... ish. M, you need to update this
^([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)$
find: ^([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)$
replace: "$1": {"text": "$2", "count": $3,"WAITSR": $4},
requires minor postprocessing, eg adding surrounding curly braces and the removing end-of-line comma on the final line