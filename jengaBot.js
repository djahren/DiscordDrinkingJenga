/* jshint esversion: 6 */
/* jshint node: true */
try{
	var { Client, Intents } = require('discord.js');
	var logger = require('winston');
	var fuzz = require('fuzzball');
	var fs = require('fs');
	var rw = require('random-words');
} catch{
    console.log("Please make sure Node (version 16.6.0 or greater) is installed and run 'npm install' first. To see your version of Node, run 'node -v'.");
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
// var tileSet = require('./test_tiles.json');
var tileSet = require('./tiles.json');
var emptyUser = { username: "empty", userID: "empty", nickname: "empty"};


var globalChannel = {}; var globalGuild = { };
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Bot
const client = new Client({ intents: [Intents.FLAGS.GUILDS,Intents.FLAGS.GUILD_MESSAGES] });

//Boot up bot
client.on('ready',() => {
    logger.info('Connected');
    logger.info('Logged in as: ' + client.user.tag);

	if(config.commandPrefix != "!"){ //replace command names in config file if non-default prefix is set.
		for(const key in config){
			if(typeof config[key] === 'string'){
				config[key] = config[key].replace(new RegExp('`!', 'g'),"`" + config.commandPrefix)
			}
		}
	}
	if(config.channelID){ //only send message if default channel is set in config
		client.channels.fetch(config.channelID)
			.then(channel => {
				globalChannel = channel;
				globalGuild = channel.guild;
				logChannelInfo();
				channel.send(config.readyMsg)
			})
	}
});

function logChannelInfo() {
	logger.info('Now using channel: ' + globalChannel.name + ', in Guild: ' + globalGuild.name + ' which is ' + (globalGuild.available ? 'ONLINE' : 'OFFLINE') + ' with ' + globalGuild.memberCount + ' members');
}

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
		var tile = cloneState[title];
		while(isValid(tile)) { // only adds tiles with proper count and WAITSR state
			currentStack.push( { "name":tilename, "text":tile.text } );
			if (tile.count == 1) tileNames.push(tilename);
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
	let success = l > userList.length
	console.log("Attempt to remove user by ID " + userID + ". Did it work?: "+ success );
	return success;
}
function removeUserByName(username) {
	var l = userList.length;
	userList = userList.filter(u => u.username.toLowerCase() != username.toLowerCase()); 
	let success = l > userList.length
	console.log("Attempt to remove user by username " + username + ". Did it work?: "+ success );
	return success;
}
function removeUserByNickname(nickname) { // this function isn't currently used, might not be necessary
	var l = userList.length;
	userList = userList.filter(u => u.nickname.toLowerCase() != nickname.toLowerCase());
	let success = l > userList.length
	console.log("Attempt to remove user by nickname " + nickname + ". Did it work?: "+ success );
	return success;
}

//Checks to see if a user is in a list of user objects
function compareUsers(arr, userID) { //todo: fix this so Abe is happy
	//return arr.filter(u => u.userId != userID).length == 1;
	for (let i=0; i < arr.length; i++ ) {
		if (userID == arr[i].userID) return true;
	}
	return false;
}

async function updateUserNicknames() {
	// get list of ingame userIDs, and fetch their member objects
	let fetchOptions = { user: userList.map(u => u.userID) };
	let ingameGuildMembers = await globalGuild.members.fetch(fetchOptions);
	// for every user, update their nickname attribute
	ingameGuildMembers.forEach((member,id) => {
		let userIdx = userList.findIndex(u => u.userID == id);
		if (userIdx > -1) userList[userIdx].nickname = member.nickname;
	})
}

//Returns the next user object. Super important, be careful when messing with this
function nextUser() {
	if (userList.length > 0) {
		var nextUsers=userList.filter(u => !compareUsers(usersGone, u.userID)); //take the userList, remove everyone who has gone this round
		if (nextUsers.length == 0) { //if there are no users who haven't gone this round, reset the round and announce the fact
			usersGone=[];
			globalChannel.send(config.newRoundMsg);
			return nextUser();
		}
		console.log(nextUsers[0].username," goes next");
		return nextUsers.shift();
	} else {
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


client.on('messageCreate', msg =>{
	var username = msg.author.username;
	var userID = msg.author.id;
	var nickname = msg.member.nickname;
	var message = msg.content;

    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!` or commandPrefix set in config.json
	if ((gameOver || msg.channelId == globalChannel.id) && userID != client.user.id) { //ensure not to respond to own messages
		if (message.substring(0, config.commandPrefix.length) == config.commandPrefix) {
			message = message.toLowerCase();
			var args = message.substring(config.commandPrefix.length).split(' ');
			if (args.length > 1) {
				args[1] = args.slice(1).join(' ');
			}
			if (msg.channelId != globalChannel.id) {
				globalChannel = msg.channel; 
				globalGuild = msg.guild;
				logChannelInfo();
			}
			updateUserNicknames();
			switch(args[0]) {
				// commands for all users
				case 'rw':
					msg.channel.send(rw());
				break;
				case 'start':
					if (gameOver) {
						if (userList.length > 0) {
							gameName = rw({exactly:2, join: '', formatter: (word, index)=> {return index === 0 ? word.slice(0,1).toUpperCase().concat(word.slice(1)) : word;}});
							console.log("Game Name: " + gameName);
							initializeGame();
							shuffleStack();
							msg.channel.send("Welcome! Your game name is " + gameName + " and we " + (WAITSR ? "ARE" : "are NOT" ) + " in the same room." +"\n\n<@"+nextUser().userID + "> goes first! Get things started with !draw");
						} else {
							msg.channel.send(config.noUsersWarn );
						}
					} else {
						msg.channel.send("Silly <@"+userID + ">! The game's already started!");
					}
				break;  
				case 'draw':
					if (gameOver) {
						msg.channel.send(config.gameOverWarn);
						break;
					}
					if (userList.length == 0) {
						msg.channel.send(config.noUsersWarn );
						break;
					}
					
					if (userID == nextUser().userID) {
						
						prevTile = currentStack.pop();
						graveyard.unshift(prevTile.name); //TODO: maybe replace prevtile with graveyard[0]? would have to catch nullcase. could do function?
						prevUser = {"username":username,"userID":userID,"nickname":nickname};
						msg.channel.send(nickname + " drew\n**"+prevTile.name+"**:\n\t*"+ prevTile.text+"*");
						console.log(prevTile.name+": "+ prevTile.text); 
						usersGone.push(prevUser);
						save();
						// check if game is over
						if (currentStack.length == 0 ){
							gameOver = true;
							setTimeout(()=>{msg.channel.send(config.gameOverMsg);},250);
						} else {
							setTimeout(()=>{msg.channel.send("<@"+nextUser().userID + "> goes next!");},500);
						}
					} else {
						msg.channel.send("<@"+userID+">: "+config.notYourTurnWarn);
					}
				break;
				case 'join':
					if(!compareUsers(userList,userID)) {
						userList.push({"username":username,"userID":userID,"nickname":nickname});
						msg.channel.send("Welcome to the game, "+nickname+"!");
					} else {
						msg.channel.send(nickname+": "+config.alreadyJoinedWarn);
					}
				break;
				case 'turn':
					if (userList.length > 0) {
						msg.channel.send("It's <@"+nextUser().userID +">'s turn.");
					} else {
						msg.channel.send(config.noUsersWarn );
					}
				break;
				case 'order': 
					if (userList.length > 0) {
						msg.channel.send("Here's the turn order: "+userList.map(u => u.nickname).join(', ') );
					} else {
						msg.channel.send(config.noUsersWarn );
					}
				break;
				case 'leave':
					if (removeUserByID(userID)) {
						msg.channel.send("Okay "+nickname+", I've removed you from the game.");
					} else {
						msg.channel.send(config.notAPlayerWarn);
					}
				break;
				case 'decline':
					if (userID == prevUser.userID) {
						currentStack.push(prevTile);
						graveyard.shift();
						shuffleStack();
						msg.channel.send("Tile "+prevTile.name+" added back into the game. Take a shot nerd");
					} else {
						msg.channel.send(config.wrongUserWarn);
					}
				break;
				case 'admins':
					var admins = userList.filter(u => isAuthorized(u.userID));
					if (admins.length > 0) {
						msg.channel.send("Current in-game admins: "+admins.map(a => a.nickname).join(', ') );
					} else {
						msg.channel.send(config.noAdminsWarn);
					}
				break;
				case 'detail':
					if (tileNames.length > 0) {
						if (args[1]){
							var results = getTileByFuzzyName(args[1]);
							var tile = results[0];
							var didyoumean = results[1];
							msg.channel.send("Description of tile **"+tile.name+"**:\n"+tile.text+"\n\n"+"*Other close matches: **"+didyoumean[0]+"** and **"+didyoumean[1]+"***");
						} else {
							msg.channel.send(config.missingArgWarn+"\n"+config.kickUsageMsg);
						}
					} else {
						msg.channel.send("No tiles have been added: "+config.gameOverWarn);
					}
				
				break;
				case 'tilesleft':
					if(!gameOver){
						msg.channel.send("There are exactly " + currentStack.length + " tiles left in the game.");
					} else {
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
					msg.channel.send(`All tiles${(WAITSR ? "" : " (excluding ones for same room games)")}:`)
					msg.channel.send({files: [{attachment: "./tileset.txt", name:"tileset.txt"}]})

				break;
				case 'help':
					msg.channel.send(config.helpMsg);
				break;
				case 'gamename':
					msg.channel.send("Current game name is: "+gameName);
				break;
				case 'roll':
					if (args[1]) {
						args[1] = parseInt(args[1]);
						if (args[1] > 0) {
							msg.channel.send("Result of "+nickname+"'s d"+args[1]+" roll: "+rollDice(args[1]));
						} else { 
							msg.channel.send(config.rollUsageMsg);
						}
					} else { 
						msg.channel.send(config.rollUsageMsg);
					}
				break;
				case 'graveyard':
					var graveyardString = graveyard.join(", ");
					if (graveyardString.length > 0){
						msg.channel.send(graveyardString);
					} else {
						msg.channel.send(config.graveyardEmptyWarn);
					}
				break;
				
				// admin commands
				case 'skip':
					if (isAuthorized(userID)) {
						if (userList.length > 0) {
							var skippedUser = nextUser();
							usersGone.push(skippedUser);
							msg.channel.send("Skipped <@"+skippedUser.userID + ">'s turn.\nNow it's <@" + nextUser().userID +">'s turn");
						} else {
						msg.channel.send(config.noUsersWarn );
					}
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'admindraw':
					if (isAuthorized(userID)) {
						if (gameOver) {
							msg.channel.send(config.gameOverWarn);
							break;
						}
						if (userList.length == 0) {
							msg.channel.send(config.noUsersWarn );
							break;
						}
						
						var adminTile = currentStack.pop();
						graveyard.unshift(adminTile.name);
						msg.channel.send("Admin "+nickname+" drew\n**"+adminTile.name+"**: \n\t*"+ adminTile.text +"*");
						console.log("Admin draw: "+username+" drew "+adminTile.name+": "+ adminTile.text);
						
						if (currentStack.length == 0 ){
							gameOver = true;
							setTimeout(()=>{msg.channel.send(config.gameOverMsg);},250);
						}
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'boot':
				case 'kick':
					if (isAuthorized(userID)) {
						if (args[1]) {
							console.log(args);
							let userToRemove;
							//find correct user by username or nickname
							if (!(userToRemove = userList.find(u => u.username.toLowerCase() == args[1].toLowerCase())))
								userToRemove = userList.find(u => u.nickname.toLowerCase()==args[1].toLowerCase());
							
							if (userToRemove && userToRemove.username && removeUserByName(userToRemove.username)) { // if argument matches a user, remove them
								msg.channel.send("Okay "+nickname+", I've removed "+userToRemove.nickname+" from the game.");
							} else {
								msg.channel.send(config.notAPlayerWarn );
							}
							
							
						} else {
							msg.channel.send(config.missingArgWarn+"\n"+config.kickUsageMsg);
						}
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'addmin':
					if (isAuthorized(userID)) {
						if (args[1]) {
							var userToAddList = userList.filter(u => u.username.toLowerCase() == args[1].toLowerCase());
							if (userToAddList.length == 0)
								userToAddList = userList.filter(u => u.nickname.toLowerCase() == args[1].toLowerCase());
							if (userToAddList.length > 1) {
								msg.channel.send("WUT? Userlist is in bad state");
							} else if (userToAddList.length == 1) {
								if(!isAuthorized(userToAddList[0].userID)) {
									authorizedUsers.push(userToAddList[0].userID);
									msg.channel.send(nickname + " added <@" + userToAddList[0].userID + "> to the admin list.");
								} else {
									msg.channel.send(config.alreadyAdminWarn);
								}
							} else {
								msg.channel.send("Whoops, looks like "+ args[1] +" isn't a player." );
							}
						} else {
							msg.channel.send(config.missingArgWarn+"\n"+config.addminUsageMsg);
						}
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'removeadmin':
					if (isAuthorized(userID)) {
						if (args[1]) {
							var userToRemoveList = userList.filter(u => u.username.toLowerCase() == args[1].toLowerCase() );
							if (userToAddList.length == 0)
								userToAddList = userList.filter(u => u.nickname.toLowerCase() == args[1].toLowerCase());
							if (userToRemoveList.length > 1) {
								msg.channel.send("WUT? Userlist is in bad state");
							} else if (userToRemoveList.length == 1 && isAuthorized(userToRemoveList[0].userID)) {
								if (isPermAdmin(userToRemoveList[0].userID)) {
									msg.channel.send("Nice try, but "+userToRemoveList[0].nickname+" is a permanent admin.");
								} else  {
									authorizedUsers = authorizedUsers.filter(a => a != userToRemoveList[0].userID);
									msg.channel.send(nickname + " removed <@" + userToRemoveList[0].userID + "> from the admin list.");
								}
							} else {
								msg.channel.send("Whoops, looks like "+ args[1] +" isn't an admin or isn't playing." );
							}
						} else {
							msg.channel.send(config.missingArgWarn+"\n"+config.removeadminUsageMsg);
						}
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'clearusers':
					if (isAuthorized(userID)) {
						userList = [];
						usersGone = [];
						msg.channel.send(config.usersClearMsg);
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'end':
					if (isAuthorized(userID)) {
						usersGone = [];
						userList = [];
						gameOver = true;
						msg.channel.send(config.gameEndMsg);
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'reset':
					if (isAuthorized(userID)) {
						initializeGame();
						shuffleStack();
						msg.channel.send(config.resetMsg);
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'shuffle':
					if (isAuthorized(userID)) {
						shuffleStack();
						msg.channel.send(config.shuffleMsg);
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'sameroom':
					if (isAuthorized(userID)) {
						if (args[1]) {
							switch(args[1].toLowerCase()) {
								case 'true':
									WAITSR = true;
									msg.channel.send(config.sameRoomMsg + (gameOver ? "" : "\n\n" + config.needResetWarn));
								break;
								case 'false':
									WAITSR = false;
									msg.channel.send(config.apartMsg + (gameOver ? "" : "\n\n" + config.needResetWarn));
								break;
								default:
									msg.channel.send(config.invalidArgWarn);
							} 
						} else {
							if (WAITSR) {
								msg.channel.send(config.sameRoomMsg);
							} else {
								msg.channel.send(config.apartMsg);
							}
						}
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'save':
					if (isAuthorized(userID)) {
						save();
						msg.channel.send(config.saveInfoMsg);
					} else {
						msg.channel.send(config.unauthorizedMsg);
					}
				break;
				case 'load':
					if (isAuthorized(userID)) {
						if (args[1]) {
							try {
								load(args[1]);
								msg.channel.send("LOADED");
							} catch (err) {
								msg.channel.send(err);
							}
						}
						else {
							msg.channel.send(config.missingArgWarn);
						}
					} else {
						msg.channel.send(config.unauthorizedMsg);
						
					}
				break;
				case 'adminhelp':
					msg.channel.send(config.adminHelpMsg);
				break;
				default:
					msg.channel.send(config.unknownCmd);
			 }
		 }
	}
});

client.login(auth.token)