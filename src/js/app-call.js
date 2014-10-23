var audioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.operaAudioContext;
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
var appcall = {};
appcall.micMute = false;
appcall.videoMute = false;
appcall.mediaTestAudioContext;
appcall.mediaTestAnalyser;
appcall.mediaTestMicrophone;
appcall.mediaTestNode;
appcall.callDuration = 0;
appcall.callDurationInterval = -1;

function startCallInput(group, type){
	navigator.getUserMedia({audio: true, video: type=="video"}, function(myMediaStream) {
		$("#overlay").css({"opacity": 0, "z-index": -100});
		$("#permissionGuide").css({"z-index": -101});
		appcall.mediaStream = myMediaStream;
		if(!appcore.activeCall){
			stopCallInput();
			return;
		}
		if(!group && appcore.activeCall.substr(4).split("-")[0] == appcore.uid){
			setTimeout(function(){
				rtcStart(appcall.mediaStream, group, (type == "video"));
			}, 100); // Hacky race condition fix.
		} else {
			rtcStart(appcall.mediaStream, group, (type == "video"));
		}
		
	}, function(error){
		alert("An error has occured. Please make sure you have allowed permission, and that no other programs are using the microphone/camera. See the console for more information.");
		console.log(error);
	});
	
	setTimeout(function(){
		if(!appcall.mediaStream || appcall.mediaStream.ended){
			$("#overlay").css({"opacity": 1, "z-index": 10000});
			$("#permissionGuide").css({"z-index": 10000});
		}
	}, 50);
	
	$("#callDuration").text((group ? "Waiting" : "Connecting"));
}
function callUserUpdate(event, uid, type){
	if(event == 'JOIN'){
		rtcUserJoin(uid);
	} else if(event == 'QUIT'){
		rtcUserQuit(uid);
	}
}
function stopCallInput(type){
	if(appcall.mediaStream){
		appcall.mediaStream.stop();
	}
	$("#callDuration").text("0:00");
	$("#voiceMute").removeClass("on");
	$("#videoMute").removeClass("on");
	$("#overlay").css({"opacity": 0, "z-index": -100});
	$("#permissionGuide").css({"z-index": -101});
	appcall.micMute = false;
	appcall.videoMute = false;

	rtcStop();
	appcall.callDuration = 0;
	clearInterval(appcall.callDurationInterval);
}
function setMicrophoneMute(muted){
	appcall.micMute = muted;
	if(appcall.mediaStream){
		appcall.mediaStream.getAudioTracks()[0].enabled = !muted;
	}
}
function setVideoMute(muted){
	appcall.videoMute = muted;
	if(appcall.mediaStream){
		if(appcall.mediaStream.getVideoTracks().length >= 1){
			appcall.mediaStream.getVideoTracks()[0].enabled = !muted;
		}
	}
	rtcSetVideoMute(muted);
}
function randomChar(){
	var n= Math.floor(Math.random()*62);
	if(n<10) return n; //1-10
	if(n<36) return String.fromCharCode(n+55); //A-Z
	return String.fromCharCode(n+61); //a-z
}
if(typeof AudioContext == 'undefined'){
	if(typeof webkitAudioContext != 'undefined'){
		AudioContext = webkitAudioContext;
	}
}
function startMediaTest(){
	navigator.getUserMedia({audio: true, video: true}, function(myMediaStream) {
		$("#overlay").css({"opacity": 0, "z-index": -100});
		$("#permissionGuide").css({"z-index": -101});
		appcall.mediaStream = myMediaStream;

		// add video stream
		attachMediaStream($("#mediaTestVideo")[0], appcall.mediaStream);
		$("#mediaTestVideo")[0].volume = 0;
		$("#mediaTestVideo")[0].play();
		
		// microphone activity indicator
		if(AudioContext){
			appcall.mediaTestAudioContext = new AudioContext();
			appcall.mediaTestMicrophone = appcall.mediaTestAudioContext.createMediaStreamSource(appcall.mediaStream);
			appcall.mediaTestVolume = appcall.mediaTestAudioContext.createGain();
			appcall.mediaTestMicrophone.connect(appcall.mediaTestVolume);
			if(appcall.mediaTestAudioContext.createScriptProcessor){
				appcall.mediaTestNode = appcall.mediaTestAudioContext.createScriptProcessor(2048, 1, 1);
			} else {
				appcall.mediaTestNode = appcall.mediaTestAudioContext.createJavascriptNode(2048, 1, 1);
			}
			appcall.mediaTestVolume.connect(appcall.mediaTestNode);
			appcall.mediaTestNode.connect(appcall.mediaTestAudioContext.destination);
			var rollingActivity = [];
			appcall.mediaTestNode.onaudioprocess = function(event) {
				var max = 0;
				var audioData = event.inputBuffer.getChannelData(0);
				
				var length = audioData.length;
				for (var i = 0; i < length; i += 128) {
					var sum = 0;
					for(var j = 0; j < 128; j++){
						sum += audioData[i+j];
					}
					if(sum > max){
						max = sum;
					}
				}
				
				if(rollingActivity.length == 3)
					rollingActivity = rollingActivity.splice(1);
				rollingActivity.push(max / 128);
				
				var rollingActivitySum = 0;
				for(var i = 0; i < rollingActivity.length; i++){
					rollingActivitySum += rollingActivity[i];
				}
				$("#mediaTestAudioBar").find(".filling").css("width", Math.round((rollingActivitySum/3)*80) + "px");
			}
		}
	}, function(error){
		alert("An error has occured. Please make sure you have allowed permission, and that no other programs are using the microphone/camera. See the console for more information.");
		console.log(error);
	});
	
	setTimeout(function(){
		if(!appcall.mediaStream || appcall.mediaStream.ended){
			$("#overlay").css({"opacity": 1, "z-index": 10000});
			$("#permissionGuide").css({"z-index": 10000});
		}
	}, 50);
}
function stopMediaTest(){
	if(appcall.mediaStream){
		appcall.mediaStream.stop();
	}
	if(appcall.mediaTestMicrophone)
		appcall.mediaTestMicrophone.disconnect(appcall.mediaTestVolume);
	if(appcall.mediaTestVolume)
		appcall.mediaTestVolume.disconnect(appcall.mediaTestNode);
	if(appcall.mediaTestNode)
		appcall.mediaTestNode.disconnect(appcall.mediaTestAudioContext);
}
appcall.createVideoPanel = function createVideoPanel(mediaStream, me, pc, userDisplay){
	if(!me){
		if(mediaStreamHasTracks(mediaStream))
			remoteTrackAdded();
		mediaStream.onaddtrack = remoteTrackAdded;
	}
	
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
	if(me){
		videoPanel.find("video")[0].muted = true; // prevent audio loopback
	}
	return id;
}
appcall.createAudioPlayer = function createAudioPlayer(mediaStream, me, pc, userDisplay){
	if(!me){
		if(mediaStreamHasTracks(mediaStream))
			remoteTrackAdded();
		mediaStream.onaddtrack = remoteTrackAdded;
	}
	
	var id = "player" + Math.round(Math.random()*999999999);
	pc.playerID = id;
	apprtc.playerCount++;
	
	apprtc.audioPlayers[id] = new Audio();
	attachMediaStream(apprtc.audioPlayers[id], mediaStream);
	apprtc.audioPlayers[id].play();
	return id;
}
appcall.removeVideoPanel = function removeVideoPanel(playerID){
	if(playerID){
		$("#" + playerID).remove();
	}
}
appcall.removeAudioPlayer = function removeAudioPlayer(playerID){
	if(playerID){
		if(apprtc.audioPlayers[playerID])
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
function remoteTrackAdded(event){
	clearInterval(appcall.callDurationInterval);
	appcall.callDurationInterval = setInterval(updateCallDuration, 1000);
}
function updateCallDuration(){
	appcall.callDuration++;
	var durationText = Math.floor(appcall.callDuration/60) + ":" + ((appcall.callDuration % 60).toString().length == 1 ? "0" + appcall.callDuration%60 : appcall.callDuration%60)
	$("#callDuration").text(durationText);
}
function mediaStreamHasTracks(mediaStream){
	return mediaStream.getAudioTracks().length || mediaStream.getVideoTracks().length;
}

$("#overlay").click(function(){
	$("#overlay").css({"opacity": 0, "z-index": -100});
	$("#permissionGuide").css({"z-index": -101});
});
