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
			}, 400); // Hacky race condition fix.
		} else {
			rtcStart(appcall.mediaStream, group, (type == "video"));
		}
		
	}, function(error){
		alert("An error " + error + " has occured. Please make sure you have allowed permission.");
	});
	
	setTimeout(function(){
		if(!appcall.mediaStream || appcall.mediaStream.ended){
			$("#overlay").css({"opacity": 1, "z-index": 10000});
			$("#permissionGuide").css({"z-index": 10000});
		}
	}, 50);
	
	appcall.callDurationInterval = setInterval(function(){
		appcall.callDuration++;
		var durationText = Math.floor(appcall.callDuration/60) + ":" + ((appcall.callDuration % 60).toString().length == 1 ? "0" + appcall.callDuration%60 : appcall.callDuration%60)
		$("#callDuration").text(durationText);
	}, 1000);
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
		appcall.mediaStream.getVideoTracks()[0].enabled = !muted;
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
		alert("An error " + error + " has occured. Please make sure you have allowed permission, and that no other programs are using the microphone/camera.");
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
