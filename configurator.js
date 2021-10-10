var Discord = require('discord.io');
const fs = require('fs');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

//1. follow instructions to add bot to server
console.log("Welcome to the DrinkingJengaBot configurator! \nWe'll help you get your bot setup and ready to play!\n")
console.log("Step 1:\nTo get started, head to https://www.digitaltrends.com/gaming/how-to-make-a-discord-bot/ and complete steps 2-4.\n")


//2. paste token if auth.json doens't exist else note that it already exists
var auth = {}
console.log("Step 2:\nSetup auth.json.")

auth_fn = './auth.json'
fs.stat(auth_fn, function(err, stat) {
    var needToken = true;
    if(err == null) { //exists
        auth = JSON.parse(fs.readFileSync(auth_fn));
        if(auth.token){
            console.log("Your token is already set in auth.json, moving on!")
            needToken = false
            setupAdmins();
        }
    }
    if(needToken){
        readline.question('Please paste your bot auth token: ', token => {
            auth.token = token
            fs.writeFileSync(auth_fn,JSON.stringify(auth));
            readline.close();
            setupAdmins();
        });
    }
});

function setupAdmins(){
    //3. list current admins, prompt to start fresh, specify more, or continue
    console.log("\nStep 3:\nSetup admins.\n")

    
}

//4. optional set channelID - skip to allow bot in any channel

//5. show current command prefix - if you don't have other bots leave as is, change to other prefix if !help or other command conflicts

//6. instruct to run npm start

