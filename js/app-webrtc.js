var apprtc = {};
apprtc.supported = true;
apprtc.mediaStream;
apprtc.playerCount = 0;
apprtc.localVideoPanel;
apprtc.callVideo = null;
apprtc.pc = [];
apprtc.audioPlayers = [];
apprtc.group = null;
apprtc.pc_config = {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}, {'url': 'turn:46.28.205.143:3478', 'credential': 'turnserver', username: 'subrosa'}]};
apprtc.pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true},{'RtpDataChannels': true}]};
apprtc.sdpVoiceConstraints = {'mandatory': {'OfferToReceiveAudio':true}};
apprtc.sdpVideoConstraints = {'mandatory': {'OfferToReceiveAudio':true,'OfferToReceiveVideo':true }};


var dataChannelsEnabled = false; // currently unused

if(typeof webkitRTCPeerConnection != 'undefined'){
	RTCPeerConnection = webkitRTCPeerConnection;
} else if(typeof mozRTCPeerConnection != 'undefined'){
	RTCPeerConnection = mozRTCPeerConnection;
} else {
	apprtc.supported = false;
}
if(typeof mozRTCSessionDescription != 'undefined'){
	RTCSessionDescription = mozRTCSessionDescription;
}
if(typeof mozRTCIceCandidate != 'undefined'){
	RTCIceCandidate = mozRTCIceCandidate;
}

function rtcStart(mediaStream, group, video){
	apprtc.mediaStream = mediaStream;
	apprtc.group = group;
	apprtc.callVideo = video;
	if(video){
		apprtc.localVideoPanel = createVideoPanel(mediaStream, true, false, '');
	}
	rtcSendSignal({type: "ready"}, null);
	var callUsers = appcore.list[appcore.listHash[appcore.activeCall]].active.callUsers;
	if(!callUsers){ // private conv
		callUsers = appcore.activeCall.substr(4).split("-");
	}
	for(var i in callUsers){
		if(callUsers[i] == appcore.uid) // ignore myself
			continue;
		createPeerConnection(callUsers[i]);
		var pc = apprtc.pc[callUsers[i]];
		try {
			pc.addStream(mediaStream);
		} catch (error) {
			alert("Error while sending mediaStream when I'm joining: " + error + " ; mediastream has " + apprtc.mediaStream.getAudioTracks().length + " audio tracks.");
		}
	}
}
function rtcUserJoin(uid){
	createPeerConnection(uid);
	try {
		apprtc.pc[uid].addStream(apprtc.mediaStream);
	} catch (error) { 
		alert("Error while sending mediaStream to new peer: " + error + " ; mediastream has " + apprtc.mediaStream.getAudioTracks().length + " audio tracks.");
	}
}
function rtcUserQuit(uid){
	if(apprtc.pc[uid]){
		removeVideoPanel(apprtc.pc[uid].playerID);
	}
}
function createVideoPanel(mediaStream, me, pc, userDisplay){
	var id = "panel" + Math.round(Math.random()*999999999);
	$("body").append("<div id='" + id + "' class='videoPanel'><video></video><div class='videoPanelActions'><div class='videoName'>" + (me ? "You" : escapeText(userDisplay)) + "</div><div class='videoHangup'>End</div></div></div>");
	var videoPanel = $("#" + id);
	videoPanel.draggable();
	videoPanel.find(".videoHangup").click(function(){
		api.emit("dropCall", {target: appcore.activeCall});
	});
	
	apprtc.playerCount++;
	// default position	
	if(me){
		videoPanel.addClass("small");
		if(apprtc.group){
			videoPanel[0].style.left = (window.innerWidth-160-25) + "px";
			videoPanel[0].style.top = "315px";
		} else if(window.innerHeight >= 570){
			videoPanel[0].style.left = (window.innerWidth-160-25) + "px";
			videoPanel[0].style.top = "410px";
		} else {
			videoPanel[0].style.left = (window.innerWidth-400-160-15-25) + "px";
			videoPanel[0].style.top = "95px";
		}
	} else if(apprtc.group){
		pc.playerID = id;
		videoPanel.addClass("medium");
		videoPanel[0].style.left = (window.innerWidth-(292*(apprtc.playerCount-1))) + "px";
		videoPanel[0].style.top = "95px";
	} else {
		pc.playerID = id;
		videoPanel[0].style.left = (window.innerWidth-400-25) + "px";
		videoPanel[0].style.top = "95px";
	}
	// attach video stream
	attachMediaStream(videoPanel.find("video")[0], mediaStream);
	videoPanel.find("video")[0].play();
	return id;
}
function createAudioPlayer(mediaStream, me, pc, userDisplay){
	var id = "player" + Math.round(Math.random()*999999999);
	pc.playerID = id;
	apprtc.playerCount++;
	
	apprtc.audioPlayers[id] = new Audio();
	attachMediaStream(apprtc.audioPlayers[id], mediaStream);
	apprtc.audioPlayers[id].play();
	return id;
}
function rtcStop(){
	if(apprtc.callVideo){
		removeVideoPanel(apprtc.localVideoPanel);
		for(var i in apprtc.pc){
			removeVideoPanel(apprtc.pc[i].playerID);
		}
	} else {
		for(var i in apprtc.pc){
			removeAudioPlayer(apprtc.pc[i].playerID);
		}
	}
	apprtc.mediaStream = null;
	apprtc.pc = [];
	apprtc.playerCount = 0;
	apprtc.localVideoPanel = null;
	apprtc.callVideo = null;
}
function removeVideoPanel(playerID){
	if(playerID){
		$("#" + playerID).remove();
	}
}
function removeAudioPlayer(playerID){
	if(playerID){
		apprtc.audioPlayers[playerID].pause();
		delete apprtc.audioPlayers[playerID];
	}
}
function attachMediaStream(element, stream) {
	if (typeof element.srcObject !== 'undefined') {
	  element.srcObject = stream;
	} else if (typeof element.mozSrcObject !== 'undefined') {
	  element.mozSrcObject = stream;
	} else if (typeof element.src !== 'undefined') {
	  element.src = URL.createObjectURL(stream);
	} else {
	  console.log('Error attaching stream to element.');
	}
}
function createPeerConnection(uid) {
	var pc = new RTCPeerConnection(apprtc.pc_config, apprtc.pc_constraints);
	apprtc.pc[uid] = pc;
	pc.uid = uid;
	pc.onicecandidate = function(event){
		if(event.candidate){
			rtcSendSignal({type: 'candidate', label: event.candidate.sdpMLineIndex, id: event.candidate.sdpMid, candidate: event.candidate.candidate}, pc.uid)
		}
	}
	pc.onaddstream = handleRemoteStreamAdded;
	pc.onremovestream = handleRemoteStreamRemoved;

	// Data channels
	if(dataChannelsEnabled){
		if (isInitiator) {
			sendChannel = pc.createDataChannel("sendDataChannel", {reliable: false});
			sendChannel.onmessage = handleMessage;

			sendChannel.onopen = handleSendChannelStateChange;
			sendChannel.onclose = handleSendChannelStateChange;
		} else {
			apprtc.pc[i].ondatachannel = gotReceiveChannel;
		}
	}
}
function rtcCall(pc){
	pc.createOffer(function(sessionDescription){
		pc.setLocalDescription(sessionDescription);
		rtcSendSignal(sessionDescription, pc.uid)
	}, function(error){
		alert(error);
	});
}
function rtcSetVideoMute(muted){
	if(apprtc.localVideoPanel){
		if(muted){
			$("#" + apprtc.localVideoPanel).find("video").hide();
		} else {
			$("#" + apprtc.localVideoPanel).find("video").show();
		}
	}
}
function handleIceCandidate(event){
}
function handleRemoteStreamAdded(event){
	var userItem = getUserItem(event.target.uid); // appcore
	if(apprtc.callVideo){
		createVideoPanel(event.stream, false, event.target, userItem.displayname || userItem.username);
	} else {
		createAudioPlayer(event.stream, false, event.target, userItem.displayname || userItem.username);
	}
	setTimeout(function(){
		verifyFingerprint(event.target.uid, apprtc.pc[event.target.uid].remoteDescription.sdp, apprtc.pc[event.target.uid].localDescription.sdp);
	}, 1000);
}
function handleRemoteStreamRemoved(event){
	console.log("handleRemoteStreamRemoved");
}
function handleMessage(){
	console.log("handleMessage");
}
function handleSendChannelStateChange(event){
	console.log("handleSendChannelStateChange");
}
function gotReceiveChannel(){
	console.log("gotReceiveChannel");
}
function rtcProcessSignal(object, to, sender){
	if(object.type == "candidate"){
		var candidate = new RTCIceCandidate({sdpMLineIndex:object.label,
		candidate:object.candidate});
		apprtc.pc[sender].addIceCandidate(candidate);
	} else if(object.type == "ready"){
		if(apprtc.playerCount>0 || (!apprtc.callVideo && apprtc.mediaStream)){ // I am ready
			if(!apprtc.pc[sender].playerID){
				rtcCall(apprtc.pc[sender]);
				rtcSendSignal({type: "ackReady"}, sender);
			}
		}
	} else if(object.type == "ackReady" && to == appcore.uid){
		if(!apprtc.pc[sender].playerID){
			rtcCall[apprtc.pc[sender]];
		}
	} else if(object.type == "offer" && to == appcore.uid){
		if(apprtc.pc[sender]){
			apprtc.pc[sender].setRemoteDescription(new RTCSessionDescription(object));
			apprtc.pc[sender].createAnswer(function(sessionDescription){
				apprtc.pc[sender].setLocalDescription(sessionDescription);
				rtcSendSignal(sessionDescription, sender)
			}, function(){}, apprtc.sdpVideoConstraints);
		}
	} else if(object.type == "answer" && to == appcore.uid){
		if(apprtc.pc[sender]){
			apprtc.pc[sender].setRemoteDescription(new RTCSessionDescription(object));
		}
	} else {
		console.log("Discarding RTC signal", object, to, sender);
	}
}
function rtcSendSignal(object, to){
	api.emit("sendComm", {target: appcore.activeCall, type: 10, message: {o: object, to: to}});
}
function verifyFingerprint(uid, remoteSdp, localSdp){
	var remoteFingerprint = remoteSdp.match(/^a=fingerprint:.+/m);
	var localFingerprint = localSdp.match(/^a=fingerprint:.+/m);
	if(remoteFingerprint.length == 1 && localFingerprint.length == 1){
		remoteFingerprint = remoteFingerprint[0];
		console.log("Remote fingerprint for " + uid + ": " + remoteFingerprint);
		localFingerprint = localFingerprint[0];
		console.log("Local fingerprint for " + uid + ": " + localFingerprint);
	} else {
		// Multiple fingerprints obtained
		api.emit("dropCall", {target: appcore.activeCall});
	}
	api.emit("verifyFingerprint", {remoteFingerprint: remoteFingerprint, localFingerprint: localFingerprint, uid: uid});
}
