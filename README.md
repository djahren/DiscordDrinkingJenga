# DiscordDrinkingJenga
A bot to play drinking jenga in discord

[boilerplate about Discord authtoken]

[N O D E stuffs]

Going from TSV to JSON... ish. M, you need to update this
^([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)$
find: ^([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)$
replace: "$1": {"text": "$2", "count": $3,"WAITSR": $4},
requires minor postprocessing, eg adding surrounding curly braces and the removing end-of-line comma on the final line