var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var config = require('./config.json');
// var tileSet = require('./test_tiles.json');
var tileSet = require('./tiles.json');
var emptyUser = { username: "empty", userID: "empty"};


var globalChannelId ="";
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});

// tile is acceptable if count isn't depleted and tile WAITSR constraint satisfied
function isValid(tile) {
	return (tile.count > 0) && ( WAITSR || !tile.WAITSR );
}

function isAuthorized(userID) { return authorizedUsers.includes(userID); }
var authorizedUsers = ["188814344660844544","295692617616850956", "537797348214964225"];

var currentStack =[];
function initializeGame() {
	console.log("we initializing");
	var cloneState = JSON.parse(JSON.stringify(tileSet));
	for( let i=0; i<Object.keys(cloneState).length;i++) {
		var tilename = Object.keys(cloneState)[i];
		var tile = cloneState[tilename];
		//console.log(tile);
		while(isValid(tile)) { // only adds tiles with proper count and WAITSR state
			currentStack.push( { "name":tilename, "text":tile.text } );
			tile.count--;
		}
	}
}

var time = new Date();
var seed = time.getHours()+ time.getMinutes() * time.getSeconds();
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}
function shuffleStack() { // shuffle current stack with fisher-yates
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

// TODO: replace bad for functions

function compareUsers(arr, userID) {
	for (let i=0; i < arr.length; i++ ) {
		if (userID == arr[i].userID) return true;
	}
	return false;
}

function nextUser() {
	if (userList.length > 0) {
		var nextUsers=userList.filter(u => !compareUsers(usersGone, u.userID));
		console.log(nextUsers," Goes Next");
		if (nextUsers.length == 0) {
			usersGone=[];
			setTimeout(()=>{bot.sendMessage({to: globalChannelId,message: config.newRoundMsg});},1); // todo: do we need this timeout?
			return nextUser();
		}
		return nextUsers.shift();
	} else {
		bot.sendMessage({to: channelID,message: config.noUsersWarn });
		return emptyUser;
	}
}

function isUser(userID) {
	return compareUsers(userList,userID);
}


bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
	if (gameOver || channelID == globalChannelId) {
		if (message.substring(0, 1) == '!') {
			var args = message.substring(1).split(' ');
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
						prevUser = {"username":user,"userID":userID};
						bot.sendMessage({to: channelID,message: user + " drew \n"+prevTile.name+": \n\t"+ prevTile.text});
						console.log(prevTile.name+": "+ prevTile.text); 
						usersGone.push(prevUser)
						
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
					//console.log(userList,isUser(userID));
					if(!isUser(userID)) {
						userList.push({"username":user,"userID":userID});
						bot.sendMessage({to: channelID,message: "Welcome to the game, "+user+"!"});
					} else {
						bot.sendMessage({to: channelID,message: user+": "+config.alreadyJoinedWarn});
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
						bot.sendMessage({to: channelID,message: "Okay "+user+", I've removed you from the game."});
					} else {
						bot.sendMessage({to: channelID,message:config.notAPlayerWarn });
					}
				break;
				case 'decline':
					if (userID == prevUser.userID) {
						currentStack.push(prevTile);
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
				case 'boot':
				case 'kick':
					if (isAuthorized(userID)) {
						console.log(args);
						if (removeUserByName(args[1])) {// todo: user lookup 
							bot.sendMessage({to: channelID,message: "Okay "+user+", I've removed "+args[1]+" from the game."});
						} else {
							bot.sendMessage({to: channelID,message:config.notAPlayerWarn });
						}
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'addmin':
					if (isAuthorized(userID)) {
						var userToAddList = userList.filter(u => u.username.toLowerCase() == args[1].toLowerCase() );
						if (userToAddList.length > 1) {
							bot.sendMessage({to: channelID,message: "WUT? Userlist is in bad state"});
						} else if (userToAddList.length == 1) {
							authorizedUsers.push(userToAddList[0].userID);
							bot.sendMessage({to: channelID,message: user + " added <@" + userToAddList[0].userID + "> to the admin list."});
						} else {
							bot.sendMessage({to: channelID,message: "Whoops, looks like "+ args[1] +" isn't a player." });
						}
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
				break;
				case 'removeadmin':
					if (isAuthorized(userID)) {
						
						var userToRemoveList = userList.filter(u => u.username.toLowerCase() == args[1].toLowerCase() );
						if (userToRemoveList.length > 1) {
							bot.sendMessage({to: channelID,message: "WUT? Userlist is in bad state"});
						} else if (userToRemoveList.length == 1 && isAuthorized(userToRemoveList[0].userID)) {
							// todo: This should be a config line called permadmin
							if (userToRemoveList[0].userID == authorizedUsers[0] || userToRemoveList[0].userID == authorizedUsers[1] || userToRemoveList[0].userID == authorizedUsers[2]) {
								bot.sendMessage({to: channelID,message: "Nice try, but "+userToRemoveList[0].username+" is a permanent admin."});
							} else  {
								authorizedUsers = authorizedUsers.filter(a => a != userToRemoveList[0].userID)
								bot.sendMessage({to: channelID,message: user + " removed <@" + userToRemoveList[0].userID + "> from the admin list."});
							}
						} else {
							bot.sendMessage({to: channelID,message: "Whoops, looks like "+ args[1] +" isn't an admin or isn't playing." });
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
				case 'end': // todo: add to adminHelpMsg
					if (isAuthorized(userID)) {
						usersGone = [];
						userList = [];
						gameOver = true;
						bot.sendMessage({to: channelID,message: config.gameEndMsg});
					} else {
						bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
					}
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
				case 'adminhelp':
					bot.sendMessage({to: channelID,message: config.adminHelpMsg});
				break;
				default:
					bot.sendMessage({to: channelID,message: config.unknownCmd});
			 }
		 }
	}
});