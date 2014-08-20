var apprtc = {};
apprtc.supported = true;
apprtc.mediaStream;
apprtc.playerCount = 0;
apprtc.localVideoPanel;
apprtc.callVideo = null;
apprtc.pc = [];
apprtc.audioPlayers = [];
apprtc.group = null;
apprtc.signalBuffer = []; // used to store signals received when RTC isn't ready
apprtc.pc_config = {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}, {'url': 'turn:46.28.205.143:3478', 'credential': 'turnserver', username: 'subrosa'}]};
apprtc.pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true},{'RtpDataChannels': true}]};
apprtc.sdpVoiceConstraints = {'mandatory': {'OfferToReceiveAudio':true}};
apprtc.sdpVideoConstraints = {'mandatory': {'OfferToReceiveAudio':true,'OfferToReceiveVideo':true }};

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
		apprtc.localVideoPanel = appcall.createVideoPanel(mediaStream, true, false, '');
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
	
	for(var i = 0; i < apprtc.signalBuffer.length; i++){
		rtcProcessSignal(apprtc.signalBuffer[i].object, apprtc.signalBuffer[i].to, apprtc.signalBuffer[i].sender);
	}
	apprtc.signalBuffer = [];
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
		if(apprtc.callVideo){
			appcall.removeVideoPanel(apprtc.pc[uid].playerID);
		} else {
			appcall.removeAudioPlayer(apprtc.pc[uid].playerID);
		}
		delete apprtc.pc[uid];
	}
}
function rtcStop(){
	if(apprtc.callVideo){
		appcall.removeVideoPanel(apprtc.localVideoPanel);
		for(var i in apprtc.pc){
			appcall.removeVideoPanel(apprtc.pc[i].playerID);
		}
	} else {
		for(var i in apprtc.pc){
			appcall.removeAudioPlayer(apprtc.pc[i].playerID);
		}
	}
	apprtc.mediaStream = null;
	apprtc.pc = [];
	apprtc.playerCount = 0;
	apprtc.localVideoPanel = null;
	apprtc.callVideo = null;
}
function createPeerConnection(uid) {
	var pc = new RTCPeerConnection(apprtc.pc_config, apprtc.pc_constraints);
	apprtc.pc[uid] = pc;
	pc.uid = uid;
	pc.onicecandidate = function(event){
		if(event.candidate){
			rtcSendSignal({type: "candidate", candidate: event.candidate.candidate, label: event.candidate.sdpMLineIndex, id: event.candidate.sdpMid}, pc.uid)
		}
	}
	pc.onaddstream = handleRemoteStreamAdded;
	pc.onremovestream = handleRemoteStreamRemoved;
}
function rtcCall(pc){
	pc.createOffer(function(sessionDescription){
		pc.setLocalDescription(sessionDescription);
		rtcSendSignal({type: "offer", sessionDescription: sessionDescription}, pc.uid);
	}, function(error){
		alert(error);
	}, (apprtc.callVideo ? apprtc.sdpVideoConstraints : apprtc.sdpVoiceConstraints));
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
function handleRemoteStreamAdded(event){
	var userItem = getUserItem(event.target.uid); // appcore
	if(apprtc.callVideo){
		appcall.createVideoPanel(event.stream, false, event.target, userItem.displayname || userItem.username);
	} else {
		appcall.createAudioPlayer(event.stream, false, event.target, userItem.displayname || userItem.username);
	}
	
	rtcSendSignal({type: "readyStep2"}, event.target.uid); // event.target is apprtc.pc[]
	
	setTimeout(function(){
		verifyFingerprint(event.target.uid, apprtc.pc[event.target.uid].remoteDescription.sdp, apprtc.pc[event.target.uid].localDescription.sdp);
	}, 1000);
}
function handleRemoteStreamRemoved(event){
	
}
function rtcProcessSignal(object, to, sender){
	if(object.type == "candidate"){
		try {
			apprtc.pc[sender].addIceCandidate(new RTCIceCandidate({candidate: object.candidate, sdpMLineIndex: object.label}));
		} catch (error) {
			console.log("Error adding candidate " + object.candidate.length, error);
		}
	} else if(object.type == "ready"){
		if(apprtc.playerCount>0 || (!apprtc.callVideo && apprtc.mediaStream)){
			if(initiateFirst(sender)){
				rtcCall(apprtc.pc[sender]);
			}
		} else {
			apprtc.signalBuffer.push({object: object, to: to, sender: sender});
		}
	} else if(object.type == "readyStep2" && to == appcore.uid){
		rtcCall[apprtc.pc[sender]];
	} else if(object.type == "offer" && to == appcore.uid){
		if(apprtc.pc[sender]){
			apprtc.pc[sender].setRemoteDescription(new RTCSessionDescription(object.sessionDescription));
			apprtc.pc[sender].createAnswer(function(sessionDescription){
				apprtc.pc[sender].setLocalDescription(sessionDescription);
				rtcSendSignal({type: "answer", sessionDescription: sessionDescription}, sender)
			}, function(){}, (apprtc.callVideo ? apprtc.sdpVideoConstraints : apprtc.sdpVoiceConstraints));
		}
	} else if(object.type == "answer" && to == appcore.uid){
		if(apprtc.pc[sender]){
			apprtc.pc[sender].setRemoteDescription(new RTCSessionDescription(object.sessionDescription));
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
		// Unexpected number of fingerprints obtained
		alert("Dropping call due to unexpected WebRTC fingerprints.");
		console.log(remoteFingerprint.length, localFingerprint.length, remoteSdp, localSdp);
		return api.emit("dropCall", {target: appcore.activeCall});
	}
	api.emit("verifyFingerprint", {remoteFingerprint: remoteFingerprint, localFingerprint: localFingerprint, uid: uid});
}
function initiateFirst(otherParty){
	return otherParty > appcore.uid;
}
