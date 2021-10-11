const fs = require('fs');
try{
    var prompt = require('prompt-sync')();
} catch{
    console.log("Please make sure Node is installed and run 'npm install' first.");
    process.exit()
}
var config = require('./config.json');

function confirmYesNo(question){
    var selection = ""; 
    while(selection != "y" && selection != "n"){
        selection = prompt(question + ' [Y/N]: ').trim().toLowerCase()
        switch (selection) {
            case "y":
                return true;
            case "n":
                return false;
            default:
                console.log("That's not a valid selection.")
                break;
        }
    }
}

//1. follow instructions to add bot to server
console.log("Welcome to the DrinkingJengaBot configurator! \nWe'll help you get your bot setup and ready to play!\n")
console.log("Step 1: Create your bot.\nTo get started, head to https://www.digitaltrends.com/gaming/how-to-make-a-discord-bot/ and complete steps 2-4.\n")


//2. paste token if auth.json doens't exist else note that it already exists
var auth = {}; var needToken = true;
var auth_fn = './auth.json'; 
var tokenRegex = /[M-Z][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/;

console.log("Step 2: Setup auth.json.")
if(fs.existsSync(auth_fn)){
    auth = JSON.parse(fs.readFileSync(auth_fn));
    if(auth.token && auth.token.match(tokenRegex)){
        console.log("Your token is already set in auth.json and appears to be valid.")
        needToken = confirmYesNo("Would you like to update it?")
    } else if(!auth.token.match(tokenRegex)){
        console.log("Your token is already set in auth.json and but does NOT appear to be valid.")
        needToken = confirmYesNo("Would you like to update it?")
    }
}
var token = ""
while(needToken){
    token = prompt('Please paste your bot auth token: ').trim()
    if(token){
        if(token.match(tokenRegex)){
            break;
        } else {
            //regex from https://github.com/RoBlockHead/token-scanner/blob/main/main.go
            console.log("WARNING: This token may not be valid.")
            needToken = confirmYesNo('Would you like to re-enter it?')
        }
    } else {
        console.log("invalid token");
        continue;
    }
} 
auth.token = token
fs.writeFileSync(auth_fn,JSON.stringify(auth)); 

//3. list current admins, prompt to start fresh, specify more, or continue
//https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-
console.log("\nStep 3: Setup admins.")
var selection = ""; var currentAdmins = config.permAdmins; 
while(selection != "3"){
    console.log(`\nThere are currently ${config.permAdmins.length} permanent admins specified. Would you like to: `)
    console.log("1. Add another admin.\n2. Wipe the admin list and start fresh.\n3. Continue to the next step.")
    selection = prompt('Make a selection [1-3]: ').trim()
    console.log()
    switch (selection) {
        case "1":
            console.log("1. Add another admin. Get the user's Discord ID and paste it below.")
            console.log("If you don't know how to get a user ID, visit: https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-")
            var adminID = prompt('Paste the ID of an admin: ').trim()
            if(adminID.match(/\d{18}/)){
                config.permAdmins.push(adminID)
            }
            else{
                console.log("That's not a valid user ID.")
            }
            break;
        case "2":
            config.permAdmins = []
            break;
        case "3":
            if(config.permAdmins == currentAdmins){
                console.log("No changes to admins, moving onwards.")
            }
            continue;
        default:
            console.log("That's not a valid selection.")
            break;
    }
}
    
//4. optional set channelID - skip to allow bot in any channel
console.log("\nStep 4 (Optional): Set dedicated channel ID.")
var currentChannelID = config.channelID;
var newChannelID; var channelIDSet = false;
while(!channelIDSet){
    newChannelID = prompt("Paste the dedicated channel ID (press Enter to skip): ").trim();
    if(newChannelID){
        if(newChannelID.match(/\d{18}/)){
            config.channelID = newChannelID;
            channelIDSet = true;
        }
        else{
            console.log("Invalid channel ID.")
        }
    } else { //skipped
        config.channelID = currentChannelID;
        channelIDSet = true;
    }
}

//5. show current command prefix - if you don't have other bots leave as is, change to other prefix if !help or other command conflicts
console.log("\nStep 5 (Optional): Set a custom command prefix.\n(This helps if you another bot on your server with conflicting commands - suggestions: !j or j/)\n")
if(config.commandPrefix == "!"){
    console.log("The current commandPrefix is: ! (this is the default)")
} else {
    console.log(`The current commandPrefix is: ${config.commandPrefix} (the default is: !)`)
}
var newPrefix = prompt("Set a new commandPrefix? (press Enter to skip): ").trim()
if(newPrefix){
    config.commandPrefix = newPrefix;
} else {
    newPrefix = "!" //may overwrite custom if skiped
}

//6. Save changes? 
console.log("\nStep 6: Save your changes!")
if(confirmYesNo('Would you like to save your changes to config.json?')){
    fs.writeFileSync("./config.json",JSON.stringify(config, null, 4));
}

//7. instruct to run npm start
console.log("\nStep 7: Let's Drink!\n\nYou're all done with setup. Type 'npm start' to run the bot.\nIf all went well, you should see your bot come online, if you specified a dedicated channel the bot will send a message there letting you know it's online.\n")
