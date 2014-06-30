var api = {
	map: {},
	emit: function(type, data){
		if(this.map[type]){
			for(var i in this.map[type]){
				this.map[type][i](data);
			}
		}
	},
	on: function(type, handler){
		if(!this.map[type]){
			this.map[type]=[];
		}
		this.map[type].push(handler)
	}
};
var appcore = {version: 0.22, connected: false,sock:null,sockbuffer:[],write:null,map:{},generatedRSAKey: null,username: "",displayname:"",uid:"",passwordTempHolder:"",pubKey:"",derivedKeySalt:"",derivedKey:"",derivedKeyHash: "",activeCall:"",list:[],listHash:{},profileBlob:{},reconnect:-1, bufferTimestampIgnore: [], userList: [], noListBuffer: [], bgColorCache: []};
appcore.sockemit = function(type, message){
	if(!appcore.sock){
		throw new Error("No socket is defined.");
	}
	if(type != "raw"){
		message.sockType = type;
		if(!appcore.connected){
			appcore.sockbuffer.push(message);
		} else {
			appcore.sock.send(JSON.stringify(message));
		}
	} else {
		appcore.sock.send(message);
	}
};
appcore.sockon = function(type, callback){
	if(appcore.map[type]){
		console.log("WARNING: Rebinding for " + type);
	}
	appcore.map[type] = callback;
};
api.on("connect", function(){
	if(!appcore.connected){
		var server = "wss://subrosa.io";
		if(document.location.hash == "#local")
			server = ""; // connect to same hostname as page
		appcore.sock = new eio(server);
		
		appcore.sock.on("open", function(){
			console.log("open");
			appcore.connected = true;
			clearInterval(appcore.reconnect);
			appcore.reconnect=-1;
			if(appcore.derivedKey)
				appcore.sockemit("loginMain", {step: 2, username: appcore.username, hash: appcore.derivedKeyHash, resendBlob: false});
			for(var i in appcore.sockbuffer){ appcore.sock.send(JSON.stringify(appcore.sockbuffer[i])); };
			appcore.sockbuffer = [];
		});
		appcore.sock.on("message", function(data){
			if(data[0] == "{"){
				if(appcore.map[data[0]]){
					appcore.map[data[0]](data.substr(1));
				} else {
					try{ data=JSON.parse(data) } catch(error){ return };
					if(data.sockType){
						if(appcore.map[data.sockType]){
							appcore.map[data.sockType](data)
						}
					} else {
						throw new Error("Unknown type" + data.sockType)
					}
				}
			}
		});
		appcore.sock.on("close", function(e){
			console.log("close");
			appcore.connected = false;
			if(appcore.reconnect==-1){
				appcore.reconnect=setInterval(function(){api.emit("connect");}, 1500)
			}
			closeEvents()
		});
	}
});
api.emit("connect", {});
api.on("userExists", function(data){
	if(data.username){
		appcore.sockemit("userExists", {username: data.username});
	}
});
function closeEvents(){
	for(var i in appcore.list){
		if(appcore.list[i].active){
			var oldState = appcore.list[i].active.state;
			var oldType = appcore.list[i].active.callType;
			appcore.list[i].active = -1; // cancel all calls
			api.emit("callUpdate", {state: "", oldState: oldState, target: appcore.list[i].id, callType: oldType});
		}
	}
}
appcore.sockon("log", function(data){
	console.log("log event: " + data.msg);
});
appcore.sockon("*", function(data){
	api.emit("sendRawComm", "*"); // respond to heartbeat
});
appcore.sockon("userExists", function(data){
	api.emit("userExistsResult", data);
});
appcore.sockon("captcha", function(data){
	api.emit("gotCaptcha", data);
});
api.on("getCaptcha", function(data){
	appcore.sockemit("getCaptcha", {purpose: data.purpose});
});
api.on("genKey", function(data){
	var rsa = forge.pki.rsa;
	var state = rsa.createKeyPairGenerationState(2048, 0x65537);
	var step = function() {
		if(!rsa.stepKeyPairGenerationState(state, 100)) {
			data.generating();
			setTimeout(step, 1);
		} else {
			// continue
			appcore.generatedRSAKey = state.keys;
			data.generated();
		}
	};
	setTimeout(step);
});
api.on("register", function(data){
	var profileBlob = {};
	// Convert the private key to PEM format, build into profile blob
	// Use PBKDF2 to derive a 256 bit key from the user password (SHA256, 10000 iterations)
	// Encrypt the profile blob with the derived key
	// Hash the derived key with SHA256 (verified by the server when attempting to login, block offline brute force
	// Send the base64 encoded encrypted profile blob, along with the IV & salt & hashed derived key
	// Clean up variables.
	profileBlob.privateKey = forge.pki.privateKeyToPem(appcore.generatedRSAKey.privateKey);
	profileBlob.conversations = {};
	
	var publicKey = forge.pki.publicKeyToPem(appcore.generatedRSAKey.publicKey);
	
	var profileBlobJson = JSON.stringify(profileBlob);
	var pbdkf2Salt = forge.random.getBytesSync(32);
	var derivedKey = forge.pbkdf2(data.password, pbdkf2Salt, 10000, 32);
	var derivedKeyHash = forge.sha256.create().update(derivedKey).digest().toHex();
	
	var iv = forge.random.getBytesSync(16);
	var cipher = forge.cipher.createCipher('AES-CBC', derivedKey);
	cipher.start({iv: iv});
	cipher.update(forge.util.createBuffer(profileBlobJson));
	cipher.finish();
	var cipherOutput = btoa(cipher.output.data); //better transport via JSON object over websockets
	
	var encryptedBlob = {iv: iv, pbdkf2Salt: pbdkf2Salt, data: cipherOutput};
	
	appcore.sockemit("register", {encryptedBlob: encryptedBlob, publicKey: publicKey, username: data.username, displayname: data.displayname, email: data.email, newsletter: data.newsletter, challenge: data.challenge, captcha: data.captcha, derivedKeyHash: derivedKeyHash});
});
appcore.sockon("register", function(data){
	if(data.status == "OK"){
		// clean up the RSA private key
		appcore.generatedRSAKey = {};
	}
	api.emit("registerResult", data);
});
api.on("loginMain", function(data){
	// get PBKDF2 salt from server, derive key
	// hash derived key and send it to the server
	// if the server verifies it, we get back the encrypted profileBlob along with the IV so we can decrypt
	api.emit("connect", {});
	appcore.sockemit("loginMain", {step: 1, username: data.username});
	appcore.username = data.username;
	appcore.passwordTempHolder = data.password;
});
appcore.sockon("loginMain", function(data){
	if(data.step == 1){
		if(data.salt){
			var password = appcore.passwordTempHolder;
			appcore.passwordTempHolder = "";
			
			var derivedKey = forge.pbkdf2(password, data.salt, 10000, 32);
			var derivedKeyHash = forge.sha256.create().update(derivedKey).digest().toHex();
			
			appcore.derivedKeySalt = data.salt;
			appcore.derivedKey = derivedKey;
			appcore.derivedKeyHash = derivedKeyHash;
			
			appcore.sockemit("loginMain", {step: 2, username: appcore.username, hash: derivedKeyHash});
		} else {
			api.emit("loginMainResult", data);
		}
	} else if(data.step == 2){
		if(data.iv){
			var encryptedBlob = atob(data.userBlob);
			var cipher = forge.cipher.createDecipher('AES-CBC', appcore.derivedKey);
			cipher.start({iv: data.iv});
			cipher.update(forge.util.createBuffer(encryptedBlob));
			cipher.finish();
			var cipherOutput = cipher.output.data;
			var profileBlob;
			try {
				profileBlob = JSON.parse(cipherOutput);
			} catch (exception) {
				api.emit("loginMainResult", {status: "FAIL", message: "Decryption has failed - the encrypted data became corrupt."});
			}
			if(profileBlob){
				appcore.profileBlob = profileBlob;
				// work out our public key
				var privateKey = forge.pki.privateKeyFromPem(appcore.profileBlob.privateKey);
				var publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
				appcore.pubKey = forge.pki.publicKeyToPem(publicKey);
				
				appcore.username = data.username;
				appcore.displayname = data.displayname;
				appcore.status = data.status;
				appcore.avatar = data.avatar;
				appcore.uid = data.uid;
				appcore.bgColorCache[appcore.uid] = data.bgColor;
				api.emit("loginMainResult", {status: "OK"});
				updateBlob();
				
				api.emit("getHome");
			}
		} else {
			api.emit("loginMainResult", data);
		}
	}
});
appcore.sockon("news", function(data){
	api.emit("homeData", {news: data.news});
});
api.on("getHome", function(){
	appcore.sockemit("news", {});
});
appcore.sockon("getLists", function(data){
	// loading existing lists
	appcore.list = data.list;
	for(var i in appcore.list){
		appcore.listHash[appcore.list[i].id] = i;
		if(appcore.list[i].active && appcore.list[i].id.length == 20){
			api.emit("callUpdate", {state: "CALLING", oldState: "", target: appcore.list[i].id, callType: appcore.list[i].active.type});
		}
		if(appcore.list[i].uid)
			appcore.bgColorCache[appcore.list[i].uid] = appcore.list[i].bgColor;
	}
	api.emit("getListsResult", {});
});
appcore.sockon("newList", function(data){
	if(data.autojoin && data.object.id.length == 37){
		// this list did not originate from our interaction
		var uids = data.object.id.substr(4).split("-");
		if(getProp(uids[0] + "-blocked") || getProp(uids[1] + "-blocked")){
			return appcore.sockemit("removeList", {removeID: data.object.id});
		}
	}
	data.object.waitingForBundle = true;
	appcore.list.push(data.object);
	if(data.object.active && data.object.id.length == 20){
		api.emit("callUpdate", {state: "CALLING", oldState: "", target: data.object.id, callType: data.object.type});
	}
	if(data.object.uid)
		appcore.bgColorCache[data.object.uid] = data.object.bgColor;
	
	appcore.listHash[data.object.id] = appcore.list.length-1;
	if(appcore.noListBuffer[data.object.id]){
		for(var i in appcore.noListBuffer[data.object.id]){
			commHandler(appcore.noListBuffer[data.object.id][i]);
		}
		delete appcore.noListBuffer[data.object.id];
	}
	api.emit("getListsResult", {});
});
api.on("addList", function(data){
	if(data.id){
		appcore.sockemit("addList", {addID: data.id});
	}
});
api.on("removeList", function(data){
	if(data.id){
		if(!data.onlySync){
			appcore.sockemit("removeList", {removeID: data.id});
		}
		appcore.list.splice(appcore.listHash[data.id], 1);
		var minusOneAfter = appcore.listHash[data.id];
		delete appcore.listHash[data.id];
		delete convBodyHolders[data.id];
		for(var i in appcore.listHash){
			if(appcore.listHash[i] > minusOneAfter){
				appcore.listHash[i]--;
			}
		}
	}
});
appcore.sockon("kicked", function(data){
	var roomName = appcore.list[appcore.listHash[data.target]].name;
	api.emit("removeList", {id: data.target, onlySync: true});
	api.emit("notify", {type: "kicked", kickerUID: data.kickerUID, kickerUsername: data.kickerUsername, target: data.target, roomName: roomName});
});
appcore.sockon("noInvite", function(data){
	api.emit("notify", {type: "noInvite"});
});
api.on("changeStatus", function(data){
	appcore.status = data.status;
	appcore.sockemit("changeStatus", {status: parseInt(data.status)});
});
api.on("changeProfile", function(data){
	if(data.displayname && data.displayname != appcore.displayname){
		appcore.displayname = data.displayname.substr(0, 30);
	}
	if(data.oldpass && data.newpass){
		var derivedKey = forge.pbkdf2(data.oldpass, appcore.derivedKeySalt, 10000, 32);
		var derivedKeyHash = forge.sha256.create().update(derivedKey).digest().toHex();
		if(derivedKeyHash != appcore.derivedKeyHash){
			api.emit("notify", {type: "changePassOldWrong"});
			return;
		}
		
		data.oldDerivedKeyHash = appcore.derivedKeyHash;
		appcore.derivedKeySalt = forge.random.getBytesSync(32);
		appcore.derivedKey = forge.pbkdf2(data.newpass, appcore.derivedKeySalt, 10000, 32);
		appcore.derivedKeyHash = forge.sha256.create().update(appcore.derivedKey).digest().toHex();
		
		updateBlob(true, 'changeProfile');
		data.oldpass = "";
		data.newpass = "";
		data.derivedKeyHash = appcore.derivedKeyHash;
		data.derivedKeySalt = appcore.derivedKeySalt;
	}
	if(data.bgColor){
		appcore.bgColorCache[appcore.uid] = data.bgColor;
	}
	appcore.sockemit("changeProfile", data);
});
api.on("addContact", function(data){
	if(data.id){
		var listItem = appcore.list[appcore.listHash[data.id]];
		api.emit("keyExchange", {id: data.id});
		api.emit("sendComm", {type: 5, target: data.id, message: {msg: data.message}});
		commHandler({type: 5, sender: appcore.uid, decrypted: {msg: data.message}, target: data.id});
		listItem.contact = 1;
		listItem.myRequest = true;
	}
});
api.on("removeContact", function(data){
	if(data.id){
		appcore.sockemit("removeContact", {removeID: data.id});
		api.emit("notify", {type: "contactChange", id: data.id, contact: data.contact});
		appcore.list[appcore.listHash[data.id]].contact = 0;
		delete appcore.list[appcore.listHash[data.id]].displayname;
		delete appcore.list[appcore.listHash[data.id]].status;
	}
});
api.on("generateKeyExchange", function(data){ // data is listItem
	if(data.keyExchange)
		return;
		
	if(appcore.profileBlob.conversations[data.id]){
		data.keyExchange = "existing";
		return;
	}
	
	data.keyExchange = "pending";
	appcore.sockemit("getPubKey", {uid: data.uid});
});
api.on("keyExchange", function(data){
	var listItem = appcore.list[appcore.listHash[data.id]];	
	if(!appcore.profileBlob.conversations[listItem.id]){
		appcore.sockemit("comm", {type: 1, target: listItem.id, data: listItem.keyExchange.encrypted, auxdata: listItem.keyExchange.signature});
		commHandler({type: 1, target: listItem.id, data: listItem.keyExchange.encrypted, auxdata: listItem.keyExchange.signature});
		appcore.profileBlob.conversations[listItem.id] = listItem.keyExchange.convKey;
		updateBlob(true, 'keyExchange');
	}
});
api.on("acceptContact", function(data){
	if(data.id){
		var listItem = appcore.list[appcore.listHash[data.id]];
		api.emit("sendComm", {type: 5, target: data.id, message: {accepted: true}});
		commHandler({type: 5, sender: appcore.uid, decrypted: {accepted: true}, target: data.id});
		listItem.contact = 2;
	}
});
api.on("createRoom", function(data){
	var inviteToRoom;
	var convKey;
	var roomName;
	if(data.mode == "new"){
		inviteToRoom = "conv" + randomUID(16);
		convKey = forge.random.getBytesSync(32)
		roomName = data.name;
		
		appcore.profileBlob.conversations[inviteToRoom] = convKey;
		appcore.sockemit("createRoom", {roomID: inviteToRoom, name: data.name});
		
		updateBlob(true, 'createRoom');
		
	} else if(data.mode == "add"){
		inviteToRoom = data.target;
		convKey = appcore.profileBlob.conversations[inviteToRoom];
		roomName = appcore.list[appcore.listHash[inviteToRoom]].name;
	}
	for(var i in data.invite){
		var theirUsername = appcore.list[appcore.listHash["conv" + sortUID(data.invite[i], appcore.uid)]].username;
		var theMessage = {target: inviteToRoom, name: roomName, convKey: convKey};
		api.emit("sendComm", {type: 7, target: "conv" + sortUID(data.invite[i], appcore.uid), message: theMessage, inviteToRoom: inviteToRoom});
		commHandler({type: 7, target: "conv" + sortUID(data.invite[i], appcore.uid), decrypted: theMessage});
		commHandler({type: 8, target: inviteToRoom, decrypted: {username: theirUsername, uid: data.invite[i]}});
	}
});
api.on("joinRoom", function(data){
	if(!appcore.profileBlob.conversations[data.target]){
		appcore.profileBlob.conversations[data.target] = data.convKey;
		updateBlob(true, 'joinRoom');
	}
	appcore.sockemit("addList", {addID: data.target});
});
api.on("kickUser", function(data){
	var listItem = appcore.list[appcore.listHash[data.target]];
	
	if(listItem.users.indexOf(data.kicking)){
		listItem.users.splice(listItem.users.indexOf(data.kicking), 1);
	}
	appcore.sockemit("kickUser", data);
});
appcore.sockon("comm", function(d){
	commHandler(d);
});
var callTimeout;
function commHandler(comm, target, isFromBuffer){
	if(!target){
		target = comm.target;
	}
	if(!isFromBuffer){
		isFromBuffer = false;
	}
	if(!comm.sender){
		comm.sender = appcore.uid;
	}
	if(!comm.time){
		comm.time = new Date().getTime();
	}
	if(getProp(comm.sender + "-blocked")){
		return;
	}
	if(comm.type){
		if(target.length == 37 && !appcore.list[appcore.listHash[target]]){
			if(!appcore.noListBuffer[target])
				appcore.noListBuffer[target] = [];
			appcore.noListBuffer[target].push(comm);
			return;
		}
		var listItem = (appcore.list[appcore.listHash[target]] ? appcore.list[appcore.listHash[target]] : false);
		if(comm.type == 1){
			if(isFromBuffer && appcore.bufferTimestampIgnore.indexOf(comm.time + target) != -1)
				return;
			if(comm.sender != appcore.uid){ // Don't keyExchange if it's my keyExchange
				if(!appcore.profileBlob.conversations[target]){ // Don't keyExchange if already done so
					decryptAndVerifyRSA(comm.data, comm.auxdata, comm.pubKey);
				}
			}
			if(comm.pubKey){
				listItem.pubKey = comm.pubKey; // In all cases comm.pubKey is pubkey of other party.
			}
			api.emit("newText", {user: "*", userShow: "*", message: "<span class='fa fa-lock'></span> Encryption initialized. <a href='javascript:;' class='verifyKey'>Verify</a>", isMe: false, target: target, unread: false, isFromBuffer: isFromBuffer, small: true});
			appcore.sockemit("clearHistory", {target: target, time: comm.time});
			if(!isFromBuffer && !listItem.hasBundle){
				appcore.bufferTimestampIgnore.push(comm.time + target);
			}
		} else {
			var obj = decryptComm(comm, target);
			if(obj.failedDecrypt){
				comm.type = 2;
			}
			if(obj){
				
				if(isFromBuffer && appcore.bufferTimestampIgnore.indexOf(comm.time + target) != -1)
					return;
				
				var userInfo = getUserItem(comm.sender);
				if(!userInfo){
					if(!comm.username){
						alert("DEBUG: No userInfo & no comm.username");
					} else {
						appcore.userList[comm.sender] = {username: comm.username};
						appcore.bgColorCache[comm.sender] = comm.bgColor;
						userInfo = appcore.userList[comm.sender];
						api.emit("notify", {type: "userIdentified", target: target});
					}
				}
				var isMe = comm.sender == appcore.uid;
				
				var userDisplay = escapeText((userInfo.displayname ? userInfo.displayname : userInfo.username));
				var unread = listItem.lastRead < comm.time;
				var theMessage = "";
				
				if(comm.type == 2){
					theMessage = parseChatMessage(escapeText(obj.msg), userDisplay);
					if(listItem.typings){
						for(var i in listItem.typings){
							if(listItem.typings[i][0] == comm.sender){
								listItem.typings.splice(i, 1);
								api.emit("refreshTypingDisplay", {});
								break;
							}
						}
					}
				} else if(comm.type == 5){
					if(obj.accepted){
						theMessage = "<b>" + userDisplay + " accepted the contact request</b>";
					} else {
						if(isMe){
							theMessage = "<b>You sent a contact request</b>: \"" + escapeText(obj.msg) + "\"";
						} else {
							theMessage = "<b>" + userDisplay + " sent you a contact request</b>: \"" + escapeText(obj.msg) + "\"";
						}
					}
				} else if(comm.type == 6){
					if(listItem.contact == 2 || listItem.id.length == 20){
						if(obj.type == "voice" || obj.type == "video"){
							if(listItem.active && listItem.active != -1) // target is already in call
								return;
							listItem.active = {type: obj.type, state: "CALLING", myInitiate: false};
							if(listItem.id.length == 37){
								callTimeout = setTimeout(function(){
									if(listItem.active.state == "CALLING"){
										var oldType = listItem.active.type;
										listItem.active = -1;
										api.emit("callUpdate", {state: "", oldState: "CALLING", target: target, callType: oldType});
									}
								}, 30 * 1000);
							} else {
								listItem.active.callUsers = [comm.sender];
							}
							api.emit("callUpdate", {state: "CALLING", oldState: "", target: target, callType: listItem.active.type});
						} else if(obj.type == "acceptCall"){
							if(target.length == 37){
								acceptCall(listItem.id, false);
							} else {
								if(listItem.active){
									listItem.active.callUsers.push(comm.sender);
									api.emit("notify", {type: "callUserUpdate", event: "JOIN", target: listItem.id, uid: comm.sender, callType: listItem.active.type});
								}
							}
						} else { // dropCall
							if(target.length==37){
								clearTimeout(callTimeout);
								var oldState = listItem.active.state;
								var oldType = listItem.active.type;
								listItem.active = {};
								appcore.activeCall = "";
								api.emit("callUpdate", {state: "", oldState: oldState, target: target, callType: oldType});
							} else {
								handleRoomCallQuit(target, comm.sender);
							}
						}
					}
				} else if(comm.type == 7){
					if(isMe){
						theMessage = '<b>You invited them to <a href="javascript:;" class="roomInviteLink dottedLink" data-target="' + escapeText(obj.target) + '" data-convKey="' + btoa(obj.convKey) + '">' + escapeText(obj.name) + '</a> (group chat)</b>';
					} else {
						theMessage = "<b>" + userDisplay + ' invited you to <a href="javascript:;" class="roomInviteLink dottedLink" data-target="' + escapeText(obj.target) + '" data-convKey="' + btoa(obj.convKey) + '">' + escapeText(obj.name) + '</a> (group chat)</b>';
					}
				} else if(comm.type == 8){
					if(isMe){
						theMessage = '<b>You invited <a href="javascript:;" class="userLink dottedLink" data-uid="' + escapeText(obj.uid) + '">' + escapeText(obj.username) + '</a> to this room.</b>';                    
					} else {
						theMessage = '<b>' + userDisplay + ' invited <a href="javascript:;" class="userLink dottedLink" data-uid="' + escapeText(obj.uid) + '">' + escapeText(obj.username) + '</a> to this room.</b>';
					}
				} else if(comm.type == 9){
					if(isMe){
						if(obj.quit){
							theMessage = "<b>You left the room.</b>";
						} else {
							theMessage = "<b>You joined the room.</b>";
						}
					} else {
						if(obj.quit){
							if(obj.kickedByUID){
								theMessage = "<b>" + userDisplay + ' was kicked from the room by <a href="javascript:;" class="userLink dottedLnk" data-uid="' + escapeText(obj.kickedByUID) + '">' + escapeText(obj.kickedByUsername) + '</a>';
							} else {
								theMessage = "<b>" + userDisplay + " left the room.</b>";
							}
							if(listItem.active && listItem.active.callUsers && listItem.active.callUsers.indexOf(comm.sender) !== -1){
								handleRoomCallQuit(target, comm.sender);
							}
							if(listItem.users.indexOf(comm.sender) != -1){
								listItem.users.splice(listItem.users.indexOf(comm.sender), 1);
								if(!isFromBuffer){
									listItem.usercount--;
								}
								api.emit("notify", {type: "userIdentified", target: listItem.id});
							}
						} else {
							theMessage = "<b>" + userDisplay + " joined the room.</b>";
							if(!isFromBuffer){
								listItem.usercount++;
							}
						}
					}
				} else if(comm.type == 10){
					try {
						rtcProcessSignal(obj.o, obj.to, comm.sender);
					} catch (error){
						console.log(error);
					}
				} else if(comm.type == 11){
					var ranks = ['normal user', '', 'moderator', '', 'admin', '', '', '', '', 'superadmin'];
					theMessage = '<b>' + (isMe ? 'You' : userDisplay) + ' set the rank of <a href="javascript:;" class="userLink dottedLnk" data-uid="' + escapeText(obj.targetUserUID) + '">' + escapeText(obj.targetUserUsername) + '</a> to <i>' + ranks[obj.newRank] + '</i>.</b>';
					if(!isFromBuffer){
						listItem.ranks[obj.targetUserUID] = obj.newRank;
						if(obj.targetUserUID == appcore.uid)
							listItem.myRank = obj.newRank;
					}
				}
				if(comm.type == 5 || comm.type == 2 || (comm.type >= 7 && comm.type <= 9) || comm.type == 11){
					if(!isFromBuffer && !listItem.hasBundle){
						appcore.bufferTimestampIgnore.push(comm.time + target);
					}
					listItem.canMarkRead = true;
					api.emit("newText", {user: comm.sender, userShow: (comm.type == 2 ? userDisplay : "*"), message: theMessage, isMe: isMe, timestamp: comm.time, target: target, unread: unread, isFromBuffer: isFromBuffer, bgColor: (appcore.bgColorCache[comm.sender] ? appcore.bgColorCache[comm.sender] : '')});
					
					
					if(listItem.users && listItem.users.indexOf(comm.sender) == -1 && (comm.type != 9 || !obj.quit)){
						listItem.users.push(comm.sender);
						api.emit("notify", {type: "userIdentified", target: listItem.id});
					}
				}
			}
		}
	}
}
function handleRoomCallQuit(target, quitter){
	var listItem = appcore.list[appcore.listHash[target]];
	if(listItem.active.callUsers.indexOf(quitter) != -1){
		listItem.active.callUsers.splice(listItem.active.callUsers.indexOf(quitter), 1);
		if(listItem.active.callUsers.length == 0){
			listItem.active = -1;
			api.emit("callUpdate", {state: "CALLING", oldState: "", target: target, callType: listItem.active.type});
		} else {
			api.emit("notify", {type: "callUserUpdate", event: "QUIT", target: listItem.id, uid: quitter, callType: listItem.active.type});
		}
	}
}
api.on("getUsers", function(data){
	appcore.sockemit("getUsers", {target: data.target});
});
appcore.sockon("userList", function(data){
	var listItem = appcore.list[appcore.listHash[data.target]];
	for(var i in data.users){
		if(listItem.users.indexOf(data.users[i][1]) == -1){
			listItem.users.push(data.users[i][1]);
		}
		appcore.userList[data.users[i][1]] = {username: data.users[i][0]};
	}
	listItem.pendingInvites = data.invites || [];
	listItem.ranks = data.ranks;
	api.emit("userList", data);
});
api.on("setUserRank", function(data){
	var listItem = appcore.list[appcore.listHash[data.target]];
	var myRank = listItem.myRank;
	var theirRank = 0;
	if(listItem.ranks && listItem.ranks[data.user])
		theirRank = listItem.ranks[data.user];
	
	if(myRank < 4){ // can't change ranks
		return api.emit("notify", {type: "noPermission", action: "setUserRank"});
	}
	if(theirRank >= myRank && myRank != 9){ // changing rank of someone equal or higher to me, and I'm not superadmin
		return api.emit("notify", {type: "noPermission", action: "setUserRank"});
	}
	if(data.newRank >= myRank && myRank != 9){ // setting rank to something equal or higher to me, and I'm not superadmin
		return api.emit("notify", {type: "noPermission", action: "setUserRank"});
	}
	appcore.sockemit("setUserRank", data);
	commHandler({type: 11, target: data.target, decrypted: {targetUserUID: data.user, targetUserUsername: getNameFromUID(data.user), newRank: data.newRank}});
});
appcore.sockon("1", function(data){ // Unused (on encrypted audio packet)
	if(appcore.activeCall){
	}
});
appcore.sockon("2", function(data){ // Unused (on encrypted group audio packet)
	if(appcore.activeCall){
	}
});
appcore.sockon("statusUpdate", function(data){
	var relevantList = appcore.list[appcore.listHash["conv" + sortUID(appcore.uid, data.target)]];
	if(!relevantList)
		return;
	if(data.displayname)
		relevantList.displayname = data.displayname;
	if(typeof data.status != "undefined"){
		if(data.status == null)
			data.status = undefined;
		api.emit("notify", {type: "statusChanged", uid: data.target, displayname: relevantList.displayname || relevantList.username, newStatus: data.status, oldStatus: relevantList.status});
		relevantList.status = data.status;
		if(data.status === 0){
			if(relevantList.active){
				api.emit("dropCall", {target: relevantList.id});
			} else {
				for(var i in appcore.list){
					if(appcore.list[i].active && appcore.list[i].active.callUsers && appcore.list[i].active.callUsers.indexOf(data.target) != -1){
						handleRoomCallQuit(appcore.list[i].id, data.target);
						return;
					}
				}
			}
		}
	}
	if(typeof data.contact != "undefined"){
		relevantList.contact = data.contact;
		if(typeof data.myRequest != "undefined"){
			relevantList.myRequest = data.myRequest;
		}
		api.emit("notify", {type: "contactChange", uid: data.target, contact: data.contact});
	}
	if(typeof data.displayname != "undefined"){
		api.emit("notify", {type: "displaynameChanged", uid: data.target, displayname: data.displayname, oldDisplayname: relevantList.displayname});
		relevantList.displayname = data.displayname;
	}
	
	api.emit("lay", {id: "conv" + sortUID(appcore.uid, data.target)});
});
appcore.sockon("commBundle", function(data){
	var listItem = appcore.list[appcore.listHash[data.target]]
	if(listItem){
		listItem.hasBundle = (data.small ? 1 : 2);
		listItem.waitingForBundle = false;
	}
	api.emit("notify", {type: "bundleRecieved", target: data.target, more: data.small});
	for(var i in data.bundle){
		commHandler(data.bundle[i], data.target, true);
	}
});
appcore.sockon("typingState", function(data){
	var listItem = appcore.list[appcore.listHash[data.target]];
	if(!listItem.typings)
		listItem.typings = [];
		
	if(getProp(data.uid + "-blocked"))
		return;
	
	var alreadyInTypings = false;
	for(var i in listItem.typings){
		if(listItem.typings[i][0] == data.uid){
			alreadyInTypings = true;
			if(data.state != "empty"){
				listItem.typings[i][1] = data.state;
				listItem.typings[i][2] = new Date().getTime();
			} else {
				listItem.typings.splice(i, 1);
			}
			break;
		}
	}
	if(!alreadyInTypings && data.state != "empty"){
		listItem.typings.push([data.uid, data.state, new Date().getTime()]);
	}
	api.emit("refreshTypingDisplay", {});
});
setInterval(function(){
	var curTime = new Date().getTime() - 6 * 1000;
	for(var i in appcore.list){
		if(appcore.list[i].typings){
			for(var j in appcore.list[i].typings){
				if((appcore.list[i].typings[j][1] == "typed" && appcore.list[i].typings[j][2] < curTime) || appcore.list[i].typings[j][1] == "empty"){
					appcore.list[i].typings.splice(j, 1);
					api.emit("refreshTypingDisplay", {});
				}
			}
		}
	}
}, 3500);
api.on("blockUser", function(data){
	var listItem = appcore.list[appcore.listHash[data.target]];
	if(data.unblock){
		api.emit("setProp", {name: listItem.uid + "-blocked", value: null});
	} else {
		if(listItem.contact == 2){
			api.emit("removeContact", {id: currentTab});
		}
		if(listItem.typings.length){
			listItem.typings = [];
			api.emit("refreshTypingDisplay", {});
		}
		api.emit("setProp", {name: listItem.uid + "-blocked", value: true});
		api.emit("removeList", {id: data.target});
	}
});
api.on("updateTypingState", function(data){
	var listItem = appcore.list[appcore.listHash[data.target]];
	if(data.state == "typing"){
		if(appcore.status == 4)
			return;
		if(!listItem.typingState || listItem.typingState != "typing"){
			listItem.typingState = "typing";
			appcore.sockemit("typingState", {target: data.target, state: "typing"});
			if(listItem.stoppedTypingTimeout){
				clearTimeout(listItem.stoppedTypingTimeout);
			}
			if(data.state != "empty"){
				listItem.stoppedTypingTimeout = setTimeout(function(){
						listItem.typingState = "typed";
						appcore.sockemit("typingState", {target: data.target, state: "typed"});
				}, 3000);
			}
		} else {
			clearTimeout(listItem.stoppedTypingTimeout);
			listItem.stoppedTypingTimeout = setTimeout(function(){
					listItem.typingState = "typed";
					appcore.sockemit("typingState", {target: data.target, state: "typed"});
			}, 3000);
		}
	} else if(data.state == "empty"){
		clearTimeout(listItem.stoppedTypingTimeout);
		if(!listItem.typingState || listItem.typingState != "empty"){
			listItem.typingState = "empty";
			appcore.sockemit("typingState", {target: data.target, state: "empty"});
		}
	}
});
api.on("sendText", function(data){
	if(data.message.length == 0)
		return;
	var listItem = appcore.list[appcore.listHash[data.target]];
	appcore.list[appcore.listHash[data.target]].typingState = "";
	clearTimeout(listItem.stoppedTypingTimeout);
	if((listItem.keyExchange && listItem.keyExchange != "pending") || appcore.profileBlob.conversations[data.target]){
		if(listItem.keyExchange){
			api.emit("keyExchange", {id: data.target});
		}
		var currentTime = new Date().getTime();
		listItem.lastRead = currentTime;
		api.emit("sendComm", {target: data.target, type: 2, message: {msg: data.message}});
		commHandler({type: 2, sender: appcore.uid, decrypted: {msg: data.message}, target: data.target});
	}
});
function escapeText(input){
	return input.toString().replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}
function parseChatMessage(input, userDisplay){
	var links = input.match(/(^|\s|<br>)https?:\/\/[A-Za-z0-9\-]+\.[A-za-z0-9\/?&%;.#=\-~+!]+/g);
	for(var i in links){
		links[i] = links[i].trim().replace("<br>", "");
		input = input.replace(links[i], '<a href="' + links[i].replace(/&amp;/g, "&") + '" target="_blank">' + links[i] + '</a>');
	}
	if(input.substr(0, 4) == "/me "){
		input = "<i>" + userDisplay + " " + input.substr(4) + "</i>";
	}
	return input;
}
api.on("clearHistory", function(data){
	appcore.sockemit("clearHistory", data);
});
api.on("uploadAvatar", function(data){
	appcore.fileString = data.data;
	appcore.partsTotal = Math.ceil(appcore.fileString.length/10240);
	uploadPart();
});
appcore.sockon("avatarSet", function(data){
	if(data.error){
		api.emit("avatarUploadProgress", {percent: -1});
	} else {
		api.emit("avatarUploadProgress", {percent: 100});
		appcore.avatar = data.newAvatar;
		api.emit("notify", {type: "avatarUpdated", uid: appcore.uid, avatar: data.newAvatar});
	}
});
appcore.sockon("avatar", function(data){
	var listItem = appcore.list[appcore.listHash["conv" + sortUID(appcore.uid, data.uid)]];
	listItem.avatar = data.avatar;
	api.emit("notify", {type: "avatarUpdated", uid: data.uid, avatar: data.avatar});
});
function uploadPart(){
	var partsLeft = Math.ceil(appcore.fileString.length/10240);
	var part = appcore.fileString.substr(0,10240);
	appcore.fileString = appcore.fileString.substr(10240);
	appcore.sockemit("filePart", {t: "a", p: partsLeft-1, d: part});
	api.emit("avatarUploadProgress", {percent: Math.round(((appcore.partsTotal-partsLeft)/appcore.partsTotal)*100)});
}
appcore.sockon("gotPart", function(data){
	uploadPart();
});
api.on("makeCall", function(data){
	var listItem = appcore.list[appcore.listHash[data.target]];
	if(listItem.active && listItem.active.state == "INCALL"){
		api.emit("dropCall", {target: data.target});
	}
	listItem.active = {type: data.type, state: "CALLING"};
	
	api.emit("sendComm", {target: data.target, type: 6, message: {type: data.type}});
	api.emit("callUpdate", {state: "CALLING", oldState: "", myInitiate: true, target: listItem.id, callType: data.type});
	
	if(data.target.length == 37){
		listItem.active.myInitiate = true;
		callTimeout = setTimeout(function(){
			if(listItem.active.state == "CALLING"){
				var callType = listItem.active.type;
				listItem.active = -1;
				api.emit("callUpdate", {state: "", oldState: "CALLING", target: listItem.id, callType: callType});
			}
		}, 30 * 1000);
	} else {
		listItem.active.myInitiate = false;
		listItem.active.callUsers = [appcore.uid];
		acceptCall(data.target, false);
	}
});
api.on("dropCall", function(data){
	clearTimeout(callTimeout);
	var listItem = appcore.list[appcore.listHash[data.target]];
	var oldState = (listItem.active && listItem.active.state) || "";
	var oldType = listItem.active && listItem.active.type;
	if(data.target.length == 37){
		listItem.active = false;
	} else {
		listItem.active.state = "CALLING";
		listItem.active.callUsers.splice(listItem.active.callUsers.indexOf(appcore.uid), 1);
		if(listItem.active.callUsers.length == 0){
			listItem.active = false;
		}
	}
	appcore.activeCall = "";
	api.emit("sendComm", {target: data.target, type: 6, message: {type: "dropCall"}});
	if(data.target.length == 20){
		appcore.sockemit("dropActive", {target: data.target});
	}
	api.emit("callUpdate", {state: listItem.active ? "CALLING" : "", oldState: oldState, target: listItem.id, callType: oldType});
});
api.on("acceptCall", function(data){
	acceptCall(data.target, true);
});
function acceptCall(target, sendAccept){
	// joins call for rooms
	var listItem = appcore.list[appcore.listHash[target]];
	if(listItem.active.state == "CALLING"){
		if(appcore.activeCall){
			api.emit("dropCall", {target: appcore.activeCall});
		}
		clearTimeout(callTimeout);
		listItem.active.state = "INCALL";
		appcore.activeCall = listItem.id;
		if(sendAccept){
			api.emit("sendComm", {target: target, type: 6, message: {type: "acceptCall"}});
			if(listItem.active.callUsers){
				listItem.active.callUsers.push(appcore.uid);
			}
		}
		appcore.sockemit("setActive", {target: target, type: listItem.active.type});
		api.emit("callUpdate", {state: "INCALL", oldState: "CALLING", target: target, callType: listItem.active.type});
	}
}
api.on("verifyKey", function(data){
	var otherPubKey = appcore.list[appcore.listHash[data.target]].pubKey;
	var myPubKey = appcore.pubKey;
	
	var keyCombined;
	if(data.target.substr(4).split("-")[0] == appcore.uid){
		keyCombined = myPubKey + otherPubKey;
	} else {
		keyCombined = otherPubKey + myPubKey;
	}
	
	var md = forge.md.sha256.create();
	md.update(keyCombined);
	api.emit("notify", {type: "verifyKeyInfo", hash: md.digest().toHex()});
});
var fingerprintsToVerify = [];
api.on("verifyFingerprint", function(data){
	appcore.sockemit("verifyFingerprint", {uid: data.uid, remoteFingerprint: data.remoteFingerprint, localFingerprint: data.localFingerprint});
	fingerprintsToVerify.push(data.uid);
	setTimeout(function(){
		if(fingerprintsToVerify.indexOf(data.uid) != -1 && appcore.activeCall){
			api.emit("dropCall", {target: appcore.activeCall});
			api.emit("verifyFingerprintResult", {result: data.result});
		}
	}, 6000);
});
appcore.sockon("verifyFingerprint", function(data){
	var otherUID = data.uids[0] == appcore.uid ? data.uids[1] : data.uids[0];
	if(fingerprintsToVerify.indexOf(otherUID) != -1){
		fingerprintsToVerify.splice(fingerprintsToVerify.indexOf(otherUID), 1);
	}
	if(data.result == "FAIL" && appcore.activeCall){
		api.emit("dropCall", {target: appcore.activeCall});
	} else if(data.result == "SUCCESS"){
		console.log("Fingerprint verified successfully.");
	}
	api.emit("verifyFingerprintResult", {result: data.result});
});
function decryptComm(comm, target){
	if(comm.decrypted){
		// Internal comm
		return comm.decrypted;
	}
	if(comm.type == 8 || comm.type == 9 || comm.type == 11){
		return JSON.parse(comm.data); // not end to end encrypted, system messages (eg joined room).
	}
	var listItem = appcore.list[appcore.listHash[target]];
	try {
		var key = appcore.profileBlob.conversations[target];
		var cipher = forge.cipher.createDecipher('AES-GCM', key);
		cipher.start({iv: comm.auxdata});
		cipher.update(forge.util.createBuffer(comm.data));
		cipher.finish();
	} catch (error) {
		console.error("Failed to decrypt message in " + target, comm);
		return {failedDecrypt: true, msg: "Failed to decrypt message."};
	}
	
	var decryptedData = cipher.output;
	if(decryptedData.data)
		decryptedData = decryptedData.data;
	var decryptedObject;
	try {
		decryptedObject = JSON.parse(decryptedData);
		// verify timestamp
		var fullTimestamp = 1400000000000 + decryptedObject.t * (60 * 60 * 1000);
		if(Math.abs(fullTimestamp - comm.time) < 25 * 60 * 60 * 1000){
			// timestamp OK (generous 25 - 26 hour grace period)
		} else {
			decryptedObject = false;
			throw new Error("Difference between client and server timestamp exceeds threshold.");
		}
	} catch (e) {
		console.log(e, decryptedData);
	}
	return (decryptedObject ? decryptedObject : false);
}
api.on("sendComm", function(data){
	// data.target data.type data.message ( object {} )
	var listItem = appcore.list[appcore.listHash[data.target]];
	var convKey = appcore.profileBlob.conversations[listItem.id];
	if(convKey){
		if(data.message.t)
			throw new Error("Message already has property 't' reserved for client timestamp", data.message);
			
		var shortTimestamp = Math.floor((new Date().getTime() - 1400000000000) / (60 * 60 * 1000)); // 1 hour blocks since May 14th 2014
		
		data.message.t = shortTimestamp;
		
		var iv = forge.random.getBytesSync(16);
		var cipher = forge.cipher.createCipher('AES-GCM', convKey); 
		
		cipher.start({iv: iv});
		cipher.update(forge.util.createBuffer(JSON.stringify(data.message)));
		cipher.finish();
		var encrypted = cipher.output.data;
		var inviteToRoom = (data.inviteToRoom ? data.inviteToRoom : undefined);
		appcore.sockemit("comm", {target: data.target, type: data.type, data: encrypted, auxdata: iv, inviteToRoom: inviteToRoom});
	} else {
		throw new Error("No convKey available for " + listItem.id);
	}
});
api.on("sendRawComm", function(data){
	appcore.sockemit("raw", data);
});
appcore.sockon("getPubKey", function(data){
	var listItem = appcore.list[appcore.listHash["conv" + sortUID(data.uid, appcore.uid)]];
	console.log(data.pubKey);
	listItem.pubKey = data.pubKey;
	
	var convKey = forge.random.getBytesSync(32); // 256 bit
	var signedMessage = convKey + "conv" + sortUID(data.uid, appcore.uid);
	
	var otherPartyPublicKey = forge.pki.publicKeyFromPem(data.pubKey);
	var privateKey = forge.pki.privateKeyFromPem(appcore.profileBlob.privateKey);
	
	var md = forge.md.sha256.create();
	md.update(signedMessage, 'utf8');
	var signature = privateKey.sign(md);
	
	var encrypted = otherPartyPublicKey.encrypt(signedMessage, 'RSA-OAEP');
	listItem.keyExchange = {encrypted: encrypted, signature: signature, convKey: convKey};
});
function decryptAndVerifyRSA(encrypted, signature, otherPubKey){
	var privateKey = forge.pki.privateKeyFromPem(appcore.profileBlob.privateKey);
	try {
		var decrypted = privateKey.decrypt(encrypted, 'RSA-OAEP');
		
		var md = forge.md.sha256.create();
		md.update(decrypted, 'utf8');
		
		otherPubKey = forge.pki.publicKeyFromPem(otherPubKey);
		var verified = otherPubKey.verify(md.digest().bytes(), signature);
		
		if(verified){
			var convKey = decrypted.substr(0,32);
			var convId = decrypted.substr(32);
			
			if(convId.length == 37){
				appcore.profileBlob.conversations[convId] = convKey;
				updateBlob(true, 'decryptAndVerify');
			}
		}
	} catch ( exception ) {
		throw exception;
	}
}
var commReadBuffer = [];
var commReadBufferTimeout = -1;
api.on("markRead", function(data){
	if(appcore.list[appcore.listHash[data.target]].canMarkRead){
		appcore.sockemit("markRead", {target: data.target});
		appcore.list[appcore.listHash[data.target]].canMarkRead = false;
	}
});
api.on("getBuffer", function(data){
	var listItem = appcore.list[appcore.listHash[data.target]];
	if(data.small == true){
		if(!listItem.hasBundle && !listItem.waitingForBundle){
			appcore.sockemit("getBuffer", {target: data.target, small: true});
			listItem.waitingForBundle = true;
		}
	} else {
		if(listItem.hasBundle != 2 && !listItem.waitingForBundle){
			appcore.sockemit("getBuffer", {target: data.target, small: false});
		}
	}
});
api.on("setProp", function(data){
	if(data.value == null){
		delete appcore.profileBlob.props[data.name];
	} else {
		appcore.profileBlob.props[data.name] = data.value;
	}
	updateBlob(true, 'setProp');
});
api.on("logout", function(data){
	appcore.reconnect = 0;
	appcore.sock.close();
	appcore.sockbuffer = [];
	appcore.list = [];
	appcore.listHash = [];
	appcore.profileBlob = {};
	appcore.bufferTimestampIgnore = [];
	appcore.userList = [];
	appcore.noListBuffer = [];
	appcore.bgColorCache = [];
	appcore.derivedKeyHash = "";
	appcore.derivedKey = "";
	appcore.derivedKeySalt = "";
	appcore.displayname = "";
	appcore.pubKey = "";
	appcore.uid = "";
	appcore.username = "";
	appcore.avatar = "";
	appcore.activeCall = "";
});
appcore.sockemit("version", {});
appcore.sockon("version", function(data){
	if(data.latestVersion){
		if(appcore.version < data.mandatory){
			api.emit("versionCheck", 2);
		} else if(appcore.version < data.latestVersion){
			api.emit("versionCheck", 1);
		} else {
			api.emit("versionCheck", 0);
		}
	} else {
		api.emit("versionCheck", -1);
	}
	if(Math.abs(data.time - new Date().getTime()) > 2 * 60 * 60 * 1000){
		// More than 2 hour time difference
		api.emit("systemTimeInaccurate", {});
	}
});
var updateCheckerInterval = setInterval(function(){
	appcore.sockemit("version", {});
}, 4 * 60 * 1000);

function sortUID(a, b){
	var r = [a, b].sort();
	return r[0] + "-" + r[1];
}
function updateBlob(force, info){
	if(appcore.profileBlob){
		var newProfileBlob = JSON.parse(JSON.stringify(appcore.profileBlob));
		var modified = false;
		if(!appcore.profileBlob.props){
			newProfileBlob.props = {};
			modified = true;
		}
		if(modified || force){
			var profileBlobJson = JSON.stringify(newProfileBlob);
			
			var iv = forge.random.getBytesSync(16);
			var cipher = forge.cipher.createCipher('AES-CBC', appcore.derivedKey);
			cipher.start({iv: iv});
			cipher.update(forge.util.createBuffer(profileBlobJson));
			cipher.finish();
			var cipherOutput = btoa(cipher.output.data);		
			
			console.log("Updated userblob. - ", force, info);
			appcore.sockemit("updateBlob", {iv: iv, blob: cipherOutput});
			appcore.profileBlob = newProfileBlob;
		}
	}
}
function randomUID(length){
    var s= '';
    var randomchar=function(){ // Just need to be unique, cryptographic properties not needed
    	var n= Math.floor(Math.random()*62);
    	if(n<10) return n; //1-10
    	if(n<36) return String.fromCharCode(n+55); //A-Z
    	return String.fromCharCode(n+61); //a-z
    }
    while(s.length < length) s+= randomchar();
    return s;
}
function getUserItem(uid){
	if(uid == appcore.uid){
		return appcore;
	}
	for(var i in appcore.list){
		if(appcore.list[i].uid == uid){
			return appcore.list[i];
		}
	}
	for(var i in appcore.userList){
		if(i == uid){
			return appcore.userList[i];
		}
	}
	return false;
}
function getNameFromUID(uid){
	var item = getUserItem(uid);
	if(item){
		return item.displayname || item.username;
	} else {
		return "?";
	}
}
function getProp(name){
	return appcore.profileBlob.props[name] || false;
}
