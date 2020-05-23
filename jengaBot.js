/* jshint esversion: 6 */
/* jshint node: true */
var Discord = require('discord.io');
var logger = require('winston');
var fuzz = require('fuzzball');
var auth = require('./auth.json');
var config = require('./config.json');
// var tileSet = require('./test_tiles.json');
var tileSet = require('./tiles.json');
var emptyUser = { username: "empty", userID: "empty"};


var globalChannelId ="";
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
//Boot up bot
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
	// 695648112890609695 <- hardcoded jenga text channelID
	bot.sendMessage({to: "695648112890609695",message: config.readyMsg });
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

function initializeGame() {
	console.log("Engage!");
	graveyard =[];
	var cloneState = JSON.parse(JSON.stringify(tileSet));
	Object.keys(cloneState).forEach(title =>{
		var tilename = title;
		tileNames.push(tilename);
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

var prevTile;
var prevUser;
var WAITSR = false;
var gameOver = true;

var userList = [];
var usersGone = [];

//Remove players from player list
function removeUserByID(userID) {
	var l = userList.length;
	userList = userList.filter(u => u.userID != userID);
	return l > userList.length;
}
function removeUserByName(username) {
	var l = userList.length;
	userList = userList.filter(u => u.username.toLowerCase() != username.toLowerCase()); 
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
			bot.sendMessage({to: globalChannelId,message: config.newRoundMsg});
			return nextUser();
		}
		console.log(nextUsers[0].username," goes next");
		return nextUsers.shift();
	} else {
		bot.sendMessage({to: globalChannelId,message: config.noUsersWarn });
		return emptyUser;
	}
}

//Deprecated //Used to prevent anyone from double joining
// function isUser(userID) {
	// return compareUsers(userList,userID);
// }


bot.on('message', function (username, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
	if (gameOver || channelID == globalChannelId) {
		if (message.substring(0, 1) == '!') {
			message = message.toLowerCase();
			var args = message.substring(1).split(' ');
			if (args.length > 1) {
				args[1] = args.slice(1).join(' ');
			}
			globalChannelId = channelID;
			switch(args[0]) {
				// commands for all users
				case 'start':
					if (gameOver) {
						if (userList.length > 0) {
							gameOver = false;
							globalChannelId = channelID;
							initializeGame();
							shuffleStack();
							bot.sendMessage({to:channelID, message: "<@"+nextUser().userID + "> goes first! Get things started with !draw"});
						} else {
							bot.sendMessage({to: channelID,message: config.noUsersWarn });
						}
					} else {
						bot.sendMessage({to:channelID, message: "Silly <@"+userID + ">! The game's already started!"});
					}
				break; 
				case 'draw':
					if (gameOver) {
						bot.sendMessage({to: channelID,message: config.gameOverWarn});
						break;
					}
					if (userList.length == 0) {
						bot.sendMessage({to: channelID,message: config.noUsersWarn });
						break;
					}
					
					if (userID == nextUser().userID) {
						
						prevTile = currentStack.pop();
						graveyard.unshift(prevTile.name); //TODO: maybe replace prevtile with graveyard[0]? would have to catch nullcase. could do function?
						prevUser = {"username":username,"userID":userID};
						bot.sendMessage({to: channelID,message: username + " drew \n"+prevTile.name+": \n\t"+ prevTile.text});
						console.log(prevTile.name+": "+ prevTile.text); 
						usersGone.push(prevUser);
						
						// check if game is over
						if (currentStack.length == 0 ){
							gameOver = true;
							setTimeout(()=>{bot.sendMessage({to: channelID,message: config.gameOverMsg});},250);
						} else {
							setTimeout(()=>{bot.sendMessage({to:channelID, message: "<@"+nextUser().userID + "> goes next!"});},500);
						}
					} else {
						bot.sendMessage({to: channelID,message: "<@"+userID+">: "+config.notYourTurnWarn});
					}
				break;
				case 'join':
					if(!compareUsers(userList,userID)) {
						userList.push({"username":username,"userID":userID});
						bot.sendMessage({to: channelID,message: "Welcome to the game, "+username+"!"});
					} else {
						bot.sendMessage({to: channelID,message: username+": "+config.alreadyJoinedWarn});
					}
				break;
				case 'turn':
					if (userList.length > 0) {
						bot.sendMessage({to: channelID,message: "It's <@"+nextUser().userID +">'s turn."});
					} else {
						bot.sendMessage({to: channelID,message: config.noUsersWarn });
					}
				break;
				case 'order': 
					if (userList.length > 0) {
						bot.sendMessage({to: channelID,message: "Here's the turn order: "+userList.map(u => u.username).join(', ') });
					} else {
						bot.sendMessage({to: channelID,message: config.noUsersWarn });
					}
				break;
				case 'leave':
					if (removeUserByID(userID)) {
						bot.sendMessage({to: channelID,message: "Okay "+username+", I've removed you from the game."});
					} else {
						bot.sendMessage({to: channelID,message:config.notAPlayerWarn });
					}
				break;
				case 'decline':
					if (userID == prevUser.userID) {
						currentStack.push(prevTile);
						graveyard.shift();
						shuffleStack();
						bot.sendMessage({to: channelID,message: "Tile "+prevTile.name+" added back into the game. Take a shot nerd"});
					} else {
						bot.sendMessage({to: channelID,message: config.wrongUserWarn});
					}
				break;
				case 'admins':
					var admins = userList.filter(u => isAuthorized(u.userID));
					if (admins.length > 0) {
						bot.sendMessage({to: channelID,message: "Current in-game admins: "+admins.map(a => a.username).join(', ') });
					} else {
						bot.sendMessage({to: channelID,message: config.noAdminsWarn});
					}
				break;
				case 'detail':
					if (args[1]){
						var tile = getTileByFuzzyName(args[1]);
						bot.sendMessage({to: channelID,message: "Tile detail for "+tile.name+": "+tile.text});
					} else {
						bot.sendMessage({to: channelID,message:config.missingArgWarn+"\n"+config.kickUsageMsg});
					}
				
				break;
				case 'tilesleft':
					bot.sendMessage({to:channelID, message: "There are exactly " + currentStack.length + " tiles left in the game."});
				break;
				case 'help':
					bot.sendMessage({to: channelID,message: config.helpMsg});
				break;
				
				// admin commands
				case 'skip':
					if (isAuthorized(userID)) {
						if (userList.length > 0) {
							var skippedUser = nextUser();
							usersGone.push(skippedUser);
							bot.sendMessage({to:channelID,message: "Skipped <@"+skippedUser.userID + ">'s turn.\nNow it's <@" + nextUser().userID +">'s turn"});
						} else {
						bot.sendMessage({to: channelID,message: config.noUsersWarn });
					}
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'admindraw':
					if (isAuthorized(userID)) {
						if (gameOver) {
							bot.sendMessage({to: channelID,message: config.gameOverWarn});
							break;
						}
						if (userList.length == 0) {
							bot.sendMessage({to: channelID,message: config.noUsersWarn });
							break;
						}
						
						var adminTile = currentStack.pop();
						bot.sendMessage({to: channelID,message: "Admin "+username+" drew \n"+adminTile.name+": \n\t"+ adminTile.text});
						console.log("Admin draw: "+username+" drew "+adminTile.name+": "+ adminTile.text);
						
						if (currentStack.length == 0 ){
							gameOver = true;
							setTimeout(()=>{bot.sendMessage({to: channelID,message: config.gameOverMsg});},250);
						}
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'boot':
				case 'kick':
					if (isAuthorized(userID)) {
						if (args[1]) {
							console.log(args);
							var userToRemove = userList.find(u => u.username.toLowerCase() == args[1].toLowerCase()); //find user's properly capitalized name
							if (userToRemove && userToRemove.username && removeUserByName(args[1])) { 
								bot.sendMessage({to: channelID,message: "Okay "+username+", I've removed "+userToRemove.username+" from the game."});
							} else {
								bot.sendMessage({to: channelID,message:config.notAPlayerWarn });
							}
						} else {
							bot.sendMessage({to: channelID,message:config.missingArgWarn+"\n"+config.kickUsageMsg});
						}
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'addmin':
					if (isAuthorized(userID)) {
						if (args[1]) {
							var userToAddList = userList.filter(u => u.username.toLowerCase() == args[1].toLowerCase() );
							if (userToAddList.length > 1) {
								bot.sendMessage({to: channelID,message: "WUT? Userlist is in bad state"});
							} else if (userToAddList.length == 1) {
								if(!isAuthorized(userToAddList[0].userID)) {
									authorizedUsers.push(userToAddList[0].userID);
									bot.sendMessage({to: channelID,message: username + " added <@" + userToAddList[0].userID + "> to the admin list."});
								} else {
									bot.sendMessage({to: channelID,message: config.alreadyAdminWarn});
								}
							} else {
								bot.sendMessage({to: channelID,message: "Whoops, looks like "+ args[1] +" isn't a player." });
							}
						} else {
							bot.sendMessage({to: channelID,message:config.missingArgWarn+"\n"+config.addminUsageMsg});
						}
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'removeadmin':
					if (isAuthorized(userID)) {
						if (args[1]) {
							var userToRemoveList = userList.filter(u => u.username.toLowerCase() == args[1].toLowerCase() );
							if (userToRemoveList.length > 1) {
								bot.sendMessage({to: channelID,message: "WUT? Userlist is in bad state"});
							} else if (userToRemoveList.length == 1 && isAuthorized(userToRemoveList[0].userID)) {
								if (isPermAdmin(userToRemoveList[0].userID)) {
									bot.sendMessage({to: channelID,message: "Nice try, but "+userToRemoveList[0].username+" is a permanent admin."});
								} else  {
									authorizedUsers = authorizedUsers.filter(a => a != userToRemoveList[0].userID);
									bot.sendMessage({to: channelID,message: username + " removed <@" + userToRemoveList[0].userID + "> from the admin list."});
								}
							} else {
								bot.sendMessage({to: channelID,message: "Whoops, looks like "+ args[1] +" isn't an admin or isn't playing." });
							}
						} else {
							bot.sendMessage({to: channelID,message:config.missingArgWarn+"\n"+config.removeadminUsageMsg});
						}
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'clearusers':
					if (isAuthorized(userID)) {
						userList = [];
						usersGone = [];
						bot.sendMessage({to: channelID,message: config.usersClearMsg});
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'end':
					if (isAuthorized(userID)) {
						usersGone = [];
						userList = [];
						gameOver = true;
						bot.sendMessage({to: channelID,message: config.gameEndMsg});
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'reset':
					if (isAuthorized(userID)) {
						initializeGame();
						shuffleStack();
						usersGone = [];
						gameOver = false;
						bot.sendMessage({to: channelID,message: config.resetMsg});
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'shuffle':
					if (isAuthorized(userID)) {
						shuffleStack();
						bot.sendMessage({to: channelID,message: config.shuffleMsg});
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'sameroom':
					if (isAuthorized(userID)) {
						if (args[1]) {
							switch(args[1].toLowerCase()) {
								case 'true':
									WAITSR = true;
									bot.sendMessage({to: channelID,message: config.sameRoomMsg});
								break;
								case 'false':
									WAITSR = false;
									bot.sendMessage({to: channelID,message: config.apartMsg});
								break;
								default:
									bot.sendMessage({to: channelID,message: config.invalidArgWarn});
							} 
						} else {
							if (WAITSR) {
								bot.sendMessage({to: channelID,message: config.sameRoomMsg});
							} else {
								bot.sendMessage({to: channelID,message: config.apartMsg});
							}
						}
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'graveyard':
					if (isAuthorized(userID)) {
						var graveyardString = graveyard.join(", ");
						if (graveyardString.length > 0){
							bot.sendMessage({to: channelID,message: graveyardString});
						} else {
							bot.sendMessage({to: channelID,message: config.graveyardEmptyWarn});
						}							
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'adminhelp':
					bot.sendMessage({to: channelID,message: config.adminHelpMsg});
				break;
				default:
					bot.sendMessage({to: channelID,message: config.unknownCmd});
			 }
		 }
	}
});