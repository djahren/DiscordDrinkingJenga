const fs = require('fs');
const rl = require('readline')
var config = require('./config.json');
var colors = {
    "red": "\x1b[31m%s\x1b[0m",
    "yellow": "\x1b[33m%s\x1b[0m",
    "cyan": "\x1b[36m%s\x1b[0m"
}

async function prompt(question){ //modifed from https://stackoverflow.com/a/46700053
    const readline = rl.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    var promptInput = await new Promise((resolve, reject) => {
        readline.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
    readline.close();
    return promptInput;
}

async function confirmYesNo(question){
    var selection = ""; 
    while(selection != "y" && selection != "n"){
        selection = await prompt(question + ' [Y/N]: '); 
        switch (selection.toLowerCase()) {
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

async function configurator(){
//1. follow instructions to add bot to server
console.log(colors.cyan,"Welcome to the DiscordDrinkingJenga configurator!")
console.log("We'll help you get your bot setup and ready to play!")
console.log(colors.cyan,"\nStep 1: Create your bot.")
console.log("To get started, head to https://www.digitaltrends.com/gaming/how-to-make-a-discord-bot/ and complete steps 2-4.\nMake sure your bot has permission to View Channels and Send Messages.")


//2. paste token if auth.json doens't exist else note that it already exists
var auth = {}; 
var auth_fn = './auth.json'; 
var tokenRegex = /[M-Z][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/;
//regex from https://github.com/RoBlockHead/token-scanner/blob/main/main.go

console.log(colors.cyan, "\nStep 2: Setup auth.json.")
var token = ""; var needToken = true;
if(fs.existsSync(auth_fn)){
    try{
        auth = JSON.parse(fs.readFileSync(auth_fn)); //throws error on empty file
        if(auth.token){
            token = auth.token;
            if(auth.token.match(tokenRegex)){
                console.log("Your token is already set in auth.json and appears to be valid.")
                needToken = await confirmYesNo("Would you like to update it?")
            } else if(!auth.token.match(tokenRegex)){
                console.log(colors.red, "Your token is already set in auth.json and but does NOT appear to be valid.")
                needToken = await confirmYesNo("Would you like to update it?")
            }
        } 
    } catch {
        console.log(colors.red, "auth.json exists but does NOT appear to be valid.")
    } 
}

while(needToken){
    token = await prompt('Please paste your bot auth token: ')
    if(token){
        if(token.match(tokenRegex)){
            needToken = false
            break;
        } else {
            console.log(colors.yellow,"WARNING: This token may not be valid.")
            needToken = await confirmYesNo('Would you like to re-enter it?')
        }
    } else {
        console.log(colors.red,"Invalid token.");
        continue;
    }
}
auth.token = token

//3. list current admins, prompt to start fresh, specify more, or continue
//https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-
console.log(colors.cyan,"\nStep 3: Setup admins.")
var selection = ""; var currentAdmins = config.permAdmins; 
while(selection != "3"){
    console.log(`\nThere are currently ${config.permAdmins.length} permanent admins specified. Would you like to: `)
    console.log("1. Add another admin.\n2. Wipe the admin list and start fresh.\n3. Continue to the next step.")
    selection = await prompt('Make a selection [1-3]: ')
    console.log()
    switch (selection) {
        case "1":
            console.log("1. Add another admin. Get the user's Discord ID and paste it below.")
            console.log("If you don't know how to get a user ID, visit: https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-")
            var adminID = await prompt('Paste the ID of an admin: ')
            if(adminID.match(/\d{18}/)){
                config.permAdmins.push(adminID)
            }
            else{
                console.log(colors.red,"That's not a valid user ID.")
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
            console.log(colors.yellow,"That's not a valid selection.")
            break;
    }
}
console.log(colors.yellow, "Note: You may want to manually edit config.json and replace both instances of 'Abe or Michael' with your admin's name(s).")
//TODO: replace names with code instead
    
//4. optional set channelID - skip to allow bot in any channel
console.log(colors.cyan,"\nStep 4 (Optional): Set dedicated channel ID.")
var currentChannelID = config.channelID;
var newChannelID; var channelIDSet = false;
while(!channelIDSet){
    newChannelID = await prompt("Paste the dedicated channel ID (press Enter to skip): ");
    if(newChannelID){
        if(newChannelID.match(/\d{18}/)){
            config.channelID = newChannelID;
            channelIDSet = true;
        }
        else{
            console.log(colors.red,"Invalid channel ID.")
        }
    } else { //skipped
        config.channelID = currentChannelID;
        channelIDSet = true;
    }
}

//5. show current command prefix - if you don't have other bots leave as is, change to other prefix if !help or other command conflicts
console.log(colors.cyan,"\nStep 5 (Optional): Set a custom command prefix.")
console.log("(This helps if you another bot on your server with conflicting commands - suggestions: !j or j/)\n")
if(config.commandPrefix == "!"){
    console.log("The current commandPrefix is: ! (this is the default)")
} else {
    console.log(`The current commandPrefix is: ${config.commandPrefix} (the default is: !)`)
}
var newPrefix = await prompt("Set a new commandPrefix? (press Enter to skip): ")
if(newPrefix){
    config.commandPrefix = newPrefix;
}

//6. Save changes? 
console.log(colors.cyan,"\nStep 6: Save your changes!")
if(await confirmYesNo('Would you like to save your changes to config.json?')){
    fs.writeFileSync(auth_fn,JSON.stringify(auth));
    fs.writeFileSync("./config.json",JSON.stringify(config, null, 4));
}

//7. instruct to run npm start
console.log(colors.cyan,"\nStep 7: Let's Drink!")
console.log("You're all done with setup. Type 'npm start' to run the bot.\nIf all went well, you should see your bot come online, if you specified a dedicated channel the bot will send a message there letting you know it's online.\n")
}

configurator();
