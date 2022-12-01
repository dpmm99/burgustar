require('./shared.js'); //Code shared between the client and server, but the server has to refer to it with the prefix Shared because Node. I put it all in the global scope because that's where it belongs--I don't want to repeat "Shared." for every single variable and function. DRY.

const Buffer = require("buffer").Buffer;
const mysql = require("mysql");
const crypto = require('crypto');
const fetch = require('node-fetch');
const util = require('util');

/** Open the database connection and run the given query with the given parameters, then return the result. */
async function query(sql, params) {
	var db = mysql.createConnection({ multipleStatements: true, host: "localhost", user: process.env.DBUSER || "localuser", password: process.env.DBPASS || "local", database: process.env.DBNAME || "burgustar" }); //Hard-coded the password for my local machine's MySQL DB user. ;)
	await util.promisify(db.connect).call(db);
	var result = await util.promisify(db.query).call(db, sql, params);
	await util.promisify(db.end).call(db);
	return result;
}

/** Get a hexadecimal string representation of the (secure) hash of the given string */
async function stringHash(text) { //Was async when I was using the Web standard crypto module, but the version of Node on my web host doesn't have that.
	return crypto.createHash("sha256").update(text).digest('base64');
}

/** Check for a valid, unexpired session in the database with the given ID. Returns just the player ID as a scalar. */
async function validateSession(sessionID) {
	var response = await query("SELECT player_id FROM burgustar_sessions WHERE id = ? AND expires > NOW()", [sessionID]);
	return response.length ? response[0].player_id : undefined; //No valid session -> return undefined (because null is already a valid value for player_id)
}

/** Create a new client session in the database and return the (cryptographically-secure) session ID. */
async function newSession() {
	var newSessionID = crypto.randomBytes(15).toString('base64');
	await query("INSERT INTO burgustar_sessions (id, expires) VALUES (?, ?)", [newSessionID, new Date(new Date().setDate(new Date().getDate() + 7))]);
	return newSessionID;
}

/** After getting the user info from Discord's API, call this along with their session ID to ensure that their Discord data (including their Discord ID, if they didn't have a record in our DB before) is up-to-date and ensure the session is set to point to the appropriate player record ID. */
async function playerLoggingIn(discordUserObject, sessionID) {
	var response = await query(`SET @id = NULL;SET @discord_id = ?;
SELECT id INTO @id FROM burgustar_players WHERE discord_id = @discord_id;
INSERT INTO burgustar_players (id, discord_id, avatar, display_name, discriminator) VALUES (@id, @discord_id, ?, ?, ?)
	ON DUPLICATE KEY UPDATE avatar=VALUES(avatar), display_name=VALUES(display_name), discriminator=VALUES(discriminator);
SET @id = COALESCE(@id, CAST(LAST_INSERT_ID() AS SIGNED));
UPDATE burgustar_sessions SET player_id = @id WHERE id = ?;
SELECT @id AS ID;`, [discordUserObject.id, discordUserObject.avatar, discordUserObject.username, discordUserObject.discriminator, sessionID]);
	return response[response.length - 1][0].ID; //Their internal ID, brand new or otherwise
}

/** Search the players list in the database and get {id, name} pairs back for players whose name starts with the given search string */
async function searchPlayers(searchString) {
	searchString = searchString.split("#"); //now [0] is the name and [1] is the discriminator or undefined. The whole string should have already been validated by the server's player search endpoint to only contain alphanumeric characters, so we can safely use them directly in the query string.
	var discriminatorLike = searchString[1] !== undefined && searchString[1].length && searchString[1].length <= 4 ? "AND discriminator LIKE '" + searchString[1] + "%'" : "";
	return (await query("SELECT id, CONCAT(display_name, '#', discriminator) AS name FROM burgustar_players WHERE display_name LIKE '" + searchString[0] + "%' " + discriminatorLike + " LIMIT 10"));
}

/** Generate a new map and save it as a new city in the database, then return the initial state snapshot. */
async function newGame(config, playerIDs) {
	var state = new GameState();
	for (var x = 0; x < playerIDs.length; x++) {
		var player = new PlayerState();
		player.playerID = playerIDs[x];
		player.resources = [20, 0, 0, 0, 0, 0, 2, 0, 0, 5, 6, 2, 0, 0]; //Initial resource amounts
		if (resourceDefinitions.length != player.resources.length) throw "Resources need to match resourceDefinitions.length";
		state.players.push(player);
	}
	console.log("Generating initial map");
	generateInitialMap(config, state);
	console.log("Map generated. Saving");

	var result = await query("INSERT INTO `burgustar_cities` SET ?",
		{ initial_state: Buffer.from(serializeAsSnapshot(state)), version: config.version, map_width: config.w - 1, map_height: config.h - 1, max_advance_plays: config.maxAdvancePlays, deactivate_players_after_hours: config.deactivatePlayersAfterHours, difficulty: config.difficulty });
	config.id = result.insertId; //result.insertId is the last inserted ID
	await query("INSERT INTO `burgustar_player_cities` (city_id, player_id) VALUES ?", [distinct(playerIDs).map(playerID => [result.insertId, playerID])]); //distinct because I'm letting the same player be in the same game twice for the time being. :P
	return state;
}

/** Return 0 if the player doesn't have access to the given game ID (because they're not in the burgustar_player_cities table) or a truthy number if they do. */
async function playerHasCityAccess(playerID, gameID) {
	return (await query("SELECT 1 FROM burgustar_player_cities WHERE player_id = ? AND city_id = ? LIMIT 1", [playerID, gameID])).length; //0 or 1
}

/** Get basic information about the games the player has going. */
async function getPlayerCities(playerID) {
	return await query("SELECT city_id FROM burgustar_player_cities WHERE player_id = ?", [playerID]); //Just returning {city_id} objects for now, but still, returning *objects* so that I can add more info later without restructuring
}

/** Validate all the given deltas and make sure they belong to the given player ID, and if they're okay, apply them to the game with the given ID and update it in the database. On failure, returns an object of {rejectionReason, deltas} where the former, at least, should be sent to the client. No return value on success. */
//TODO: If only one method needed to be protected by an async mutex, it'd be this one. Need to lock that entire burgustar_cities record from the call to loadFromDB through the final query in this method.
async function updateDeltasInDB(id, playerID, newDeltas) {
	//Deltas will be combined in loadFromDB, so we never lose any of the deltas in the game history (unless they were invalidated by a different player's move performed on an earlier turn but later in real-time)
	var { config, gameStates, deltas, rejectionReason } = await loadFromDB(id, newDeltas); //Returns when it's done building and validating the sequence of game states starting from the snapshot and applying the saved deltas plus any newly submitted deltas

	//When it comes across an invalid delta that was submitted in newDeltas (it's not an error if the new deltas invalidate OTHER players' moves, but it is an error if these deltas are invalid)
	if (rejectionReason) return { rejectionReason, deltas }; //The deltas (actually one delta) aren't used in the caller but could be used to show the player more info or remind them what they TRIED to do or whatever

	//Since the player had an action accepted by the server, we can update their "last action taken" time in the database.
	await query("UPDATE `burgustar_player_cities` SET last_action = CURRENT_TIMESTAMP WHERE player_id = " + playerID + " AND city_id = " + id);

	//config has: id (auto-increment ID), version, deactivatePlayersAfterHours, difficulty, w, h, maxAdvancePlays
	var playerIdx = gameStates.map(q => q.players.findIndex(p => p.playerID == playerID)).find(p => p != -1); //Check all the game states in case the player came in late (I haven't fully detailed out how to implement that yet, hence checking ALL states) to get their index
	if (playerIdx == null) throw "Player isn't part of the game."; //Player tried to send a delta for a game they're not a part of. //TODO: Forbid instead of 500, but it's not important
	if (newDeltas.some(p => p.playerIdx != playerIdx)) throw "Player sent a delta for someone else."; //Player tried to send a delta for someone else. //TODO: Forbid instead of 500, but it's not important

	var savedGameUpdates = { id: id, deltas: Buffer.from(serializeDeltas(deltas)) };

	//For the snapshot, go back as far as may be needed for future player reactivations, but no farther back than turn 0 //TODO: For optimization, this can be as high as gameStates.length - config.maxAdvancePlays - 1 when no players are inactive during that turn
	var desiredStateIndex = gameStates.length - config.maxAdvancePlays * 2 - 2; //Numeric logic verified: If there are 9 states, indices 0 through 8, and max advance plays is 3, this results in index 2, giving us 6 states *after* the snapshot. I always want the snapshot to be 1 state behind. But this is the BEFORE-snapshot state, so another -1.
	if (desiredStateIndex >= 0) { //Can't update the snapshot field if we don't have an old enough state to reset the one we want to use as the snapshot (we take the snapshot after advanceTurn is called for the previous state but before any deltas are applied)
		var beforeSnapshotState = gameStates[Math.max(0, desiredStateIndex)];
		var snapshotState = new GameState(beforeSnapshotState);
		advanceTurn(config, beforeSnapshotState, snapshotState);
		savedGameUpdates.snapshot = Buffer.from(serializeAsSnapshot(snapshotState));
	}
	await query("UPDATE `burgustar_cities` SET ? WHERE id=" + id, savedGameUpdates);
}

/** Load a game from the database and restore its most up-to-date state from the snapshot and deltas, also including (and validating) the given appenDeltas. Returns the game config, all the states since the snapshot, and the combined list of all the deltas. */
async function loadFromDB(id, appendDeltas = []) {
	var results = await query("SELECT * FROM `burgustar_cities` WHERE id = " + id);
	if (!results.length) throw "Game not found";

	var result = results[0];
	var config = { id: parseInt(result.id), version: parseInt(result.version), w: parseInt(result.map_width)+1, h: parseInt(result.map_height)+1, maxAdvancePlays: parseInt(result.max_advance_plays), deactivatePlayersAfterHours: parseFloat(result.deactivate_players_after_hours), difficulty: parseInt(result.difficulty) };
	var deltas = deserializeDeltas(result.deltas);
	if (appendDeltas.length) {
		appendDeltas.forEach(p => p.justAdded = true);
		deltas = deltas.concat(appendDeltas);
	}
	var snapshot = deserializeSnapshot((result.snapshot && result.snapshot.length) ? result.snapshot : result.initial_state);

	//To construct game states from these, we need to loop through the deltas with a running tally of what turn each player is on and start adding them to the snapshot and future game states.
	//First, figure out what game state each delta belongs in
	var playerTurns = new Array(snapshot.players.length).fill(0); //Turn starts at 0
	deltas.forEach(delta => {
		if (delta.action == ACT_PLAYER_ACTIVATE) {
			if (playerTurns[delta.playerIdx] <= snapshot.turn) snapshot.players[delta.playerIdx].active = false; //If the first thing the player does after the snapshot is reactivate, then they must have started off inactive
			playerTurns[delta.playerIdx] = delta.turn; //Player reactivation can skip turns. The activation delta must be the *first* delta for that player in that GameState.
		}
		delta.stateIdx = playerTurns[delta.playerIdx] - snapshot.turn; //Note: the first delta is applied to the state object for turn 0
		if (turnEndingActions.includes(delta.action)) { //End of the turn for that player
			playerTurns[delta.playerIdx]++;
		}
	});

	//Set player.active = false in the initial state for (newly) deactivated players. It won't reflect the truth exactly, but there's no reason to care about deactivated players in the validation.
	var deactivatedPlayerIDs = [];
	if (snapshot.players.length > 1) { //Only deactivate players if there are multiple in that game to begin with
		deactivatedPlayerIDs = (await query("SELECT player_id FROM `burgustar_player_cities` WHERE last_action < DATE_ADD(CURRENT_TIMESTAMP, INTERVAL -" + (config.deactivatePlayersAfterHours * 60) + " MINUTE) AND city_id = " + id)).map(p => p.player_id); //MySQL rounds the interval, so -0.2 HOUR does not work as intended
		snapshot.players.filter((p, idx) => deactivatedPlayerIDs.includes(p.playerID) && playerTurns[idx] <= snapshot.turn).forEach(p => p.active = false); //This line only matters when none of the deltas from the snapshot's turn onward belong to a deactivated player, because they're deactivated after applying their last delta
	}

	//Get the player display names. It's kind of a waste of space to send them once per snapshot, but no biggie. (We're already wasting tons of bandwidth by sending the snapshots themselves...)
	var playerNames = {};
	(await query("SELECT p.id AS id, CONCAT(p.display_name, '#', p.discriminator) AS name FROM burgustar_player_cities c INNER JOIN burgustar_players p ON p.id = c.player_id WHERE c.city_id = " + id)).forEach(cur => playerNames[cur.id] = cur.name);
	snapshot.players.forEach(p => p.name = playerNames[p.playerID]);

	//Then, for each game state, apply the deltas, sorted by stateIdx. gameStates[0] should have the right turn number but otherwise be a copy of the previous game state (with none of its deltas applied but with advanceTurn called).
	var applicableDeltas = deltas.filter(p => p.stateIdx >= 0);
	applicableDeltas.sort((a,b) => a.stateIdx - b.stateIdx); //I also need to group them by player, but it's hard to do that as part of the sorting, because I can't *sort* by player--I need to maintain the original ordering based on just the final delta for each player in each turn
	var gameStates = [snapshot];
	var startOfTurnDeltaIdx = 0;
	var aNewDeltaHasExecuted = false;
	var playerDeltasInvalidStartingWithStateIndex = []; //If we find any invalid moves, we need to skip all the remaining deltas for that player
	for (var x = 0; x < gameStates.length; x++) {
		//Loop through each delta for this turn/game state, validating if at least one newly-submitted delta has been applied (and always validating the newly-submitted deltas before applying them)
		for (var y = startOfTurnDeltaIdx; y < applicableDeltas.length && applicableDeltas[y].stateIdx == x; y++) {
			if (playerDeltasInvalidStartingWithStateIndex[applicableDeltas[y].playerIdx] !== undefined) continue; //Skip all deltas for a player once you've run into any invalid one for that player.

			function playerDeltaNextTurn(playerIdx) { //Local function to efficiently check if the given player has a delta saved/submitted for the next turn (if they don't, but they *do* have a later delta OR are in the deactivatedPlayerIDs list, they'll be treated as deactivated)
				for (var z = y + 1; z < applicableDeltas.length && applicableDeltas[z].stateIdx <= x + 1; z++) {
					if (applicableDeltas[z].stateIdx == x + 1 && playerIdx == applicableDeltas[z].playerIdx) return applicableDeltas[z];
				}
				return null;
            }

			if (turnEndingActions.includes(applicableDeltas[y].action)) {
				//Go back and run all the deltas for this player since startOfTurnDeltaIdx--we only care about the ordering of their turn-ending moves
				var executingDeltas = applicableDeltas.slice(startOfTurnDeltaIdx, y + 1).filter(p => p.playerIdx == applicableDeltas[y].playerIdx);
				for (var delta of executingDeltas) { //'of' because I don't care about the index
					if (delta.justAdded) {
						delete delta.justAdded; //Remove this temporary data since we don't need to send it back and its only purpose was to trigger validation here
						//Validate the new deltas
						var reason = gameStates[x].getReasonIfInvalid(config, delta);
						if (reason) {
							return { rejectionReason: reason, deltas: delta }; //When this player's OWN deltas are invalid, it needs to be reported as an error
						}

						aNewDeltaHasExecuted = true;
					} else if (aNewDeltaHasExecuted) { //If at least one new delta has been applied to any of the game states, we need to revalidate all the moves that came after it
						var reason = gameStates[x].getReasonIfInvalid(config, delta);
						if (reason) {
							playerDeltasInvalidStartingWithStateIndex[delta.playerIdx] = x;
							break; //Not an error because it's not a new delta; it was merely invalidated BY a new delta
						}
					}
					gameStates[x].players[delta.playerIdx].active = true; //Always act like the player being updated is active so it doesn't add a player activation delta
					gameStates[x].update(config, delta);
					//The player should be deactivated if they have a future delta but not one in the *next* turn (i.e. they skipped turns), but they should also be deactivated if they have no future turns *and* are in the deactive players list (not holding up other players)
					if (!playerDeltaNextTurn(delta.playerIdx) && (playerTurns[delta.playerIdx] > gameStates[x].turn + 1 || deactivatedPlayerIDs.includes(gameStates[x].players[delta.playerIdx].playerID))) gameStates[x].players[delta.playerIdx].active = false;
				}
            }
        }
		startOfTurnDeltaIdx = y; //y is either equal to deltas.length or it's the first index of deltas[] where stateIdx > x

		if (startOfTurnDeltaIdx < applicableDeltas.length) {
			gameStates.push(new GameState(gameStates[x])); //Make sure there are enough states in the list
			advanceTurn(config, gameStates[x], gameStates[x + 1]); //And make sure tent despawns and spawns and immigration and resource processes are all executed
		}
	}

	//Special validation in case of a newly-added player reactivation delta!
	var reactivationDelta = appendDeltas.filter(p => p.action == ACT_PLAYER_ACTIVATE);
	if (reactivationDelta.length > 1) return { rejectionReason: { text: "Only one reactivation delta can be submitted at a time." }, deltas: reactivationDelta[1] }; //TODO: The player shouldn't HAVE to submit a reactivation delta--that requires them to know they're inactive. Or, if they don't send one but their delta would be applied too soon before the baseline state, we should tell them to refresh because their action wouldn't take place on the turn they were viewing.
	if (reactivationDelta.length) {
		reactivationDelta = reactivationDelta[0];

		//Calculate baseline game state excluding this player. It'd be the first state from the end working backwards where all the players are NOT the delta's player or are inactive or have performed a turn-ending action.
		var baselineState = gameStates.slice().reverse().find(p => p.players.filter((q, idx) => idx != reactivationDelta.playerIdx && q.active).length == p.actions.filter(q => turnEndingActions.includes(q.action) && q.playerIdx != reactivationDelta.playerIdx).length);
		if (!baselineState) baselineState = { turn: 0 }; //Don't allow the turn to be negative either. :P
		if (reactivationDelta.turn <= baselineState.turn - config.maxAdvancePlays * 2) return { rejectionReason: { text: "Other players have played too far ahead." }, deltas: reactivationDelta }; //If other player just played turn 16 and maxAdvancePlays=2, this player should replay state 13 but not 12
    }

	for (var playerIdx in playerDeltasInvalidStartingWithStateIndex) deltas = deltas.filter(p => p.playerIdx != playerIdx || p.stateIdx < playerDeltasInvalidStartingWithStateIndex[playerIdx]); //Drop the invalid deltas before returning
	deltas.forEach(p => delete p.stateIdx); //Remove the temporary data from the deltas (if we want to know and the delta is within gameStates, I think we can find it by object reference equality anyway)
	return { config, gameStates, deltas }; //Pass ALL the deltas through
}

/** Convert player action (delta) objects into a Uint8Array. */
function serializeDeltas(deltas) {
    var b = [0]; //Array of bytes. It's really easy to serialize my deltas to bytes. Starts with the serialization format version ID.
	//Note: We do need the deltas in order but don't care about what turn they're in, because the deltas DETERMINE the turn
	deltas.forEach(delta => {
        b.push(delta.action);
		actionProperties[delta.action].forEach(field => b.push(delta[field]));
		if (delta.action == ACT_PLAYER_ACTIVATE) {
			b.push((delta.turn & 0xff00) >> 8);
			b.push(delta.turn & 0xff);
        }
	});

	return new Uint8Array(b);
}
/** Convert a byte array (or Uint8Array or similar Buffer) to player action (delta) objects. */
function deserializeDeltas(buffer) {
	if (!buffer || !buffer.length) return [];
	var version = buffer[0];
	var x = 1;
	var deltas = [];
	while (x < buffer.length) {
		var delta = { action: buffer[x++] };
		actionProperties[delta.action].forEach(field => delta[field] = buffer[x++]);
		if (delta.action == ACT_PLAYER_ACTIVATE) {
			delta.turn = (buffer[x++] << 8) + buffer[x++];
		}
		deltas.push(delta);
	}
	return deltas;
}
/** Convert a single game state object into a Uint8Array, including only important (non-recoverable without also including previous states or completely non-recoverable) information but not including any deltas. */
function serializeAsSnapshot(gameState) {
	var unitsByPlayer = gameState.players.map(_ => []).concat([[]]); //Include one for the neutral player
	gameState.units.forEach(unit => unitsByPlayer[unit.playerIdx + 1].push(unit)); //Assumes NEUTRAL_PLAYER is -1

	var b = [
		1, //Snapshot version. If you need to add/remove fields, having this value here lets you do so freely as long as the deserialization code supports loading for that version.
		(gameState.turn & 0xff00) >> 8, //~16.5k turns max
		gameState.turn & 0xff,
		gameState.players.length,
        (unitsByPlayer[0].length & 0xff00) >> 8, //Neutral player's unit count
        unitsByPlayer[0].length & 0xff
	];

	//The neutral player can't do anything to their units (like disable them), so just store the location and type
	unitsByPlayer[0].forEach(unit => {
        b.push(unit.x);
        b.push(unit.y);
        b.push(unit.unitDefID);
	});

	gameState.players.forEach((player, idx) => {
        b.push((player.playerID & 0xff000000) >> 24);
        b.push((player.playerID & 0xff0000) >> 16);
        b.push((player.playerID & 0xff00) >> 8);
        b.push(player.playerID & 0xff);
        b.push(player.active ? 1 : 0);
        b.push((player.lastImmigrationTurn & 0xff00) >> 8);
		b.push(player.lastImmigrationTurn & 0xff);
		b.push(player.turnsBetweenImmigrations);
		b.push(player.resources.length);
		player.resources.forEach(resource => {
            b.push((resource & 0xff0000) >> 16); //May as well use 3 bytes. I basically only want to store up to 99,999 and might actually lower that to 9,999, but for now, 3 bytes. :P
            b.push((resource & 0xff00) >> 8);
			b.push(resource & 0xff);
		});

        b.push((unitsByPlayer[idx + 1].length & 0xff00) >> 8);
        b.push(unitsByPlayer[idx + 1].length & 0xff);
        unitsByPlayer[idx + 1].forEach(unit => {
            b.push(unit.x);
            b.push(unit.y);
            b.push(unit.unitDefID);
            b.push(unit.disabled ? 1 : 0);
		});

		b.push(0); //Reserved for active treaty count
		//TODO: When I make treaties, they'll be here. Probably playerIdx (that you're trading with), resourceIdx, per-turn amount(< 256)
	});

    return new Uint8Array(b);
}
/** Convert a byte array (or Uint8Array or similar Buffer) into a single GameState object with enough information to rebuild any future state (e.g. stored resource amounts) except the deltas. */
function deserializeSnapshot(buffer) { //mysql automatically converts blobs to Buffer type, which is like a special case of Uint8Array
	var state = new GameState();

	var i = 0;
	var version = buffer[i++]; //Loading logic can change based on snapshot version
	state.turn = (buffer[i++] << 8) + buffer[i++];
	console.log("Loading game snapshot. Buffer length: " + buffer.length + "; version: " + version + "; turn: " + state.turn);
	state.players = new Array(buffer[i++]);
	var neutralUnitCount = (buffer[i++] << 8) + buffer[i++];
	while (neutralUnitCount--) state.units.push({ x: buffer[i++], y: buffer[i++], unitDefID: buffer[i++], playerIdx: NEUTRAL_PLAYER });

	for (var x = 0; x < state.players.length; x++) {
		state.players[x] = Object.assign(new PlayerState(), { //Need PlayerState objects
			playerID: (buffer[i++] << 24) + (buffer[i++] << 16) + (buffer[i++] << 8) + buffer[i++],
			active: buffer[i++] != 0,
			lastImmigrationTurn: (buffer[i++] << 8) + buffer[i++],
			turnsBetweenImmigrations: (version < 1 ? 5 : buffer[i++]), //Added with version 1; defaults to 5 for old saves.
            resources: new Array(buffer[i++])
		});
		for (var y = 0; y < state.players[x].resources.length; y++) state.players[x].resources[y] = (buffer[i++] << 16) + (buffer[i++] << 8) + buffer[i++];

		var playerUnitCount = (buffer[i++] << 8) + buffer[i++];
		while (playerUnitCount--) state.units.push({ x: buffer[i++], y: buffer[i++], unitDefID: buffer[i++], disabled: buffer[i++] != 0, playerIdx: x });
		var treatyCount = buffer[i++]; //Always 0 until we have treaties (trade agreements) implemented
    }

	return state;
}

function startServer() {
	const http = require('http');
	const url = require('url');

	const { AuthorizationCode } = require('simple-oauth2');
	const oauthConfig = {
		client: {
			id: process.env.BURGUSTAR_DISCORD_ID,
			secret: process.env.BURGUSTAR_DISCORD_SECRET //also _PUBKEY
		},
		auth: {
			tokenHost: 'https://discord.com/api/',
			authorizePath: 'oauth2/authorize',
			tokenPath: 'oauth2/token',
			revokePath: 'oauth2/token/revoke'
		}
	};

	function parseCookies(request) {
		var list = {}, rc = request.headers.cookie;
		rc && rc.split(';').forEach(function (cookie) {
			var parts = cookie.split('=');
			list[parts.shift().trim()] = decodeURI(parts.join('='));
		});
		return list;
	}

	const server = http.createServer(async (req, res) => {
		const cookies = parseCookies(req);
		const offline = req.headers.host.includes("127.0.0.1");
		const urlObject = new URL(req.url, `https://${req.headers.host}`);
		console.log(req);
		const urlParent = urlObject.pathname.replace(/\/[^/]*?$/i, "/"); //e.g. "127.0.0.1:3000//burgustar/Burgustar.html" would become "127.0.0.1:3000//burgustar/" and "aureuscode.com/burgustar/Burgustar.html" would become "aureuscode.com/burgustar/"
		const lowercasePath = urlObject.pathname.toLowerCase();
		function onError(err) {
			res.statusCode = 500;
			res.setHeader('Access-Control-Allow-Origin', '*'); //No longer needed for most requests since my local debugging can be done solely with http://127.0.0.1/ addresses now
			res.setHeader('Content-Type', 'application/javascript');
			res.end(err.text ? JSON.stringify(err) : (err instanceof TypeError) ? JSON.stringify({text: err.toString()}) : JSON.stringify({text: err})); //so you can return a plain string or multiple strings for multiple languages
        }
		function forbid() {
			res.statusCode = 403;
			res.setHeader('Content-Type', 'text/plain');
			res.end("You're not logged in as the right person for that action.");
		}
		/** Make sure the user has a session cookie, has a *valid* session cookie, and is fully logged in, and return their ID (undefined if not logged in). The first parameter causes a 307 redirect if true, but the second parameter changes it to a JSON response containing only a redirectTo string if true. */
		async function getSessionPlayerID(redirectToLoginIfNot, redirectAsJson) {
			if (!cookies.session || !cookies.session.length) {
				var setCookie = true;
				cookies.session = await newSession();
			} else {
				var playerID = await validateSession(cookies.session);
				if (playerID === undefined) { //Expired session
					setCookie = true;
					cookies.session = await newSession();
                }
			}
			if (setCookie) res.setHeader('Set-Cookie', "session=" + encodeURI(cookies.session)); //Set the cookie regardless of whether we actually want to redirect (this case would be used for /login)
			if (redirectToLoginIfNot && !playerID) { //Not logged in--possibly because they had no cookie, but possibly not. Either way, no full response!
				const loginUrl = urlObject.pathname.substr(0, urlObject.pathname.lastIndexOf("/")) + "/login";
				if (redirectAsJson) {
					res.statusCode = 200;
					res.end(JSON.stringify({ redirectTo: loginUrl }));
				} else {
					res.statusCode = 307;
					res.setHeader('Location', loginUrl);
					res.end();
				}
			}
			return playerID;
        }

		if (urlObject.pathname.endsWith("/info")) {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'text/plain');
			res.end('Burgustar server. Running on NodeJS ' + process.versions.node);
		} else if (lowercasePath.endsWith("/search")) {
			//Don't care too much if someone not logged in is querying the search endpoint...
			var name = urlObject.searchParams.get("name");
			if (name) name = name.replace(/[^a-z#]/gi, "").substr(0, 37); //Drop disallowed characters before checking if we should avoid searching. The 37 is the 32 max Discord username length + "#" + discriminator length (4, all digits)
			if (!name) {
				res.statusCode = 200;
				res.setHeader('Content-Type', 'application/json');
				res.end("[]");
				return;
			}

			try {
				//Respond with [{name,id}, ...] where name includes the Discord username plus # plus discriminator
				var searchResults = await searchPlayers(name);

				res.statusCode = 200;
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify(searchResults));
			} catch (err) {
				onError(err);
            }
		} else if (lowercasePath.endsWith("/newgame")) {
			const playerID = await getSessionPlayerID(true, true);
			if (!playerID) return;

			try {
				const config = {
					version: 0 /*Current gameplay version*/, w: parseInt(urlObject.searchParams.get("map_width")), h: parseInt(urlObject.searchParams.get("map_height")),
					maxAdvancePlays: parseInt(urlObject.searchParams.get("max_advance_plays")), deactivatePlayersAfterHours: parseFloat(urlObject.searchParams.get("deactivate_players_after_hours")), difficulty: parseInt(urlObject.searchParams.get("difficulty"))
				};
				const players = distinct(urlObject.searchParams.getAll("player_ids").map(p => parseInt(p)).concat(playerID)); //Force the player to be in their own game, and prevent the same player from being included twice
				if (config.w < 8 || config.h < 8 || config.w > 256 || config.h > 256 || config.difficulty < 0 || config.difficulty > 100 || config.maxAdvancePlays < 1 || config.maxAdvancePlays > 50 || config.deactivatePlayersAfterHours < 0.01 || !players.length || players.length > 16) throw "Config rejected";

				console.log("Making game for player IDs: " + players.join());
				const state = await newGame(config, players);
				console.log("Started game " + config.id + " successfully. Generated " + state.units.length + " units in the initial state.");
				res.statusCode = 200;
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify(config));
			} catch (err) {
				onError(err);
			}
		} else if (lowercasePath.endsWith("/game")) {
			const playerID = await getSessionPlayerID(true, true);
			if (!playerID) return;

			var gameID = parseInt(urlObject.searchParams.get("id"));
			if (req.method.toLowerCase() == 'get') {
				if (!(await playerHasCityAccess(playerID, gameID))) return forbid(); //Make sure players can only load cities that they are involved in (they can be added as observers via the DB right now)
				try {
					const { config, gameStates } = await loadFromDB(gameID, []);
					gameStates.forEach(state => state.players.forEach(p => delete p.buildabilityMatrix)); //Don't send this excessive amount of data the client can easily generate if it needs to (without any special coding)
					res.statusCode = 200;
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify({ config, gameStates, playerID }));
				} catch (err) {
					onError(err);
				}
			} else if (req.method.toLowerCase() == 'post') { //Applies a list of deltas (if they're valid).
				let requestBody = "";
				req.on("data", chunk => requestBody += chunk);
				req.on("end", async () => {
					try {
						const newDeltas = JSON.parse(requestBody);
						//TODO: Also accept the turn number to make sure no requests were missed
						const { rejectionReason } = await updateDeltasInDB(gameID, playerID, newDeltas) || {}; //Use || {} when destructuring a potentially undefined return value
						if (rejectionReason) {
							//When it comes across an invalid delta that was submitted in newDeltas (it's not an error if the new deltas invalidate OTHER players' moves, but it is an error if these deltas are invalid)
							res.statuscode = 409; //HTTP 409 status code: "Conflict" - the server state doesn't jive with the request
							res.setHeader('Content-Type', 'application/javascript');
							res.end(JSON.stringify(rejectionReason));
						} else {
							res.statusCode = 200;
							res.setHeader('Content-Type', 'application/javascript');
							res.end(JSON.stringify({ ok: true })); //TODO: Might wanna send any new deltas to every player who's online, but would rather do that with an always-open connection if feasible
						}
					} catch (err) {
						onError(err);
					}
				});

			}
		} else if (lowercasePath.endsWith("/login")) {
			var playerID = await getSessionPlayerID(); //We're redirecting either way, so don't pass in true to avoid a redirect loop, but it'll still set the cookie header if needed

			if (playerID) { //Already logged in
				//res.statusCode = 307;
								res.statusCode = 200;
								res.setHeader('Content-Type', 'application/json');
								res.end("Redirect from pathname: '" + urlObject.pathname + "' to '" + urlParent);
				//res.setHeader('Location', urlParent + "home");
				//res.end();
			} else { //Need Discord to vouch for you
				const oauthClient = new AuthorizationCode(oauthConfig);
				const authorizationUri = oauthClient.authorizeURL({
					redirect_uri: offline ? `http://${req.headers.host}/loggedin` : `https://${req.headers.host}/burgustar/server/loggedin`, //These URLs have to be whitelisted in the Discord app settings
					scope: 'identify',
					state: await stringHash(cookies.session)
				});

				res.statusCode = 307;
				res.setHeader('Location', authorizationUri);
				res.end();
			}
		} else if (lowercasePath.endsWith("/loggedin")) {
			//Query string parameter "code" is received from Discord, along with state (which is just repeating a string we sent them)
			if (!cookies.session || !cookies.session.length || urlObject.searchParams.get("state") != await stringHash(cookies.session)) return onError("Invalid state response from Discord for this user session.");
			//TODO: If there's a URL fragment #access_token= ... then use that instead of making the followup request (should be either 100% or 0% of the time)

			const tokenParams = {
				code: urlObject.searchParams.get("code"),
				redirect_uri: offline ? `http://${req.headers.host}/loggedin` : `https://${req.headers.host}/burgustar/server/loggedin`, //These URLs have to be whitelisted in the Discord app settings
				scope: 'identify'
			};

			const oauthClient = new AuthorizationCode(oauthConfig);
			oauthClient.getToken(tokenParams).then(accessToken => { //accessToken.token is the Discord-defined token object, but accessToken has its own methods: https://github.com/lelylan/simple-oauth2/blob/HEAD/API.md#accesstoken
				//I only wanted to know the user's identity, so make one more web request to get their ID.
				fetch(oauthConfig.auth.tokenHost + '/oauth2/@me', { headers: { Authorization: `${accessToken.token.token_type} ${accessToken.token.access_token}` } }).then(p => p.json()).then(async response => {
					//Find the right player record in the DB for this user. If there isn't one, make one.
					const playerID = await playerLoggingIn(response.user, cookies.session);
					console.log("Logged in as user ID: " + response.user.id + " with username: " + response.user.username + "#" + response.user.discriminator + " and identified as player " + playerID); //Can also use .avatar to display their avatar in the game: https://discord.com/api/avatars/{user_id}/{user_avatar}.png
					res.statusCode = 307;
					res.setHeader('Location', urlParent + "home");
					res.end();
				}).catch(err => onError(err));
			}).catch(err => onError(err));
		} else if (lowercasePath.endsWith("/home")) {
			const playerID = await getSessionPlayerID(true, false); //Need to be logged in
			if (!playerID) return;

			var myGames = await getPlayerCities(playerID);
			res.statusCode = 200;
			var html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>Burgustar</title></head><body><style>body{color:#f80;background-color:#171717;}a:visited,a:link,a:hover{color:#bf9;}a:active{color:#ca5;}button{padding:4px 14px;}input{background-color:#333;color:#f80;font-weight:bold;}input[type="number"]{width:5em;}td{padding:1px 10px;}</style>
<h1>Burgustar</h1><h2>Player Dashboard</h2><div><a href="NewGame.html"><h3>New Game</h3></a></div><h3>Your Games</h3></body></html>`;
			myGames.forEach(game => {
				html += `<a href="${(offline ? urlParent : urlParent.replace("/server/", "/"))}Burgustar.html?id=${game.city_id}">Parallel Universe #${game.city_id}</a><br>`;
			});

			res.end(html); //TODO: Would really rather redirect to a static HTML file that then queries the player's games with an AJAX request.
		} else if (lowercasePath.endsWith(".html") || lowercasePath.endsWith(".js") || lowercasePath.endsWith(".png") || lowercasePath.endsWith(".ttf") || lowercasePath.endsWith(".ico")) { //This is for local testing because it can't redirect to a file:// path, but it also works okay on the server (aside from losing features like compression).
			//Just send the file (but only files in the exact same directory as the server files, no subdirectories or anything)
			const filename = urlObject.pathname.substr(urlObject.pathname.lastIndexOf("/") + 1);
			res.statusCode = 200;
			res.setHeader("Content-Type", lowercasePath.endsWith(".html") ? "text/html" : lowercasePath.endsWith(".js") ? "application/javascript" : lowercasePath.endsWith(".png") ? "image/png" : lowercasePath.endsWith(".ico") ? "image/x-icon" : "application/octet-stream");
			const fs = require('fs');
			const readStream = fs.createReadStream(filename);
			readStream.on('open', () => readStream.pipe(res));
			readStream.on('error', onError);
		} else {
			res.statusCode = 404;
			res.end();
        }
	});

	server.listen(3000, '127.0.0.1', () => {
		console.log(`Burgustar server restarted at ${new Date()}`);
	});
}


startServer();