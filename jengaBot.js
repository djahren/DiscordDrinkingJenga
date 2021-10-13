/* jshint esversion: 6 */
/* jshint node: true */
try{
	//var Discord = require('discord.io');
	var { Client, Intents } = require('discord.js');
	var logger = require('winston');
	var fuzz = require('fuzzball');
} catch{
    console.log("Please make sure Node is installed and run 'npm install' first.");
    process.exit()
}
try{
	var auth = require('./auth.json');
	if(!auth.token){
		throw("auth.json exists, but no token is set.")
	}
} catch {
	console.log("Issue with auth.json. Please run 'npm run setup' first.")
	process.exit()
}

var config = require('./config.json');
const fs = require('fs');
const rw = require('random-words');
// var tileSet = require('./test_tiles.json');
var tileSet = require('./tiles.json');
var emptyUser = { username: "empty", userID: "empty"};


var globalChannelId =""; var globalChannel = {}
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Bot
const client = new Client({ intents: [Intents.FLAGS.GUILDS,Intents.FLAGS.GUILD_MESSAGES] });
// var bot = new Discord.Client({
//    token: auth.token,
//    autorun: true
// });

//Boot up bot
// bot.on('ready', function (evt) {
client.on('ready',() => {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(client.user.tag + ' - (' + client.user.id + ')');

	console.log(client)

	if(config.commandPrefix != "!"){ //replace command names in config file if non-default prefix is set.
		for(const key in config){
			if(typeof config[key] === 'string'){
				config[key] = config[key].replace(new RegExp('`!', 'g'),"`" + config.commandPrefix)
			}
		}
	}
	if(config.channelID){ //only send message if default channel is set in config
		globalChannelId = config.channelID;
		client.channels.fetch(globalChannelId)
			.then(channel => {
				console.log(channel.name);
				globalChannel = channel;
				channel.send(config.readyMsg)
			})
			.catch(console.error);
	}
	
});

// tile is acceptable if count isn't depleted and tile WAITSR constraint satisfied
function isValid(tile) {
	return (tile.count > 0) && ( WAITSR || !tile.WAITSR );
}

//Checks if a user is an Admin
function isAuthorized(userID) { return authorizedUsers.includes(userID); }
//Permadmins are unremoveable which prevents bot from getting into an unrecoverable state
function isPermAdmin(userID) { return permAdmins.includes(userID); }
var permAdmins = config.permAdmins;
var authorizedUsers = [...permAdmins]; // clone permAdmins list

var currentStack =[];
var graveyard =[];
var tileNames =[];
var prevTile;
var prevUser;
var WAITSR = false;
var gameOver = true;

var userList = [];
var usersGone = [];

var gameName = "Implement Random Words";

function initializeGame() {
	console.log("Engage!");
	graveyard =[];
	currentStack =[];
	tileNames =[];
	usersGone = [];
	gameOver = false;
	var cloneState = JSON.parse(JSON.stringify(tileSet));
	Object.keys(cloneState).forEach(title =>{
		var tilename = title;
		tileNames.push(tilename); // move to the isValid loop for WAITSR compatibility, need to account for count in this (if count ==1 ?)
		var tile = cloneState[title];
		while(isValid(tile)) { // only adds tiles with proper count and WAITSR state
			currentStack.push( { "name":tilename, "text":tile.text } );
			tile.count--;
		}
	});
}

var time = new Date();
var seed = time.getHours()+ time.getMinutes() * time.getSeconds();
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}
function shuffleStack() { // shuffle current stack with fisher-yates
	console.log("Every day I'm shufflin'");
	var currentIndex = currentStack.length;
	var temporaryValue, randomIndex;
	while (0 !== currentIndex) {// While there remain elements to shuffle
		randomIndex = Math.floor(random() * currentIndex); // Pick a remaining element
		currentIndex -= 1;
		temporaryValue = currentStack[currentIndex]; // And swap it with the current element
		currentStack[currentIndex] = currentStack[randomIndex];
		currentStack[randomIndex] = temporaryValue;
	}
}

// two problems: multiple identical tiles are being returned (might be related to tiles with count>1? though it happened with compliments so maybe not
// also, doesn't take into account current WAITSR state. look into this.
function getTileByFuzzyName(query) {
	console.log("Searching for tile with query: "+query);
	var results = fuzz.extract(query,tileNames);
	console.log("Best result: "+results[0][0]+" with score "+results[0][1]);
	console.log("Other matches: "+results[1][0]+ " ("+results[1][1]+") & "+results[2][0]+" ("+results[2][1]+")");
	return [{ "name":results[0][0], "text": tileSet[results[0][0]].text },[results[1][0],results[2][0]]];
}



//Remove players from player list
function removeUserByID(userID) {
	var l = userList.length;
	userList = userList.filter(u => u.userID != userID);
	console.log("Attempt to remove user by ID " + userID + ". Did it work?: "+ (l > userList.length) );
	return l > userList.length;
}
function removeUserByName(username) {
	var l = userList.length;
	userList = userList.filter(u => u.username.toLowerCase() != username.toLowerCase()); 
	console.log("Attempt to remove user by username " + username + ". Did it work?: "+ (l > userList.length) );
	return l > userList.length;
}

//Checks to see if a user is in a list of user objects
function compareUsers(arr, userID) { //todo: fix this so Abe is happy
	//return arr.filter(u => u.userId != userID).length == 1;
	for (let i=0; i < arr.length; i++ ) {
		if (userID == arr[i].userID) return true;
	}
	return false;
}

//Returns the next user object. Super important, be careful when messing with this
function nextUser() {
	if (userList.length > 0) {
		var nextUsers=userList.filter(u => !compareUsers(usersGone, u.userID)); //take the userList, remove everyone who has gone this round
		if (nextUsers.length == 0) { //if there are no users who haven't gone this round, reset the round and announce the fact
			usersGone=[];
			// bot.sendMessage({to: globalchannelID, message: config.newRoundMsg});
			globalChannel.send(config.newRoundMsg);
			return nextUser();
		}
		console.log(nextUsers[0].username," goes next");
		return nextUsers.shift();
	} else {
		// bot.sendMessage({to: globalchannelID, message: config.noUsersWarn });
		globalChannel.send( config.noUsersWarn );
		return emptyUser;
	}
}

//
function save() {
	var save_fn = "./saves/"+gameName+".json";
	var saveObj = { "userList": userList, "graveyard": graveyard, "authorizedUsers": authorizedUsers,
		"usersGone": usersGone, "prevTile": prevTile, "prevUser": prevUser, "currentStack": currentStack,
	"WAITSR": WAITSR, "gameOver": gameOver, "tileNames": tileNames, "gameName": gameName};
	var saveObjText = JSON.stringify(saveObj);
	fs.writeFileSync(save_fn,saveObjText);
}

function load(loadGameName) {
	var fn = "./saves/"+loadGameName+".json";
	console.log("Loading save from file: " + fn +" ...");
	// load save file
	var saveObj = JSON.parse(fs.readFileSync(fn));
	// read from save to game variables
	userList = saveObj['userList'];
	graveyard = saveObj['graveyard'];
	authorizedUsers = saveObj['authorizedUsers'];
	usersGone = saveObj['usersGone'];
	prevTile = saveObj['prevTile'];
	prevUser = saveObj['prevUser'];
	currentStack = saveObj['currentStack'];
	WAITSR = saveObj['WAITSR'];
	gameOver = saveObj['gameOver'];
	tileNames = saveObj['tileNames'];
	gameName = saveObj['gameName'];
	shuffleStack();
	console.log("Game: " + loadGameName + " successfully loaded!");
}

function rollDice(max) {
	return Math.ceil(Math.random()*max);
}

function sortTiles(inputTiles){
	return Object.keys(inputTiles).sort(function(a,b){
		return a.localeCompare(b)
	}).reduce(function (sortedTiles, key) {
		sortedTiles[key] = inputTiles[key];
		return sortedTiles;
	  }, {});
}

//Deprecated //Used to prevent anyone from double joining
// function isUser(userID) {
	// return compareUsers(userList,userID);
// }


// bot.on('message', function (username, userID, channelID, message, evt) {
client.on('message', msg =>{
	console.log(msg,msg.content)
	var username = msg.author.username;
	var userID = msg.author.id;
	var channelID = msg.channelId;
	var message = msg.content;

    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!` or commandPrefix set in config.json
	if ((gameOver || channelID == globalChannelId) && userID != client.user.id) { //ensure not to respond to own messages
		if (message.substring(0, config.commandPrefix.length) == config.commandPrefix) {
			message = message.toLowerCase();
			var args = message.substring(config.commandPrefix.length).split(' ');
			if (args.length > 1) {
				args[1] = args.slice(1).join(' ');
			}
			globalChannelId = channelID; globalChannel = msg.channel
			switch(args[0]) {
				// commands for all users
				case 'rw':
					// bot.sendMessage({to: channelID, message: rw()});
					msg.channel.send(rw());
				break;
				case 'start':
					if (gameOver) {
						if (userList.length > 0) {
							gameName = rw({exactly:2, join: '', formatter: (word, index)=> {return index === 0 ? word.slice(0,1).toUpperCase().concat(word.slice(1)) : word;}});
							console.log("Game Name: " + gameName);
							globalChannelId = channelID; globalChannel = msg.channel;
							initializeGame();
							shuffleStack();
							// bot.sendMessage({to: channelID, message: "Welcome! Your game name is " + gameName + " and we " + (WAITSR ? "ARE" : "are NOT" ) + " in the same room." +"\n\n<@"+nextUser().userID + "> goes first! Get things started with !draw"});
							msg.channel.send("Welcome! Your game name is " + gameName + " and we " + (WAITSR ? "ARE" : "are NOT" ) + " in the same room." +"\n\n<@"+nextUser().userID + "> goes first! Get things started with !draw");
						} else {
							// bot.sendMessage({to: channelID, message: config.noUsersWarn });
							msg.channel.send(config.noUsersWarn );
						}
					} else {
						// bot.sendMessage({to: channelID, message: "Silly <@"+userID + ">! The game's already started!"});
						msg.channel.send("Silly <@"+userID + ">! The game's already started!");
					}
				break;  
				case 'draw':
					if (gameOver) {
						// bot.sendMessage({to: channelID, message: config.gameOverWarn});
						msg.channel.send(config.gameOverWarn);
						break;
					}
					if (userList.length == 0) {
						// bot.sendMessage({to: channelID, message: config.noUsersWarn });
						msg.channel.send(config.noUsersWarn );
						break;
					}
					
					if (userID == nextUser().userID) {
						
						prevTile = currentStack.pop();
						graveyard.unshift(prevTile.name); //TODO: maybe replace prevtile with graveyard[0]? would have to catch nullcase. could do function?
						prevUser = {"username":username,"userID":userID};
						// bot.sendMessage({to: channelID, message: username + " drew\n**"+prevTile.name+"**:\n\t*"+ prevTile.text+"*"});
						msg.channel.send(username + " drew\n**"+prevTile.name+"**:\n\t*"+ prevTile.text+"*");
						console.log(prevTile.name+": "+ prevTile.text); 
						usersGone.push(prevUser);
						save();
						// check if game is over
						if (currentStack.length == 0 ){
							gameOver = true;
							// setTimeout(()=>{bot.sendMessage({to: channelID, message: config.gameOverMsg});},250);
							setTimeout(()=>{msg.channel.send(config.gameOverMsg);},250);
						} else {
							// setTimeout(()=>{bot.sendMessage({to: channelID, message: "<@"+nextUser().userID + "> goes next!"});},500);
							setTimeout(()=>{msg.channel.send("<@"+nextUser().userID + "> goes next!");},500);
						}
					} else {
						// bot.sendMessage({to: channelID, message: "<@"+userID+">: "+config.notYourTurnWarn});
						msg.channel.send("<@"+userID+">: "+config.notYourTurnWarn);
					}
				break;
				case 'join':
					if(!compareUsers(userList,userID)) {
						userList.push({"username":username,"userID":userID});
						// bot.sendMessage({to: channelID, message: "Welcome to the game, "+username+"!"});
						msg.channel.send("Welcome to the game, "+username+"!");
					} else {
						// bot.sendMessage({to: channelID, message: username+": "+config.alreadyJoinedWarn});
						msg.channel.send(username+": "+config.alreadyJoinedWarn);
					}
				break;
				case 'turn':
					if (userList.length > 0) {
						// bot.sendMessage({to: channelID, message: "It's <@"+nextUser().userID +">'s turn."});
						msg.channel.send("It's <@"+nextUser().userID +">'s turn.");
					} else {
						// bot.sendMessage({to: channelID, message: config.noUsersWarn });
						msg.channel.send(config.noUsersWarn );
					}
				break;
				case 'order': 
					if (userList.length > 0) {
						// bot.sendMessage({to: channelID, message: "Here's the turn order: "+userList.map(u => u.username).join(', ') });
						msg.channel.send("Here's the turn order: "+userList.map(u => u.username).join(', ') );
					} else {
						// bot.sendMessage({to: channelID, message: config.noUsersWarn });
						msg.channel.send(config.noUsersWarn );
					}
				break;
				case 'leave':
					if (removeUserByID(userID)) {
						// bot.sendMessage({to: channelID, message: "Okay "+username+", I've removed you from the game."});
						msg.channel.send("Okay "+username+", I've removed you from the game.");
					} else {
						// bot.sendMessage({to: channelID, message:config.notAPlayerWarn });
						msg.channel.send(config.notAPlayerWarn);
					}
				break;
				case 'decline':
					if (userID == prevUser.userID) {
						currentStack.push(prevTile);
						graveyard.shift();
						shuffleStack();
						// bot.sendMessage({to: channelID, message: "Tile "+prevTile.name+" added back into the game. Take a shot nerd"});
						msg.channel.send("Tile "+prevTile.name+" added back into the game. Take a shot nerd");
					} else {
						// bot.sendMessage({to: channelID, message: config.wrongUserWarn});
						msg.channel.send(config.wrongUserWarn);
					}
				break;
				case 'admins':
					var admins = userList.filter(u => isAuthorized(u.userID));
					if (admins.length > 0) {
						// bot.sendMessage({to: channelID, message: "Current in-game admins: "+admins.map(a => a.username).join(', ') });
						msg.channel.send("Current in-game admins: "+admins.map(a => a.username).join(', ') );
					} else {
						// bot.sendMessage({to: channelID, message: config.noAdminsWarn});
						msg.channel.send(config.noAdminsWarn);
					}
				break;
				case 'detail':
					if (tileNames.length > 0) {
						if (args[1]){
							var results = getTileByFuzzyName(args[1]);
							var tile = results[0];
							var didyoumean = results[1];
							// bot.sendMessage({to: channelID, message: "Description of tile **"+tile.name+"**:\n"+tile.text+"\n\n"+"*Other close matches: **"+didyoumean[0]+"** and **"+didyoumean[1]+"***"});
							msg.channel.send("Description of tile **"+tile.name+"**:\n"+tile.text+"\n\n"+"*Other close matches: **"+didyoumean[0]+"** and **"+didyoumean[1]+"***");
						} else {
							msg.channel.send(config.missingArgWarn+"\n"+config.kickUsageMsg);
						}
					} else {
						// bot.sendMessage({to: channelID, message: "No tiles have been added: "+config.gameOverWarn});
						msg.channel.send("No tiles have been added: "+config.gameOverWarn);
					}
				
				break;
				case 'tilesleft':
					if(!gameOver){
						// bot.sendMessage({to: channelID, message: "There are exactly " + currentStack.length + " tiles left in the game."});
						msg.channel.send("There are exactly " + currentStack.length + " tiles left in the game.");
					} else {
						// bot.sendMessage({to: channelID, message: "No tiles have been added: "+config.gameOverWarn});
						msg.channel.send("No tiles have been added: "+config.gameOverWarn);
					}
				break;
				case 'tileset':
					let sortedTiles = sortTiles(tileSet); //sort
					let tilesOutput = "" //concatenate 
					for(let tileName in sortedTiles){
						let tileText = ""
						if(WAITSR || (!WAITSR && !sortedTiles[tileName].WAITSR)){
							tileText = tileName + ": " + sortedTiles[tileName].text + "\n"
						}
						tilesOutput += tileText
					}
					
					fs.writeFileSync("tileset.txt",tilesOutput); //output to text file
					msg.channel.send( //send
						`All tiles${(WAITSR ? "" : " (excluding ones for same room games)")}:`, {
							files: ["./tileset.txt"]
						}
					)
					//TODO: how to upload files with discord.js
					// bot.uploadFile({to: channelID, file:"tileset.txt", // send via text file
					// 	message: `All tiles${(WAITSR ? "" : " (excluding ones for same room games)")}:`});

				break;
				case 'help':
					// bot.sendMessage({to: channelID, message: config.helpMsg});
					msg.channel.send(config.helpMsg);
				break;
				case 'gamename':
					// bot.sendMessage({to: channelID, message: "Current game name is: "+gameName});
					msg.channel.send("Current game name is: "+gameName);
				break;
				case 'roll':
					if (args[1]) {
						args[1] = parseInt(args[1]);
						if (args[1] > 0) {
							// bot.sendMessage({to: channelID, message: "Result of "+username+"'s d"+args[1]+" roll: "+rollDice(args[1])});
							msg.channel.send("Result of "+username+"'s d"+args[1]+" roll: "+rollDice(args[1]));
						} else { 
							// bot.sendMessage({to: channelID, message: config.rollUsageMsg});
							msg.channel.send(config.rollUsageMsg);
						}
					} else { 
						// bot.sendMessage({to: channelID, message: config.rollUsageMsg});
						msg.channel.send(config.rollUsageMsg);
					}
				break;
		
				// admin commands
				case 'skip':
					if (isAuthorized(userID)) {
						if (userList.length > 0) {
							var skippedUser = nextUser();
							usersGone.push(skippedUser);
							// bot.sendMessage({to: channelID, message: "Skipped <@"+skippedUser.userID + ">'s turn.\nNow it's <@" + nextUser().userID +">'s turn"});
							msg.channel.send("Skipped <@"+skippedUser.userID + ">'s turn.\nNow it's <@" + nextUser().userID +">'s turn");
						} else {
						// bot.sendMessage({to: channelID, message: config.noUsersWarn });
						msg.channel.send(config.noUsersWarn );
					}
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'admindraw':
					if (isAuthorized(userID)) {
						if (gameOver) {
							// bot.sendMessage({to: channelID, message: config.gameOverWarn});
							msg.channel.send(config.gameOverWarn);
							break;
						}
						if (userList.length == 0) {
							// bot.sendMessage({to: channelID, message: config.noUsersWarn });
							msg.channel.send(config.noUsersWarn );
							break;
						}
						
						var adminTile = currentStack.pop();
						graveyard.unshift(adminTile.name);
						// bot.sendMessage({to: channelID, message: "Admin "+username+" drew\n**"+adminTile.name+"**: \n\t*"+ adminTile.text +"*"});
						msg.channel.send("Admin "+username+" drew\n**"+adminTile.name+"**: \n\t*"+ adminTile.text +"*");
						console.log("Admin draw: "+username+" drew "+adminTile.name+": "+ adminTile.text);
						
						if (currentStack.length == 0 ){
							gameOver = true;
							// setTimeout(()=>{bot.sendMessage({to: channelID, message: config.gameOverMsg});},250);
							setTimeout(()=>{msg.channel.send(config.gameOverMsg);},250);
						}
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'boot':
				case 'kick':
					if (isAuthorized(userID)) {
						if (args[1]) {
							console.log(args);
							var userToRemove = userList.find(u => u.username.toLowerCase() == args[1].toLowerCase()); //find user's properly capitalized name
							if (userToRemove && userToRemove.username && removeUserByName(args[1])) { 
								// bot.sendMessage({to: channelID, message: "Okay "+username+", I've removed "+userToRemove.username+" from the game."});
								msg.channel.send("Okay "+username+", I've removed "+userToRemove.username+" from the game.");
							} else {
								// bot.sendMessage({to: channelID, message:config.notAPlayerWarn });
								msg.channel.send(config.notAPlayerWarn );
							}
						} else {
							// bot.sendMessage({to: channelID, message:config.missingArgWarn+"\n"+config.kickUsageMsg});
							msg.channel.send(config.missingArgWarn+"\n"+config.kickUsageMsg);
						}
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'addmin':
					if (isAuthorized(userID)) {
						if (args[1]) {
							var userToAddList = userList.filter(u => u.username.toLowerCase() == args[1].toLowerCase() );
							if (userToAddList.length > 1) {
								// bot.sendMessage({to: channelID, message: "WUT? Userlist is in bad state"});
								msg.channel.send("WUT? Userlist is in bad state");
							} else if (userToAddList.length == 1) {
								if(!isAuthorized(userToAddList[0].userID)) {
									authorizedUsers.push(userToAddList[0].userID);
									// bot.sendMessage({to: channelID, message: username + " added <@" + userToAddList[0].userID + "> to the admin list."});
									msg.channel.send(username + " added <@" + userToAddList[0].userID + "> to the admin list.");
								} else {
									// bot.sendMessage({to: channelID, message: config.alreadyAdminWarn});
									msg.channel.send(config.alreadyAdminWarn);
								}
							} else {
								// bot.sendMessage({to: channelID, message: "Whoops, looks like "+ args[1] +" isn't a player." });
								msg.channel.send("Whoops, looks like "+ args[1] +" isn't a player." );
							}
						} else {
							msg.channel.send(config.missingArgWarn+"\n"+config.addminUsageMsg);
						}
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'removeadmin':
					if (isAuthorized(userID)) {
						if (args[1]) {
							var userToRemoveList = userList.filter(u => u.username.toLowerCase() == args[1].toLowerCase() );
							if (userToRemoveList.length > 1) {
								// bot.sendMessage({to: channelID, message: "WUT? Userlist is in bad state"});
								msg.channel.send("WUT? Userlist is in bad state");
							} else if (userToRemoveList.length == 1 && isAuthorized(userToRemoveList[0].userID)) {
								if (isPermAdmin(userToRemoveList[0].userID)) {
									// bot.sendMessage({to: channelID, message: "Nice try, but "+userToRemoveList[0].username+" is a permanent admin."});
									msg.channel.send("Nice try, but "+userToRemoveList[0].username+" is a permanent admin.");
								} else  {
									authorizedUsers = authorizedUsers.filter(a => a != userToRemoveList[0].userID);
									// bot.sendMessage({to: channelID, message: username + " removed <@" + userToRemoveList[0].userID + "> from the admin list."});
									msg.channel.send(username + " removed <@" + userToRemoveList[0].userID + "> from the admin list.");
								}
							} else {
								// bot.sendMessage({to: channelID, message: "Whoops, looks like "+ args[1] +" isn't an admin or isn't playing." });
								msg.channel.send("Whoops, looks like "+ args[1] +" isn't an admin or isn't playing." );
							}
						} else {
							// bot.sendMessage({to: channelID, message:config.missingArgWarn+"\n"+config.removeadminUsageMsg});
							msg.channel.send(config.missingArgWarn+"\n"+config.removeadminUsageMsg);
						}
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'clearusers':
					if (isAuthorized(userID)) {
						userList = [];
						usersGone = [];
						// bot.sendMessage({to: channelID, message: config.usersClearMsg});
						msg.channel.send(config.usersClearMsg);
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'end':
					if (isAuthorized(userID)) {
						usersGone = [];
						userList = [];
						gameOver = true;
						// bot.sendMessage({to: channelID, message: config.gameEndMsg});
						msg.channel.send(config.gameEndMsg);
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'reset':
					if (isAuthorized(userID)) {
						initializeGame();
						shuffleStack();
						// bot.sendMessage({to: channelID, message: config.resetMsg});
						msg.channel.send(config.resetMsg);
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'shuffle':
					if (isAuthorized(userID)) {
						shuffleStack();
						// bot.sendMessage({to: channelID, message: config.shuffleMsg});
						msg.channel.send(config.shuffleMsg);
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'sameroom':
					if (isAuthorized(userID)) {
						if (args[1]) {
							switch(args[1].toLowerCase()) {
								case 'true':
									WAITSR = true;
									// bot.sendMessage({to: channelID, message: config.sameRoomMsg + (gameOver ? "" : "\n\n" + config.needResetWarn)});
									msg.channel.send(config.sameRoomMsg + (gameOver ? "" : "\n\n" + config.needResetWarn));
								break;
								case 'false':
									WAITSR = false;
									// bot.sendMessage({to: channelID, message: config.apartMsg + (gameOver ? "" : "\n\n" + config.needResetWarn)});
									msg.channel.send(config.apartMsg + (gameOver ? "" : "\n\n" + config.needResetWarn));
								break;
								default:
									// bot.sendMessage({to: channelID, message: config.invalidArgWarn});
									msg.channel.send(config.invalidArgWarn);
							} 
						} else {
							if (WAITSR) {
								// bot.sendMessage({to: channelID, message: config.sameRoomMsg});
								msg.channel.send(config.sameRoomMsg);
							} else {
								// bot.sendMessage({to: channelID, message: config.apartMsg});
								msg.channel.send(config.apartMsg);
							}
						}
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'graveyard':
					var graveyardString = graveyard.join(", ");
					if (graveyardString.length > 0){
						// bot.sendMessage({to: channelID, message: graveyardString});
						msg.channel.send(graveyardString);
					} else {
						// bot.sendMessage({to: channelID, message: config.graveyardEmptyWarn});
						msg.channel.send(config.graveyardEmptyWarn);
					}
				break;
				case 'save':
					if (isAuthorized(userID)) {
						save();
						// bot.sendMessage({to: channelID, message: config.saveInfoMsg});
						msg.channel.send(config.saveInfoMsg);
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'load':
					if (isAuthorized(userID)) {
						if (args[1]) {
							try {
								load(args[1]);
								// bot.sendMessage({to: channelID, message: "LOADED"});
								msg.channel.send("LOADED");
							} catch (err) {
								// bot.sendMessage({to: channelID, message: err});
								msg.channel.send(err);
							}
						}
						else {
							// bot.sendMessage({to: channelID, message: config.missingArgWarn});
							msg.channel.send(config.missingArgWarn);
						}
					} else {
						// bot.sendMessage({to: channelID, message: config.unauthorizedMsg});
						msg.channel.send(config.unauthorizedMsg);
						
					}
				break;
				case 'adminhelp':
					// bot.sendMessage({to: channelID, message: config.adminHelpMsg});
					msg.channel.send(config.adminHelpMsg);
				break;
				default:
					// bot.sendMessage({to: channelID, message: config.unknownCmd});
					msg.channel.send(config.unknownCmd);
			 }
		 }
	}
});

client.login(auth.token)