var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var config = require('./config.json');
// var tileSet = require('./test_tiles.json');
var tileSet = require('./tiles.json');


var globalChannelId;
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
var authorizedUsers = ["188814344660844544","295692617616850956"];

var currentStack =[];
function initializeGame() {
	console.log("we initializing");
	var cloneState = JSON.parse(JSON.stringify(tileSet));
	for( let i=0; i<Object.keys(cloneState).length;i++) {
		var tilename = Object.keys(cloneState)[i];
		var tile = cloneState[tilename];
		console.log(tile);
		while(isValid(tile)) { // only adds tiles with proper count and WAITSR state
			currentStack.push( { "name":tilename, "text":tile.text } );
			tile.count--;
		}
	}
}
function shuffleStack() { // shuffle current stack with fisher-yates
	var currentIndex = currentStack.length;
	var temporaryValue, randomIndex;

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
		// Pick a remaining element
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element
		temporaryValue = currentStack[currentIndex];
		currentStack[currentIndex] = currentStack[randomIndex];
		currentStack[randomIndex] = temporaryValue;
	}
}
initializeGame();

var prevTile;
var prevUser;
var WAITSR = false;
var gameOver = true;


var userList = [];
var usersGone = [];

// currentUser = userList.filter(function(user) {!usersGone.includes(user))}).shift();


function removeUserByID(userID) {
	var l = userList.length;
	userList = userList.filter(function(user){ return user.userID != userID; });
	return l > userList.length;
}

function removeUserByName(username) {
	var l = userList.length;
	userList = userList.filter(function(user){ return user.username != username; })
	return l > userList.length;
}

// TODO: replace bad for functions
// TODO: update help cmd, add start, turnorder -> order, add !addmin
// TODO: break up help into help and admin help
// TODO: add removeadmin commands
// TODO: add clearusers command
// TODO: fix RNG, as it currently gives the same game every time
// some code we could adapt for this purpose:
// var seed = 1;
// function random() {
    // var x = Math.sin(seed++) * 10000;
    // return x - Math.floor(x);
// }
//TODO: (maybe) add on to skip command to skip X people with !skip X (could be useful if someone joins the game at the end of turn order so they can draw immediately)

function compareUsers(arr, userID) {
	for (let i=0; i < arr.length; i++ ) {
		if (userID == arr[i].userID) return true;
	}
	return false;
}

function nextUser() {
	var nextUsers=userList.filter(u => !compareUsers(usersGone, u.userID));
	console.log(nextUsers," Goes Next");
	if (nextUsers.length == 0) {
		usersGone=[];
		setTimeout(()=>{bot.sendMessage({to: globalChannelId,message: config.newRoundMsg});},1);
		return nextUser();
	}
	return nextUsers.shift();
}

function isUser(userID) {
	return compareUsers(userList,userID);
}


bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
		globalChannelId = channelID;
        switch(args[0]) {
			case 'start':
				if (gameOver) {
					gameOver = false;
					bot.sendMessage({to:channelID, message: "@"+nextUser().username + " goes first! Get things start with !draw"});
				} else {
					bot.sendMessage({to:channelID, message: "Silly @"+user + "! The game's already started!"});
				}
			break; 
			case 'draw':
				if (gameOver) {
					bot.sendMessage({to: channelID,message: config.gameOverWarn});
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
						setTimeout(()=>{bot.sendMessage({to: channelID,message: config.gameOverMsg});},1000);
					} else {
						setTimeout(()=>{bot.sendMessage({to:channelID, message: "@"+nextUser().username + " goes next!"});},2000);
					}
				} else {
					bot.sendMessage({to: channelID,message: "@"+user+": "+config.notYourTurnWarn});
				}
			break;
			case 'join':
				//console.log(userList,isUser(userID));
				if(!isUser(userID)) {
					userList.push({"username":user,"userID":userID});
					bot.sendMessage({to: channelID,message: "Welcome to the game, "+user+"!"});
				} else {
					bot.sendMessage({to: channelID,message: "@"+user+": "+config.alreadyJoinedWarn});
				}
			break;
			case 'turn':
				bot.sendMessage({to: channelID,message: "It's "+nextUser().username +"'s turn."});
			break;
			case 'order':
				var str="";
				for (let i=0; i < userList.length; i++ ) {
					if (i==0) {
						str += userList[i].username;
					} else {
						str += ", "+userList[i].username;
					}
				}
				bot.sendMessage({to: channelID,message: "Here's the turn order: "+str});
			break;
			case 'start':
			break;
			case 'leave':
				if (removeUserByID(userID)) {
					bot.sendMessage({to: channelID,message: "Okay "+user+", I've removed you from the game."});
				} else {
					bot.sendMessage({to: channelID,message:config.notAPlayerWarn });
				}
			break;
			case 'skip':
				if (isAuthorized(userID)) {
					if (userList.length > 0) {
						var skippedUser = nextUser();
						usersGone.push(skippedUser);
						bot.sendMessage({to:channelID,message: "Skipped "+skippedUser.username+"'s turn.\nNow it's @" + nextUser.username +"'s turn"});
					}
				} else {
					bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
				}
			break;
			case 'boot':
				if (isAuthorized(userID)) {
					console.log(args);
					if (removeUserByName(args[1])) {
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
					var userToAddList = userList.filter(function(user){ return user.username == args[1]; });
					if (userToAddList.length > 1) {
						bot.sendMessage({to: channelID,message: "WUT? Userlist is in bad state"});
					} else if (userToAddList.length == 1) {
						authorizedUsers.push(userToAddList[0].userID);
						bot.sendMessage({to: channelID,message: "@" + user + " added @" + userToAddList[0].username + " to the admin list."});
					} else {
						bot.sendMessage({to: channelID,message: "Whoops, looks like "+ args[1] +" isn't a player." });
					}
				} else {
					bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
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
					WAITSR = true;
					bot.sendMessage({to: channelID,message: config.sameRoomMsg});
				} else {
					bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
				}
			break;
			case 'apart':
				if (isAuthorized(userID)) {
					WAITSR = false;
					bot.sendMessage({to: channelID,message: config.apartMsg});
				} else {
					bot.sendMessage({to: channelID,message: config.unauthorizedMsg});
				}
			break;
			case 'help':
				bot.sendMessage({to: channelID,message: config.helpMsg});
			break;
			default:
				bot.sendMessage({to: channelID,message: config.unknownCmd});
         }
     }
});