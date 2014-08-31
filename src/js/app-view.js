layScreen();
$(document).ready(function(){
	$(window).resize(layScreen);
	$(".preloader").hide();
	hooks();
	startScreen(false);
});
var statusText = ["Offline", "Online", "Busy", "Away", "Invisible"];
var hasFocus = true;
var titleBadgeCount = 0;
var openNotifications = [];
$(window).focus(function(){ hasFocus = true; for(var i in openNotifications){ if(openNotifications[i].cancel){ openNotifications[i].cancel() } else { openNotifications[i].close() } }; openNotifications = []; titleBadgeCount=0; document.title = "Subrosa"; setFaviconBadge(0); focusInput()});
$(window).blur(function(){ hasFocus = false; });

// Collect mouse movements to seed RNG
var entropyToCollect = 1024;
$("body").on("mousemove.entropyCollect", function(e) { entropyToCollect--; if(entropyToCollect==0){$("body").unbind("mousemove.entropyCollect")};forge.random.collectInt(e.clientX, 16); forge.random.collectInt(e.clientY, 16);});

var dividerDragging = "";
var lastMessageContentWidth = 0;


function startScreen(){
	$("#createAccountContent").hide();
	$("#startScreen").css("position", "relative").show();
	$("#startScreenContent").fadeIn(250);
	layScreen();
	$("#createAccountBtn").click(function(){
		if(!$(this).hasClass("disabled"))
			createAccountScreen();
	});
	
	if($("#loginUsername").val().length == 0 && window.localStorage && localStorage.getItem("lastUsername")){
		try {
			$("#loginUsername").val(localStorage.getItem("lastUsername"));
		} catch (error){
		}
	}
	// 'Remember me' auto sign in
	if(window.localStorage && window.localStorage.getItem("savedDerivedKey") && window.localStorage.getItem("savedDerivedKeySalt")){
		api.emit("loginDerivedKey", {username: localStorage.getItem("lastUsername"), derivedKey: window.localStorage.getItem("savedDerivedKey"), derivedKeySalt: window.localStorage.getItem("savedDerivedKeySalt")});
		
		$("#loginButton").text("Logging in");
		$("#loginButton").addClass("disabled");
		$("#signInSpinner").show();
		$("#loginRememberCheckbox").prop("checked", true);
	}
	
	$("#header").children().hide();
	
	if(document.location.protocol == "http:" && document.location.hostname != "localhost" && document.location.hostname != "127.0.0.1"){
		$("#httpWarning").removeClass("hide");
	}
	$("#versionString").text(appcore.version);
}
function createAccountScreen(){
	$("#startScreenContent").fadeOut(250);
	layScreen();
	setTimeout(function(){$("#createAccountContent").fadeIn(250)}, 250);
	$("#backToStartScreen").show();
}
function hooks(){
	createAccountHooks();
	mainAppHooks();
	
	$("form").submit(function(e){
		e.preventDefault();
	});
}
var checkUsernameTimeout = null;
var lastCaptchaChallenge = -1;

function createAccountHooks(){
	$("#backToStartScreen").click(startScreen);
	
	$("#createAccountStep1Username").val("");

	$("#createAccountStep1Username").keyup(function(event){
		clearTimeout(checkUsernameTimeout);
		checkUsernameTimeout = setTimeout(function(){
			api.emit("userExists", {username: $("#createAccountStep1Username").val()});
			$("#createAccountStep1Available").text("Checking..");
			$("#createAccountStep1Available").removeClass("errorNotice");
		}, 550);
	});	

	$("#createAccountStep1Displayname,#createAccountStep1Username").keyup(function(){
		if($("#createAccountStep1Displayname").val().length > 2 && !$("#createAccountStep1Available").hasClass("errorNotice")){
			$("#createAccountStep1Btn").removeClass("disabled");
		} else {
			$("#createAccountStep1Btn").addClass("disabled");
		}
	});
	
	$("#createAccountStep1Btn").click(function(){
		if(!$(this).hasClass("disabled")){
			$("#createAccountFooterError").text("");
			$("#createAccountStep1").css("position", "absolute").animate({left:"-500px"},550);
			$("#createAccountStep2").show().css("left", "500px").animate({left:"0px"}, 550);
			
			$("#loginUsername").val($("#createAccountStep1Username").val());
		}
	});
	
	$("#createAccountStep2Pass1").keyup(function(){
		if($("#createAccountStep2Pass1").val().length>=10){
			$("#createAccountStep2Length").text("OK");
		} else {
			$("#createAccountStep2Length").text("At least 10 chars");
		}
		if($("#createAccountStep2Pass1").val() == $("#createAccountStep2Pass2").val()){
			$("#createAccountStep2Match").text("OK");
		} else {
			$("#createAccountStep2Match").text("Doesn't match.");
		}
	});
	
	$("#createAccountStep2Pass2").keyup(function(){
		if($("#createAccountStep2Pass1").val() == $("#createAccountStep2Pass2").val()){
			$("#createAccountStep2Match").text("OK");
		} else {
			$("#createAccountStep2Match").text("Doesn't match.");
		}
		if($("#createAccountStep2Match").text() == "OK" && $("#createAccountStep2Length").text() == "OK"){
			$("#createAccountStep2Btn").removeClass("disabled");
		}
	});

	$("#createAccountStep2Btn").click(function(){
		if(!$(this).hasClass("disabled")){
			$("#backToStartScreen").hide();
			$(this).addClass("disabled");
			$("#createAccountStep2").css("position", "absolute").animate({left:"-500px"},550);
			$("#createAccountStep3").show().css("left", "500px").animate({left:"0px"}, 550);
			
			api.emit("genKey", {generating: function(){
				var htmlGen = "";
				for(var i = 0; i < 10; i++){
					htmlGen += randomUID(53) + "<br />";
				}
				$("#createAccountStep3Gen").html(htmlGen);
			}, generated: function(){
				$("#createAccountStep3").css("position", "absolute").animate({left:"-500px"},550);
				$("#createAccountStep4").show().css("left", "500px").animate({left:"0px"}, 550);
				
				api.emit("getCaptcha", {purpose: "createAccount"});
			} });
		}
	});
	
	$("#createAccountStep4Captcha,#createAccountStep4Email").keyup(function(){
		if($("#createAccountStep2Pass1").val().length > 5 && $("#createAccountStep4Email").val().length > 5){
			$("#createAccountStep4Btn").removeClass("disabled");
		}
	});
	
	$("#createAccountStep4Btn").click(function(){
		if(!$(this).hasClass("disabled")){
			$("#createAccountFooterError").text("");
			api.emit("register", {username: $("#createAccountStep1Username").val(), displayname: $("#createAccountStep1Displayname").val(), password: $("#createAccountStep2Pass1").val(), email: $("#createAccountStep4Email").val(), newsletter: $("#createAccountStep4Newsletter").is(":checked"), challenge: lastCaptchaChallenge,captcha: $("input#createAccountStep4Captcha").val()});
			
			$("#createAccountStep4Btn").hide();
			$("#createAccountStep4Text").html("<img src='/img/spinner.gif' class='spinneralign'> Registering..");
		}
	});
	api.on("registerResult", function(data){
		if(data.status == "FAIL"){
			$("input#createAccountStep4Captcha").val("");
			$("#createAccountFooterError").text(data.message);
			
			$("#createAccountStep4Text").text("");
			setTimeout(function(){$("#createAccountStep4Btn").show()}, 300);
			if(data.restart) {
				$("#createAccountStep1").css("position", "relative").css("left", "0px");
				$("#createAccountStep2").hide().css("position", "relative").css("left", "0px");
				$("#createAccountStep3").hide().css("position", "relative").css("left", "0px");
				$("#createAccountStep4").hide().css("position", "absolute").css("left", "-500px");
				$("#createAccountStep1Available").text("");
				$("#createAccountStep2Btn").removeClass("disabled");
			} else {
				api.emit("getCaptcha", {purpose: "createAccount"});
			}
		} else {
			$("#createAccountStep4").css("position", "absolute").animate({left:"-500px"},550);
			$("#createAccountStep5").show().css("left", "500px").animate({left:"0px"}, 550);
			$("#createAccountStep5Name").text($("#createAccountStep1Displayname").val());
			$("#createAccountStep5Username").text($("#createAccountStep1Username").val());
			$("#createAccountStep1Username").val("");
		}
	});
	
	$("#createAccountStep5Btn").click(startScreen);
	
	api.on("userExistsResult", function(data){
		if(data.username == $("#createAccountStep1Username").val()){
			$("#createAccountStep1Available").text((data.exists ? "Already taken." : "Available!"));
			if(data.error){
				$("#createAccountStep1Available").text(data.error);
			}
			if(data.exists || data.error){
				$("#createAccountStep1Available").addClass("errorNotice");
			}
			
			if($("#createAccountStep1Displayname").val().length > 2 && !$("#createAccountStep1Available").hasClass("errorNotice")){
				$("#createAccountStep1Btn").removeClass("disabled");
			} 
		} else {
			// searchElement
			if(data.exists){
				$(".sidebarListItem[data-item=searchElement] .listItemSubtitle").text("Add to your list");
				$(".sidebarListItem[data-item=searchElement]").attr("data-searchElementAdd", "conv" + sortUID(data.uid, appcore.uid));
			} else {
				$(".sidebarListItem[data-item=searchElement] .listItemSubtitle").text("There is no user named " + data.username);
			}
		}
	})
	
	$("#loginButton").click(function(){
		if($(this).hasClass("disabled"))
			return;
		if($("#loginUsername").val().length == 0){
			$("#loginUsername").shake();
			return;
		}
		if($("#loginPassword").val().length == 0){
			$("#loginPassword").shake();
			return;
		}
		$("#loginButton").addClass("disabled");
		$("#loginButton").text("Logging in..");
		$("#loginErrorMessage").text("");
		$("#signInSpinner").show();
		api.emit("loginMain", {username: $("#loginUsername").val(), password: $("#loginPassword").val()});
	});
	
	$("#loginRemember").mouseenter(function(){
		$("#loginRemember").popover($("#loginRememberPopover"));
	});
	$("#loginRemember").mouseleave(function(){
		$("#loginRemember").popover($("#loginRememberPopover"));
	});
	
	api.on("loginMainResult", function(data){
		$("#loginButton").text("Decrypt & Login");
		$("#loginButton").removeClass("disabled");
		$("#signInSpinner").hide();
		if(data.status == "FAIL"){
			$("#loginErrorMessage").text(data.message);
			
			localStorage.removeItem("savedDerivedKey"); // clear 'remember me'
			localStorage.removeItem("savedDerivedKeySalt")
		} else if(data.status == "OK"){
			loggedInCalls();
			mainApp();
		}
	});
	
	api.on("saveDerivedKey", function(data){
		if($("#loginRememberCheckbox").is(":checked")){
			if(window.localStorage && window.localStorage.setItem){
				try {
					localStorage.setItem("savedDerivedKey", data.key);
					localStorage.setItem("savedDerivedKeySalt", data.salt);
				} catch (error) {
					alert("Sorry, but your browser doesn't support localStorage. You can't use 'Remember me'.");
				}
			}
		}
	});
}
var hasNotificationPerm = false;
var permissionsContinue;
function mainAppHooks(){
	permissionsContinue = function(){
		$("#permissionScreen").css("position", "absolute").fadeOut(300);
		$("#mainScreen").css("position", "relative").fadeIn(300);
		changeTabTo("home");
	}
	if(navigator.userAgent.indexOf("Chrome") != -1 && window.Notification){
		$(".permissionsWebkit").removeClass("hide");
		if(window.Notification.permission === "granted")
			hasNotificationPerm = true;
	} else if(navigator.userAgent.indexOf("Firefox") != -1 && window.Notification){
		$(".permissionsMozilla").removeClass("hide");
		if(Notification.permission == "granted")
			hasNotificationPerm = true;
	} else {
		hasNotificationPerm = true;
	}
	$(".notificationPermPrompt").click(function(){
		if(!$(this).hasClass("disabled")){
			if(Notification){
				//$(".permissionsMozilla").removeClass("hide");
				Notification.requestPermission(function(){
					hasNotificationPerm = true;
					permissionsContinue();
				});
			};
			$(this).addClass("disabled").text("Look up");
		}
	});
	$(".sidebarListItem[data-item='me']").click(function(){
		$("#editProfileIcon").popover($("#editProfilePopover"));
	});
	// generate background color picks
	var allowedBgColors = ["EDFBFF", "EDECFC", "F2E8FF", "F3DAFF", "FCE1F9", "FFECEF", "FFF5E8", "FFF9E8", "FEFFE8", "E8FDE5", "E9FFD2", "FCFDFC"];
	var editProfileBgColorPicksHTML = "";
	for(var i in allowedBgColors){
		editProfileBgColorPicksHTML += "<div class='bgColorPick' style='background-color: #" + allowedBgColors[i] + "' data-bgColor='" + allowedBgColors[i] + "'></div>"; 
	}
	$("#editProfileBgColorPicks").html(editProfileBgColorPicksHTML);
	$("#editProfileBgColorPicks").on("click", ".bgColorPick", function(){
		api.emit("changeProfile", {bgColor: $(this).attr("data-bgColor")});
		$("#editProfileBack").click();
	});
	$("#mainSidebar").on("mousedown", ".sidebarListItem", function(){
		var itemName = $(this).attr("data-item");
		if(itemName == "searchElement"){
			if(!$(this).attr("data-searchElementAdd") || $(this).attr("data-searchElementAdd") == "invalid"){
				$(this).shake();
			} else {
				$(this).find(".listItemSubtitle").text("Loading..");
				api.emit("addList", {id: $(this).attr("data-searchElementAdd")});
				$("#quickstart").hide();
				$("#sidebarSearchInput").val("").trigger("keyup");
			}
		} else if(itemName == "me"){
			
		} else {
			changeTabTo(itemName);
		}
	});
	$("#sidebarSearchInput").clearable();
	$("#sidebarSearchInput").keyup(function(event){
		searchChange($("#sidebarSearchInput").val());
	});
	
	$("#mainLeftDivider").mousedown(function(){
		this.onselectstart = function(e){e.preventDefault();return false;}
		dividerDragging = "mainLeftDivider";
	});
	$("body").mouseup(function(){
		if(dividerDragging == "mainLeftDivider"){
			if(window.localStorage){
				try {
					window.localStorage.setItem("sidebarWidth", sidebarWidth);
				} catch (error){
				}
			}
		}
		dividerDragging = "";
		$("body").css("cursor", "auto");
		$("body").removeClass("noSelect");
	});
	$("body").mousemove(function(event){
		if(dividerDragging){
			if(dividerDragging == "mainLeftDivider"){
				sidebarWidth = event.pageX-15;
				if(sidebarWidth < 215){
					sidebarWidth = 215;
				} else if(sidebarWidth > 500){
					sidebarWidth = 500;
				}
				$("body").addClass("noSelect");
				$("body").css("cursor", "ew-resize");
				layScreen();
			}
		}
	});
	$(".requestTextarea").keyup(function(){
		if($(".requestTextarea").val().length){
			$(".sendRequestBtn").removeClass("disabled");
		} else {
			$(".sendRequestBtn").addClass("disabled");
		}
	});
	$(".sendRequestBtn").click(function(){
		if($(this).hasClass("disabled")){
			$(this).shake();
			return;
		}
		$("#addContactButton").removeClass("active");
		
		api.emit("addContact", {id: currentTab, message: $(".requestTextarea").val()});
		layContent(true, false);
		$(".addContactButton").popover($(".addContactPopover"));
	});
	$("#convButtons").on("click", "button", convButtonClick);
	$(".convMorePopover").on("click", "li", convButtonClick);
	api.on("getListsResult", layList);
	api.on("newText", newText);
	
	$("#convInput").keydown(function(event){
		if(event.keyCode == 13){
			if(!event.shiftKey){
				event.preventDefault();
				var layContentAfter = false;
				if(!appcore.profileBlob.conversations[currentTab])
					layContentAfter = true;
				api.emit("sendText", {target: currentTab, message: $("#convInput").val()});
				if(layContentAfter)
					layContent(false, false); // encrypted info update (now encrypted)
				$("#convInput").val("");
			}
		} else if(event.keyCode == 38){
			if(!event.shiftKey && $("#convInput").val().length == 0){
				// shortcut to edit last message
				if($(".convMessage.myMessage.chatMessage:last").length){
					$(".convMessage.myMessage:last").find(".messageEditButton").click();
				}
			}
		}
	});
	$("#convInput").keyup(function(event){
		if(event.keyCode == 8 || (event.keyCode >= 46 && event.keyCode <= 90)){
			if($("#convInput").val().length > 0){
				api.emit("updateTypingState", {target: currentTab, state: "typing"});
			} else {
				api.emit("updateTypingState", {target: currentTab, state: "empty"});
			}
		}
	});
	api.on("refreshTypingDisplay", refreshTypingDisplay);
	
	$("#convText").on("click", ".messageEditButton", function(){
		$(this).hide();
		$(this).parent().addClass("show"); // force showing the other actions
		$(this).parent().find(".messageEditCancelButton").show();
		var $convMessageContent = $(this).parent().parent().find(".convMessageContent");
		var originalContent = $convMessageContent.text();
		$convMessageContent.html("<textarea class='messageEditArea' data-original='" + escapeText(originalContent)  + "'>" + escapeText(originalContent) + "</textarea>");
		setTimeout(function(){
			$convMessageContent.find("textarea").focus().moveCaretToEnd();
		}, 1);
	});
	$("#convText").on("click", ".messageEditCancelButton", function(){
		$(this).hide();
		$(this).parent().removeClass("show");
		$(this).parent().find(".messageEditButton").show();
		var $convMessageContent = $(this).parent().parent().find(".convMessageContent");
		var originalContent = $convMessageContent.find("textarea.messageEditArea").attr("data-original");
		$(this).parent().parent().find(".convMessageContent").html(originalContent);
		
		$("#convInput").focus();
	});
	$("#convText").on("keydown", ".messageEditArea", function(event){
		var replaceTimestamp = $(this).parent().parent().attr("data-timestamp");
		if(event.keyCode == 13){ // enter
			if(!event.shiftKey){
				event.preventDefault();
				$(this).parent().parent().find(".messageEditCancelButton").click();
				api.emit("editText", {target: currentTab, newMessage: $(this).val(), replaceTimestamp: replaceTimestamp});
				// revert to message (instead of the textarea)
			}
		} else if(event.keyCode == 27){ // escape
			$(this).parent().parent().find(".messageEditCancelButton").click();
		}
	});
	
	$("#encInfo").click(function(event){
		$(this).popover($("#encInfoPopover"));
		event.preventDefault();
	});
	$("#myStatusSelect").change(function(){
		api.emit("changeStatus", {status: $(this).val()});
		var myListItem = $(".sidebarListItem[data-item='me']")
		myListItem.attr("data-status", appcore.status);
		
		myListItem.find(".listItemSubtitle").text(statusText[appcore.status]);
		$("#editProfileIcon").popover($("#editProfilePopover"));
	});
	$("#editProfileDisplayNameLink").click(function(){
		$("#editProfileHeader").fadeOut(500);
		$("#editProfileBack").fadeIn(500);
		$("#editProfileMain").hide();
		$("#editProfileDisplayName").fadeIn(500);
	});
	$("#editProfileBgColorLink").click(function(){
		$("#editProfileHeader").fadeOut(500);
		$("#editProfileBack").fadeIn(500);
		$("#editProfileMain").hide();
		$("#editProfileBgColor").fadeIn(500);
	});
	$("#editProfileBack").click(function(){
		$("#editProfileBack").fadeOut(500);
		$("#editProfileHeader").fadeIn(500);
		$("#editProfileDisplayName,#editProfileAvatar,#editProfilePassword,#editProfileAvatar,#editProfileBgColor").hide();
		$("#editProfileMain").fadeIn(500);
	});
	$("#editProfilePasswordLink").click(function(){
		$("#editProfileHeader").fadeOut(500);
		$("#editProfileBack").fadeIn(500);
		$("#editProfileMain").hide();
		$("#editProfilePassword").fadeIn(500);
	});
	$("#editProfileAvatarLink").click(function(){
		$("#editProfileHeader").fadeOut(500);
		$("#editProfileBack").fadeIn(500);
		$("#editProfileMain").hide();
		$("#editProfileAvatar").fadeIn(500);
	});
	$("#editProfilePasswordSave").click(function(){
		var errorMessages = $("#editProfilePassShort,#editProfilePassMismatch,#editProfilePassOldFail,#editProfileBgColor,#editProfilePassSuccess");
		errorMessages.hide();
		if($("#editProfileNewPass1").val().length < 10){
			$("#editProfilePassShort").show().shake();
			return;
		}
		if($("#editProfileNewPass1").val() != $("#editProfileNewPass2").val()){
			$("#editProfilePassMismatch").show().shake();
			return;
		}
		api.emit("changeProfile", {newpass: $("#editProfileNewPass1").val(), oldpass: $("#editProfileOldPass").val()});
		$("#editProfileNewPass1,#editProfileNewPass2,#editProfileOldPass").val("");
		
		if(!errorMessages.is(":visible")){
			$("#editProfilePassSuccess").show();
		}
	});
	$("#editProfileDisplayNameSave").click(function(){
		if($("#editProfileDisplayNameInput").val() == "*"){
			$.modal("displayNameNotAllowed");
		} else {
			api.emit("changeProfile", {displayname: $("#editProfileDisplayNameInput").val()});
			$("#editProfileDisplayNameText").text(appcore.displayname);
			$("#editProfileBack").click();
		}
	});
	$("#settingsBtn").click(function(){
		$(this).popover($("#settingsPopover"));
	});
	$("#generalVolumeSlider").change(function(){
		api.emit("setProp", {name: "generalVolume", value: this.value/100});
		var soundNewMessage = $("#soundNewMessage")[0];
		soundNewMessage.volume = this.value/100;
		// Stop it first in case it's already playing (fast volume changes could lead to overlap)
		soundNewMessage.pause();
		soundNewMessage.currentTime = 0;
		soundNewMessage.play();
	});
	$("#ringerVolumeSlider").change(function(){
		api.emit("setProp", {name: "ringerVolume", value: this.value/100});
		var soundRinging = $("#soundRinging")[0];
		// If the ringer is already playing and looping, stop here; previewing it would mess it up.
		if(!soundRinging.paused && soundRinging.loop) return;
		soundRinging.volume = this.value/100;
		// Stop it first in case it's already playing (fast volume changes could lead to overlap)
		soundRinging.pause();
		soundRinging.currentTime = 0;

		//Make sure it isn't looping and play it.
		soundRinging.loop = false;
		soundRinging.play();
	});
	$("#enableNotificationsCheckbox").change(function(){
		api.emit("setProp", {name: "disableNotifications", value: !this.checked});
		// store as disableNotifications as default behavior is false
	});
	$("#enableEmoticonsCheckbox").change(function(){
		api.emit("setProp", {name: "disableEmoticons", value: !this.checked});
		layContent(false, false); 
	});
	$("#roomInviteConfirm").click(function(){
		if($(this).hasClass("disabled"))
			return;
		var uids = []
		$("#roomInviteUserlist").find(".userListElement.selected").each(function(){
			uids.push($(this).attr("data-uid"));
		});
		if($(this).find("#roomCreateBtnText").is(":visible")){
			api.emit("createRoom", {invite: uids, mode: "new", name: $("#roomCreateName").val()});
			$(this).addClass("disabled");
		} else {
			api.emit("createRoom", {invite: uids, mode: "add", target: lastTab});
			$(this).addClass("disabled");
			changeTabTo(lastTab);
		}
	});
	$("#roomCreateName").keyup(testRoomInviteConfirm);
	$("#convText").on("click", "a.roomInviteLink", function(event){
		if(!appcore.listHash[$(this).attr("data-target")]){
			api.emit("joinRoom", {target: $(this).attr("data-target"), convKey: atob($(this).attr("data-convkey"))});
		} else {
			changeTabTo($(this).attr("data-target"));
		}
	});
	$("#roomInviteCancel,#roomEditCancel").click(function(){
		changeTabTo(lastTab);
	});
	$("#roomEditName").keyup(testRoomEditConfirm);
	$("#roomEditConfirm").click(function(){
		if($(this).hasClass("disabled"))
			return;
		api.emit("changeGroupInfo", {target: lastTab, name: $("#roomEditName").val()});
		changeTabTo(lastTab);
	});
	$("#convText").on("click", "#bufferMore", function(){
		$(this).text("Loading..");
		$(this).attr("data-scrollPos", $("#convText")[0].scrollHeight);
		api.emit("getBuffer", {target: currentTab, small: false});
	});
	$("#convText").on("click", ".verifyKey", function(){
		api.emit("verifyKey", {target: currentTab});
	});
	$("#convSubtitleUsersMore").click(function(){
		$(this).popover($("#usersMorePopover"));
		getUsersMore();
	});
	$("#voiceUsers").click(function(){
		$(this).popover($("#usersMorePopover"));
		getCallUsers();
	});
	$("#convSubtitleUsersList,#usersMorePopoverContent,#convText,#modal").on('click', '.userLink', function(){
		var convID = "conv" + sortUID(appcore.uid, $(this).attr("data-uid"));
		if(appcore.listHash[convID]){
			changeTabTo(convID);
		} else {
			api.emit("addList", {id: convID});
			$(this).text("Loading..");
		}
		if($(this).parents("#usersMorePopoverContent").length)
			$(this).popover($("#usersMorePopover")); // clear popover
		$.modal('kick', 'hide');
	});
	$("#usersMorePopover").on("click", ".userKickLink", function(){
		api.emit("kickUser", {target: currentTab, kicking: $(this).attr("data-uid")});
		$(this).text("Kicking..");
		if($(this).parents("#usersMorePopoverContent").length)
			$(this).popover($("#usersMorePopover"));
		layContent(true, false);
	});
	$("#usersMorePopover").on("click", ".userRankLink", function(){
		$("#userRankUsername").text(getNameFromUID($(this).attr("data-uid")));
		$("#userRankUsername").attr("data-uid", $(this).attr("data-uid"));
		$("#userRankSelect").change(); // trigger update
		$.modal("userRank", "show");
	});
	$("#userRankSelect").change(function(){
		var myRank = appcore.list[appcore.listHash[currentTab]].myRank;
		var userRank = appcore.list[appcore.listHash[currentTab]].ranks[$("#userRankUsername").attr("data-uid")] || 0;
		var setRankTo = $("#userRankSelect").val();
		
		$(".userRankDesc").hide();
		$(".userRankDesc[data-rank='" + setRankTo + "']").show();
		$("#userRankNoPermU,#userRankNoPermR").hide();
		$("#userRankApply").removeClass("disabled");
		if(myRank <= setRankTo && myRank != 9){
			$("#userRankNoPermR").show(); $("#userRankApply").addClass("disabled");
		} else if(myRank <= userRank && myRank != 9){
			$("#userRankNoPermU").show(); $("#userRankApply").addClass("disabled");
		}
	});
	$("#userRankApply").click(function(){
		$.modal("userRank", "hide");
		if(!$(this).hasClass("disabled"))
			api.emit("setUserRank", {target: currentTab, user: $("#userRankUsername").attr("data-uid"), newRank: $("#userRankSelect").val()});
	});
	api.on("userList", userList);
	$("#voiceDrop").click(function(){
		api.emit("dropCall", {target: currentTab});
	});
	$("#voiceAccept").click(function(){
		if(!apprtc.supported){
			$.modal("callsNotSupported", "show");
			return;
		}
		if(!getProp("webrtcWarning")){
			$("#p2pWarningContinue").attr("data-click", "#voiceAccept");
			$.modal("p2pWarning");
			api.emit("setProp", {name: "webrtcWarning", value: true});
			return;
		}
		api.emit("acceptCall", {target: currentTab});
	});
	$("#voiceMute").click(function(){
		if($(this).hasClass("on")){
			$(this).removeClass("on");
			setMicrophoneMute(false);
		} else {
			$(this).addClass("on");
			setMicrophoneMute(true);
		}
	});
	$("#videoMute").click(function(){
		if($(this).hasClass("on")){
			$(this).removeClass("on");
			setVideoMute(false);
		} else {
			$(this).addClass("on");
			setVideoMute(true);
		}
	});
	$(".avatarFile").change(function(event){
		var allowedTypes = ["image/png", "image/jpg", "image/jpeg"];
		var target = $(this).attr("data-target");
		if(event.target.files.length){
			$(".uploadAvatarProgress[data-target='" + target + "']").show();
			if(event.target.files[0].size > 2048 * 1024){
				$(".uploadAvatarProgress[data-target='" + target + "']").text("File size is too large (Max: 2MB)");
			} else if(allowedTypes.indexOf(event.target.files[0].type) == -1){
				$(".uploadAvatarProgress[data-target='" + target + "']").text("Only PNG and JPEG files are supported.");
			} else {
				$(this).hide();
				var reader = new FileReader();
				reader.onload = function(){
					//reader.result;
					api.emit("uploadAvatar", {data: reader.result, target: target});
				}
				reader.readAsBinaryString(event.target.files[0]);
			}
		}
	});
	$("#logoutBtn").click(function(){
		if(window.localStorage && window.localStorage.removeItem){
			localStorage.removeItem("savedDerivedKey"); // clear 'remember me'
			localStorage.removeItem("savedDerivedKeySalt")
		}
		api.emit("logout", {});
		$(".sidebarListItem").each(function(){
			var dataItem = $(this).attr("data-item");
			if(dataItem != "home" && dataItem != "searchElement" && dataItem != "meta" && dataItem != "gedit" && dataItem != "me"){
				$(this).remove();
			}
		});
		$(".contentTab.tab-conv,#mainScreen").hide();
		$.modal("logout");
		startScreen();
	});
	$("#p2pWarningContinue").click(function(){
		$.modal("videoSecurity", "hide");
		if($(this).attr("data-click")){
			$($(this).attr("data-click")).click();
		}
	});
	$("#videoSecurityCancel").click(function(){
		$.modal("videoSecurity", "hide");
	});
	$("#blockUser").click(function(){
		api.emit("blockUser", {target: currentTab});
		removeList(currentTab);
		$.modal("blockedUser", "show");
	});
	$("#unblockButton").click(function(){
		api.emit("blockUser", {target: currentTab, unblock: true});
		layContent(true, false);
	});
	$("#securityInfoTrigger").click(function(){
		$.modal("securityInfo");
	});
	$("#quickstartLink").click(function(){
		$(this).select();
	});
	$("#quickstartSearchTip").mouseover(function(){
		$("#sidebarSearchInput").addClass("highlighted");
	});
	$("#quickstartSearchTip").mouseout(function(){
		$("#sidebarSearchInput").removeClass("highlighted");
	});
	$("#pinToList").click(function(){
		$(this).hide();
		$("#unpinFromList").show();
		$(".sidebarListItem[data-item='" + currentTab + "']").remove();
		api.emit("setProp", {name: currentTab + "-pinned", value: true});
		layList(); // recreate current list item with new pinned position
	});
	$("#unpinFromList").click(function(){
		$(this).hide();
		$("#pinToList").show();
		$(".sidebarListItem[data-item='" + currentTab + "']").remove();
		api.emit("setProp", {name: currentTab + "-pinned", value: null});
		layList();
	});
	$("#testUserMedia").click(function(){
		if($("#mediaTest").is(":visible")){
			stopMediaTest();
			$("#mediaTest").slideUp();
		} else {
			startMediaTest();
			$("#mediaTest").slideDown();
		}
	});
	$("#mediaTest .close").click(function(){
		$("#testUserMedia").click();
	});
	$("#errorReporterReport").click(function(){
		api.emit("sendErrorReport", {trace: $("#errorReportTrace").text()});
		$("#errorReporterAsk").hide();
		$("#errorReporterThanks").show();
	});
	$("#errorReporterIgnore").click(function(){
		$.modal("errorReporter", "hide");
	});
	if(window.SubrosaEmoticons){
		window.SubrosaEmoticons.generatePicker($("#emojiPicker"), $("#convInput"));
	}
	$("#convEmoticon").click(function(){
		$(this).popover($("#convEmoticonPopover"));
	});
	$("#emojiPicker").on("click", ".emoji", function(){
		$("#convEmoticon").popover($("#convEmoticonPopover"));
		$("#convInput").focus().moveCaretToEnd();
	});
	// Automatically focus #convInput if user types without focusing. 
	$(document).keydown(function(event){
		if(document.activeElement.tagName == "BODY" && currentTab.substr(0,4) == "conv"){
			if((event.which >= 49 && event.which <= 57) || (event.which >= 65 && event.which <= 97) || (event.which >= 90 && event.which <= 122)){
				$("#convInput").focus();
			}
		}
	});
}
var lastTab = "";
var currentTab = "";
function mainApp(){
		$("#loginButton").text("Decrypt & Login");
		$("#loginButton").removeClass("disabled");
		$("#signInSpinner").hide();
		
		$("#loginPassword").val("");
		// remember username
		if(localStorage){
			try {
				localStorage.setItem("lastUsername", $("#loginUsername").val());
			} catch(error){
			}
		}
		
		$("#startScreen").css("position", "absolute").fadeOut(300);
		
		if(!hasNotificationPerm){ // check if we have permissions missing
			$("#permissionScreen").css("position", "static").fadeIn(300);
		} else {
			$("#mainScreen").css("position", "static").fadeIn(300);
			changeTabTo("home");
		}
		layScreen();
}
var convBodyHolders = {};
var convInputHolders = {};
function changeTabTo(tab){
	if(currentTab != ""){
		var currentTrigger = $(".sidebarListItem[data-item=" + currentTab + "]").attr("data-trigger");
		if(currentTrigger == "conv"){
			convInputHolders[currentTab] = $("#convInput").val();
		}
		$(".tab-" + currentTrigger).hide();
		$(".sidebarListItem[data-item=" + currentTab + "]").removeClass("activeItem");
	}
	lastTab = currentTab;
	currentTab = tab;
	var currentTrigger = $(".sidebarListItem[data-item=" + currentTab + "]").attr("data-trigger");
	$(".tab-" + currentTrigger).show();
	$(".tab-" + currentTrigger).attr("data-item", currentTab);
	$(".sidebarListItem[data-item=" + currentTab + "]").addClass("activeItem");
	$(".sidebarListItem[data-item=" + currentTab + "] .unreadBadge").slideUp(400, function(){
		$(this).text("0");
	});
	
	if(currentTrigger == "conv"){
		var listItem = appcore.list[appcore.listHash[currentTab]];
		api.emit("markRead", {target: currentTab});
		api.emit("getBuffer", {target: currentTab, small: true});
		
		focusInput();
		
		refreshTypingDisplay();
		if(listItem.relatedNotifications && listItem.relatedNotifications.length){
			for(var i in listItem.relatedNotifications){
				listItem.relatedNotifications[i] && listItem.relatedNotifications[i].close();
			}
			listItem.relatedNotifications = [];
		}
		
		if(convInputHolders[currentTab]){
			$("#convInput").val(convInputHolders[currentTab]);
			delete convInputHolders[currentTab];
		} else {
			$("#convInput").val("");
		}
	} else if(currentTrigger == "meta"){ // initalize where you call changeTabTo
	} else if(currentTrigger == "gedit"){ // likewise
	}
	
	layContent(true, true);
	layScreen(true);
}
function removeList(id){
	if(currentTab == id)
		changeTabTo("home");
	$(".sidebarListItem[data-item='" + id + "']").remove();
}
function newText(data){
	var listItem = appcore.list[appcore.listHash[data.target]];
	
	if(!convBodyHolders[data.target])
		convBodyHolders[data.target] = {buffer: [], live: [], lastUser: null, lastMsgSystem: null, lastDate: null};
	
	var convMessageUser = data.user;
	var convMessageUserShow = data.userShow;
	var isChatMessage = !(data.userShow == "*"); // messages with * userShow are not chat (type 2) messages
	var convMessageContent = parseChatMessage(data.message, data.userShow);
	var convMessageMeta = (data.timestamp ? "<span title='" + fullTime(data.timestamp) + "'>" + friendlyTime(data.timestamp) + "</span>" : "");
	var convMessageActions = (data.isMe && data.userShow != "*" ? "<div class='messageEditButton tinyButton'>Edit</div> <div class='messageEditCancelButton tinyButton' style='display: none'>Cancel</div>" : "");
	var newDivider = true;
	var lapseDivider = "";
	
	var date = new Date(parseInt(data.timestamp)).getDate();
	
	if(date != convBodyHolders[data.target].lastDate && convBodyHolders[data.target].lastDate != null){
		var countdown = dateTime(data.timestamp);
		lapseDivider = "<div class='convMessage lapseDivider'><i class='fa fa-calendar'></i> " + countdown + "</div>";
		convBodyHolders[data.target].lastUser = "calendar";
	}
	convBodyHolders[data.target].lastDate = date;
	
	if(!data.bgColor || data.bgColor.length != 6 || parseInt("0x" + data.bgColor) == NaN){
		data.bgColor = "inherit";
	} else {
		data.bgColor = "#" + data.bgColor;
	}
	
	if(data.userShow != "*"){
		if(convBodyHolders[data.target].lastUser == data.user && !convBodyHolders[data.target].lastMsgSystem){
			convMessageUserShow = "&nbsp;";
			newDivider = false;
		}
		convBodyHolders[data.target].lastMsgSystem = false;
	} else {
		convBodyHolders[data.target].lastMsgSystem = true;
	}
	convBodyHolders[data.target].lastUser = data.user;
	
	var htmlBuild = lapseDivider + "<div class='convMessage " + (data.isMe ? "myMessage " : "") + (data.small ? "smallMessage " : "") + (newDivider ? "newDivider " : "") + (isChatMessage ? "chatMessage " : "") + "' data-unread='" + (data.unread && (data.target != currentTab)) + "' style='background-color:" + data.bgColor + "' data-timestamp='" + data.timestamp + "' data-user='" + convMessageUser + "'><div class='newOrb'></div><div class='convMessageActions'>" + convMessageActions + "</div><div class='convMessageUser'>" + convMessageUserShow + "</div><div class='convMessageContent' style='width:" + lastMessageContentWidth + "px'>" + convMessageContent + "</div><div class='convMessageMeta'" + ">" + convMessageMeta + "</span></div></div>";
		
	if(data.isFromBuffer){
		convBodyHolders[data.target].buffer.push(htmlBuild);
	} else {
		convBodyHolders[data.target].live.push(htmlBuild);
	}
	if(convBodyHolders[data.target].buffer.length + convBodyHolders[data.target].live.length > 300){
		if(convBodyHolders[data.target].buffer.length){
			convBodyHolders[data.target].buffer.splice(0, 1);
		} else {
			convBodyHolders[data.target].live.splice(0, 1); 
		}
		if(data.target == currentTab){
			$(".convMessage:first").remove(); // only keep last 300 messages
		}
	}
		
	if(data.target == currentTab){
		var convText = $("#convText");
		if(data.isFromBuffer) {
			var bLD = convText.find("#bufferLiveDivider");
			if(bLD.length){
				bLD.before(htmlBuild);
			} else {
				convText.append(htmlBuild);
			}
			convText[0].scrollTop = convText[0].scrollHeight;
		} else {
			if(convText[0].scrollTop + convText[0].offsetHeight > convText[0].scrollHeight - 50)
				convText.stop().animate({scrollTop: convText[0].scrollHeight});
			convText.append(htmlBuild);
		}
		api.emit("markRead", {target: currentTab});
	} else {
		if(data.unread && !data.isMe){
			var badge = $(".sidebarListItem[data-item='" + data.target + "'] .unreadBadge");
			badge.slideDown(500).text(parseInt(badge.text())+1);
		}
	}
	
	if(data.unread && !data.isFromBuffer && !data.isMe){
		api.emit("notify", {type: "newMessage", uid: data.user, target: data.target, displayname: data.userShow, message: convMessageContent});
	}
}
api.on("replaceText", function(data){
	if(data.target == currentTab){
		var $theMessage = $(".convMessage[data-timestamp='" + data.replaceTimestamp + "'].chatMessage");
		if($theMessage.length){
			if($theMessage.attr("data-user") == data.user){
				$theMessage.find(".convMessageContent").html(data.newMessage);
				$theMessage.find(".convMessageContent").addClass("edited");
			}
		}
	}
	// edit convBodyHolders - due to the way it's set up, editing messages is quite 'hacky'.
	// good candidate for a refactor.
	if(convBodyHolders[data.target]){
		var replaceHTML = function(htmlString){
			$("#htmlToText").html(htmlString);
			$convMessage = $("#htmlToText").find(".convMessage");
			if($convMessage.length &&  $convMessage.hasClass("chatMessage") && $convMessage.attr("data-user") == data.user && $convMessage.attr("data-timestamp") == data.replaceTimestamp){
				$convMessage.find(".convMessageContent").html(data.newMessage);
				$convMessage.find(".convMessageContent").addClass("edited");
				return $("#htmlToText").html();
			} else {
				return htmlString;
			}
		}
		for(var i in convBodyHolders[data.target].buffer){
			if(convBodyHolders[data.target].buffer[i].indexOf(data.replaceTimestamp) != -1){
				convBodyHolders[data.target].buffer[i] = replaceHTML(convBodyHolders[data.target].buffer[i]);
			}
		}
		for(var i in convBodyHolders[data.target].live){
			if(convBodyHolders[data.target].live[i].indexOf(data.replaceTimestamp) != -1){
				convBodyHolders[data.target].live[i] = replaceHTML(convBodyHolders[data.target].live[i]);
			}
		}
		$("#htmlToText").html("");
	}
});
function parseChatMessage(input, userDisplay){
	var links = input.match(/(^|\s|\n)https?:\/\/[A-Za-z0-9\-]+\.[A-za-z0-9\/?&%;.#=\-~+!]+/g);
	for(var i in links){
		links[i] = links[i].trim().replace("\n", "");
		input = input.replace(links[i], '<a href="' + links[i].replace(/&amp;/g, "&") + '" target="_blank">' + links[i] + '</a>');
	}
	var lines = input.split("\n");
	for(var i = 0; i < lines.length; i++){
		if(lines[i].substr(0,4) == "/me ")
			lines[i] = "<i>" + userDisplay + " " + lines[i].substr(4) + "</i>";
	}
	input = lines.join("\n");
	if(window.SubrosaEmoticons && window.SubrosaEmoticons.markUp && !getProp("disableEmoticons")){
		input = window.SubrosaEmoticons.markUp(input);
	}
	
	input = input.replace(/\n/g, "<br />");
	return input;
}
function loggedInCalls(){
	var myListItem = $(".sidebarListItem[data-item='me']");
	myListItem.attr("data-status", appcore.status);
	myListItem.find(".listItemSubtitle").text(statusText[appcore.status]);
	$("#myStatusSelect").val(appcore.status);
	$("#meUsername").text(appcore.username);
	$("#editProfileUsernameText").text(appcore.username);
	$("#editProfileDisplayNameText").text(appcore.displayname);
	$("#editProfileDisplayNameInput").val(appcore.displayname);
	if(appcore.avatar){
		myListItem.find(".listItemIcon")[0].src = appcore.avatar;
	}
	$("#header").children().not("#settingsPopover").show();
	
	if(apprtc.supported){
		if(getBrowserName() == "Firefox" && getBrowserVersion() < 31){
			$("#infoOutdatedSupportCalls").show();
		} else {
			$("#infoSupportCalls").show();
		}
	} else {
		$("#infoNotSupportCalls").show();
	}
	if(document.location.hostname == "subrosa.io"){
		$("#infoHostedWarning").show();
	}
	if(getProp("generalVolume") !== false)
		$("#generalVolumeSlider").val(getProp("generalVolume")*100);
	if(getProp("ringingVolume") !== false)
		$("#ringingVolumeSlider").val(getProp("ringingVolume")*100);
	if(getProp("disableNotifications"))
		$("#enableNotificationsCheckbox").attr("checked", false);
	if(getProp("disableEmoticons"))
		$("#enableEMoticonsCheckbox").attr("checked", false);
}
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function friendlyTime(timeMs){
	if(!timeMs)
		return "?";
	var theDate = new Date(parseInt(timeMs));
	var nowDate = new Date();
	if(nowDate.getTime() - theDate.getTime() > 24 * 60 * 60 * 1000){
		// Jan 1
		return shortMonths[theDate.getMonth()] + " " + theDate.getDate();
	} else {
		// 10:00am
		var amOrPm = "am";
		var ampmHour = theDate.getHours();;
		if(theDate.getHours() > 12){
			ampmHour = theDate.getHours() - 12;
			amOrPm = "pm";
		}
		var paddedMinute = (theDate.getMinutes().toString().length == 1 ? "0" + theDate.getMinutes() : theDate.getMinutes());
		return ampmHour + ":" + paddedMinute + amOrPm ;
	}
}
function dateTime(timeMs){
	if(!timeMs)
		return "?";
	var theDate = new Date(parseInt(timeMs));
	return shortMonths[theDate.getMonth()] + " " + theDate.getDate();
}
function fullTime(timeMs){
	if(!timeMs)
		return "?";
	var theDate = new Date(parseInt(timeMs));
	var paddedMinute = (theDate.getSeconds().toString().length == 1 ? "0" + theDate.getSeconds() : theDate.getSeconds());
	var paddedSecond = (theDate.getSeconds().toString().length == 1 ? "0" + theDate.getSeconds() : theDate.getSeconds());
	return theDate.getFullYear() + " " + shortMonths[theDate.getMonth()] + " " + theDate.getDate() + " " + theDate.getHours() + ":" + paddedMinute + ":" + paddedSecond;
}
function focusInput(){
	if($("#convInput").is(":visible")){
		$("#convInput").focus()
	}
}
var searchNameTimeout = -1;
function searchChange(newSearchTerm){
	var neverHide = ["me", "home", "searchElement"];
	var alreadyInList = false;
	$(".sidebarListItem").each(function(){
		if($(this).attr("data-item") == "meta" || $(this).attr("data-item") == "gedit")
			return; // always hide meta
		if(neverHide.indexOf($(this).attr("data-item")) == -1){
			var title = $(this).find(".listItemTitle").text().toLowerCase();
			if(title.indexOf(newSearchTerm.toLowerCase()) == -1){
				$(this).slideUp(80);
			} else {
				$(this).slideDown(80);
				if(title == newSearchTerm.toLowerCase()){
					alreadyInList = true;
				}
			}
		}
	});
	
	var searchElement = $(".sidebarListItem[data-item=searchElement]");
	if(newSearchTerm.length != 0){
		searchElement.find(".listItemTitle").text(newSearchTerm);
		
		searchElement.attr("data-searchElementAdd", "invalid");
		clearTimeout(searchNameTimeout);
		
		if(newSearchTerm.length < 3){
			searchElement.find(".listItemSubtitle").text("There is no user named " + newSearchTerm);
		} else if(newSearchTerm.toLowerCase() == appcore.username.toLowerCase()){
			searchElement.find(".listItemSubtitle").text("That's you!");
		} else if(alreadyInList){
			searchElement.find(".listItemSubtitle").text("Already in your list!");
		} else {
			searchElement.find(".listItemSubtitle").text("Loading " + newSearchTerm + "..");
			searchNameTimeout = setTimeout(function(){
				api.emit("userExists", {username: newSearchTerm});
			}, 700);
		}
		
		searchElement.slideDown(80);
	} else {
		searchElement.slideUp(80);
	}
}
function newNotification(icon, title, content, closeAfter, showWithFocus){
	if(hasFocus && !showWithFocus)
		return;
	if(getProp("disableNotifications"))
		return;
	var newNotif;
	
	
	if(!hasFocus && !closeAfter){
		titleBadgeCount++;
		document.title = "(" + titleBadgeCount + ") Subrosa";
		setFaviconBadge(titleBadgeCount);
	}
	if(typeof Notification == 'undefined')
		return; // Notifications unsupported
	
	title = $("#htmlToText").html(title).text();
	content = $("#htmlToText").html(content);
	$("#htmlToText .emoji").each(function(){
		$(this).before($(this).attr("data-c"));
	});
	content = $("#htmlToText").text();
	
	if(title.length > 100)
		title = title.substr(0,98) + "..";
	if(content.length > 100)
		content = content.substr(0,98) + "..";
	
	if(Notification){
		newNotif = new Notification(title, {body: content, icon: icon});
	}
	if(!showWithFocus){
		openNotifications.push(newNotif);
	}
	if(closeAfter){
		setTimeout(function(){
			if(newNotif.close){
				newNotif.close();
			} else if(newNotif.cancel){
				newNotif.cancel();
			}
		}, closeAfter);
	}
	return newNotif;
}
function convButtonClick(event){
	if($(this).attr("id") == "addContactButton"){
		$(this).popover($(".addContactPopover"));
		if($(".requestTextarea").val().length){
			$(".sendRequestBtn").removeClass("disabled");
		} else {
			$(".sendRequestBtn").addClass("disabled");
		}
	} else if($(this).attr("id") == "moreButton"){
		$(this).popover($(".convMorePopover"));
	} else if($(this).attr("id") == "removeFromList" || $(this).attr("id") == "removeFromListRoom"){
		api.emit("removeList", {id: currentTab});
		$("#moreButton").popover($(".convMorePopover"));
		removeList(currentTab);
	} else if($(this).attr("id") == "removeFromContacts"){
		api.emit("removeContact", {id: currentTab});
		layContent(true, false);
	} else if($(this).attr("id") == "acceptContactButton"){
		api.emit("acceptContact", {id: currentTab});
		layContent(true, false);
	} else if($(this).attr("id") == "newGroupChat"){
		layRoomInviteUserList([appcore.list[appcore.listHash[currentTab]].uid], "");
		changeTabTo("meta");
	} else if($(this).attr("id") == "editGroupChat"){
		layRoomEdit(currentTab);
		changeTabTo("gedit");
	} else if($(this).attr("id") == "inviteButton"){
		layRoomInviteUserList([], currentTab);
		changeTabTo("meta");
	} else if($(this).attr("id") == "clearHistory"){
		api.emit("clearHistory", {target: currentTab});
		convBodyHolders[currentTab] = {live: [], buffer: []};
		$("#convText").text("");
		$.modal("historyCleared");
	} else if($(this).attr("id") == "voiceButton"){
		if(!$(this).hasClass("disabled")){
			if(!apprtc.supported){
				$.modal('callsNotSupported', 'show');
			} else {
				if(!getProp("webrtcWarning")){
					$("#p2pWarningContinue").attr("data-click", "#voiceButton");
					$.modal("p2pWarning");
					api.emit("setProp", {name: "webrtcWarning", value: true});
				} else {
					if(currentTab.length == 20 || appcore.list[appcore.listHash[currentTab]].status > 0){
						api.emit("makeCall", {target: currentTab, type: "voice"});
						layContent(true, false);
						$(this).addClass("disabled");
						if(currentTab.length == 20)
							$("#videoButton").addClass("disabled");
					} else {
						$.modal("notOnline", "show");
					}
				}
			}
		}
	} else if($(this).attr("id") == "videoButton"){
		if(!$(this).hasClass("disabled")){
			if(!apprtc.supported){
				$.modal('callsNotSupported', 'show');
			} else {
				if(!getProp("webrtcWarning")){
					$("#p2pWarningContinue").attr("data-click", "#videoButton");
					$.modal("p2pWarning");
					api.emit("setProp", {name: "webrtcWarning", value: true});
				} else {
					if(currentTab.length == 20 || appcore.list[appcore.listHash[currentTab]].status > 0){
						api.emit("makeCall", {target: currentTab, type: "video"});
						layContent(true, false);
						$(this).addClass("disabled");
						if(currentTab.length == 20)
							$("#voiceButton").addClass("disabled");
					} else {
						$.modal("notOnline", "show");
					}
				}
			}
		}
	}
}
api.on("homeData", function(data){
	var homeNewsHTML = "";
	for(var i in data.news){
		if(!data.news[i].link || data.news[i].link.substr(0,7) == "http://" || data.news[i].link.substr(0,8) == "https://"){
			homeNewsHTML += '<div class="homeNewsElem">' + (data.news[i].link ? '<a href="' + escapeText(data.news[i].link) + '" target="_blank">' : '') + '<span class="title">' + escapeText(data.news[i].title) + '</span>' + (data.news[i].link ? '</a>' : '') + '<span class="time">' + (data.news[i].time ? friendlyTime(data.news[i].time) : '') + '</span><span class="content">' + SubrosaEmoticons.markUp(escapeText(data.news[i].content)) + '</span></div>';
		}
	}
	homeNewsHTML += '</div>';
	$("#homeNews").append(homeNewsHTML);
});
api.on("versionCheck", function(status){
	if(status == 0){
		$("#versionInfo").text("up to date");
	} else {
		$("#versionInfo").addClass("errorMessage");
		if(status == 1){
			$("#versionInfo").text("New version available");
			$("#outdatedVersionMandatory").hide();
			$.modal("outdatedVersion");
		} else if(status == 2){
			$("#versionInfo").text("Critical security update required. You must update.");
			$("#outdatedVersionOptional").hide();
			$("#loginButton,#createAccountBtn").addClass("disabled");
			$.modal("outdatedVersion");
		} else {
			$("#versionInfo").text("Failed to check.");
		}
	}
});
api.on("systemTimeInaccurate", function(){
	$.modal("systemTimeInaccurate");
});
api.on("avatarUploadProgress", function(data){
	if(data.percent == 100){
		$(".uploadAvatarProgress[data-target='" + data.target + "']").html("<br />Uploaded avatar.");
		$(".avatarFile[data-target='" + data.target + "']").show();
	} else if(data.percent == -1){
		$(".uploadAvatarProgress[data-target='" + data.target + "']").hide();
		$(".avatarFile[data-target='" + data.target + "']").show();
			$.modal("avatarUploadFailed");
	} else {
		$(".uploadAvatarProgress[data-target='" + data.target + "']").text("Uploading (" + data.percent + "%)");
	}
});
api.on("callUpdate", function(data){
	if(data.state == "CALLING"){
		if(data.target.length == 37){
			if(!data.myInitiate){
				startRinging();
				var icon = appcore.list[appcore.listHash[data.target]].avatar || "img/noavatar.png";
				var name = appcore.list[appcore.listHash[data.target]].name || appcore.list[appcore.listHash[data.target]].displayname;
				newNotification(icon, "Call from " + escapeText(name), escapeText(name) + " is ringing you..", 0, false);
				startTitleAlert("CALL | Subrosa");
			}
			if(data.target != currentTab){
				changeTabTo(data.target);
			}
		} else {
			setListItem(data.target);
		}
	} else if(data.state == "INCALL"){
		startCallInput(appcore.activeCall.length==20, data.callType); // group, video
		setListItem(data.target);
	}
	if(data.oldState == "INCALL"){
		stopCallInput(data.callType);
	}
	if(data.oldState == "CALLING"){
		stopRinging();
		stopTitleAlert();
		document.title = "Subrosa";
	}
	if(data.state == ""){
		setListItem(data.target);
	}
	if(data.target == currentTab)
		layContent(true, false);
});
function startRinging(){
	$("#soundRinging")[0].volume = (getProp("ringerVolume") !== false ? getProp("ringerVolume") : 0.7);
	$("#soundRinging")[0].loop = true;
	$("#soundRinging")[0].play();
}
function stopRinging(){
	$("#soundRinging")[0].pause();
}
api.on("gotCaptcha", function(data){
	if(data.purpose == "createAccount"){
		$("#createAccountStep4CaptchaImg").html("<img id='createAccountCaptchaImg' />");
		$("#createAccountCaptchaImg").attr("src", data.captcha);
		lastCaptchaChallenge = data.challenge;
	} else {
		console.log(data);
	}
});
api.on("connectionState", function(data){
	if(data.state == "connected"){
		$("#disconnectedOverlay").hide();
	} else {
		$("#disconnectedOverlay").show();
	}
});
api.on("errorReporter", function(data){
	$("#errorReportTrace").text(data.trace);
	$("#errorReporterAsk").show();
	$("#errorReporterThanks").hide();
	$.modal("errorReporter", "show");
});
api.on("notify", function(data){
	if(data.type == "statusChanged"){
		if(data.newStatus != 0 && !data.oldStatus){
			var icon = appcore.list[appcore.listHash["conv" + sortUID(data.uid, appcore.uid)]].avatar || "img/noavatar.png";
			newNotification(icon, escapeText(data.displayname) + " is online", statusText[data.newStatus], 5000, true);
		}
		$(".sidebarListItem[data-item='conv" + sortUID(data.uid, appcore.uid) + "']").attr("data-status", data.newStatus == undefined ? '' : data.newStatus);
	} else if(data.type == "displaynameChanged"){
		if(data.uid){
			setListItem("conv" + sortUID(data.uid, appcore.uid));
		} else {
			setListItem(data.id);
		}
	} else if(data.type == "newMessage"){
		if(data.target.indexOf("-") != -1 || data.target==currentTab){
			var icon = getUserItem(data.uid).avatar || "img/noavatar.png";
			if(!hasFocus){
				$("#soundNewMessage")[0].volume = (getProp("generalVolume") !== false ? getProp("generalVolume") : 0.7);
				$("#soundNewMessage")[0].play();
				newNotification(icon, escapeText(data.displayname), data.message, 0, false)
			} else if(data.target != currentTab){
				if(!appcore.list[appcore.listHash[data.target]].relatedNotifications)
					appcore.list[appcore.listHash[data.target]].relatedNotifications = [];
				appcore.list[appcore.listHash[data.target]].relatedNotifications.push(newNotification(icon, escapeText(data.displayname), data.message, 0, true));
			}
		}
	} else if(data.type == "messageAck"){
		// Replaces timestamp of HTML element & convBodyHolder to server timestamp
		if(data.target == currentTab){
			$(".convMessage[data-timestamp='" + data.clientTs + "']").attr("data-timestamp", data.serverTs);
		}
		if(convBodyHolders[data.target]){
			for(var i in convBodyHolders[data.target].live){
				var messageHTML = convBodyHolders[data.target].live[i];
				// user cannot input ' , it's converted to the HTML entity
				if(messageHTML.indexOf("data-timestamp='" + data.clientTs + "'") != -1){
					convBodyHolders[data.target].live[i] = messageHTML.replace("data-timestamp='" + data.clientTs + "'", "data-timestamp='" + data.serverTs + "'");
					return;
				}
			}
		}
	} else if(data.type == "changePassOldWrong"){
		$("#editProfilePassOldFail").show().shake();
	} else if(data.type == "bundleRecieved"){
		var lastScrollPos;
		if(data.target == currentTab){
			$("#convText").find("#bufferLoading,#bufferMore").remove();
			if(data.more){
				$("#convText").prepend("<a id='bufferMore' href='javascript:;'><span class='fa fa-clock-o'></span>Decrypt earlier history</a>");
			} else {
				var bufferMore = $("#convText").find("#bufferMore");
				lastScrollPos = bufferMore.attr("data-scrollPos");
			}
		}
		if(!data.more && convBodyHolders[data.target] && convBodyHolders[data.target].buffer.length){
			convBodyHolders[data.target].buffer = [];
			layContent(false, true);
			if(lastScrollPos){
				setTimeout(function(){
					$("#convText")[0].scrollTop = $("#convText")[0].scrollHeight-lastScrollPos;
				}, 10);
			}
		}
	} else if(data.type == "userIdentified"){
		if(data.target == currentTab)
			layUsers();
	} else if(data.type == "kicked"){
		removeList(data.target);
		$("#kickerUsername").text(data.kickerUsername);
		$("#kickerUsername").attr("data-uid", data.kickerUID);
		$("#kickedFromName").text(data.roomName);
		$.modal('kicked', 'show');
	} else if(data.type == "noInvite"){
		$.modal('noInvite', 'show');
	} else if(data.type == "callUserUpdate"){
		if(data.target == currentTab){
			layContent(true, false);
			layUsersMore(true);
		}
		callUserUpdate(data.event, data.uid, data.callType);
	} else if(data.type == "avatarUpdated"){
		if(data.uid == appcore.uid){
			$(".sidebarListItem[data-item=me]").find(".listItemIcon")[0].src = data.avatar;
		} else if(data.uid){
			$(".sidebarListItem[data-item='conv" + sortUID(appcore.uid, data.uid) + "']").find(".listItemIcon")[0].src = data.avatar;
			if(currentTab.indexOf(data.uid) != -1){
				layContent(true, false);
			}
		} else {
			$(".sidebarListItem[data-item='" + data.id + "']").find(".listItemIcon")[0].src = data.avatar;
		}
	} else if(data.type == "verifyKeyInfo"){
		$("#verifyKeyHash #main").text(data.hash.substr(0,8));;
		$("#verifyKeyHash #tiny").text(data.hash.substr(8));
		$.modal("verifyKey");
	} else if(data.type == "contactChange"){
		setListItem(data.id ? data.id : "conv" + sortUID(appcore.uid, data.uid));
	} else if(data.type == "verifyFingerprintResult"){
		if(data.result == "SUCCESS"){
		} else {
			$.modal("verifyFingerprintResultFail", "show");
		}
	} else if(data.type == "noPermission"){
		$.modal("noPermission", "show");
	} else if(data.type == "userRankChanged"){
		if(data.target == currentTab){
			if($("#usersMorePopover:visible").length){
				layUsersMore(false); // rerender the user dropdown
			}
		}
	}
});
