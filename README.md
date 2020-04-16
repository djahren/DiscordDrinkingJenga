# DiscordDrinkingJenga
A bot to play drinking jenga in discord

Download and extract this repository  
Install node  
Open a command prompt, navigate to the files you extracted  
    npm install discord.io
    npm install winston

Go to https://www.digitaltrends.com/gaming/how-to-make-a-discord-bot/ and follow steps 2-4 to get auth token and add bot to  server  
Create file auth.json in the bot directory, contents should be   

{"token":"[your token]"}

Edit config.json  

• replace permadmins with your (and your fellow admins) userIds. Google how to do this, they are 18 digit numbers, make sure to keep it in a list of strings  
• replace both instances of "Abe or Michael" with then names of your admin(s)  
Run RunBot.bat as admin



To convert a tile set from TSV to JSON:  
Step 1: Execute this substitution regex:  
find: ^([^\t]+)\t([^\t]+)\t([^\t]+)\t([^\t]+)$  
replace: "$1": {"text": "$2", "count": $3,"WAITSR": $4},  
Step 2: Perform some postprocessing to properly form the JSON: add surrounding curly braces and remove the end-of-line comma on the final line  
Step 3: Confirm that the JSON is properly formed, and fix any small discrepancies that may arise. We encountered some discrepancies after Steps 1 and 2, but we're unsure if they were user error or mistakes in the regular expression.  


