var convMessageMetaHidden = false;
var sidebarCollapsed = false;
var sidebarWidth = 255;
if(window.localStorage && window.localStorage.getItem("sidebarWidth")){
	sidebarWidth = Math.max(window.localStorage.getItem("sidebarWidth"), 215);
}
function layScreen(keepScrollBot){
	var w = $(window).width();
	var h = $(window).height();
	
	var headerHeight = $("#header").height();
	$("#app").width(w);
	$("#body").height(h-headerHeight);
	
	if($("#startScreen").is(":visible")){
		if(h-headerHeight<500){
			$("#startScreenContent,#createAccountContent").css("height", h-headerHeight + "px");
			$("#startScreenContent,#createAccountContent").css("top", "10px");
		} else {
			$("#startScreenContent,#createAccountContent").css("height", 480 + "px");
			$("#startScreenContent,#createAccountContent").css("top", (h-headerHeight-480)/2 + "px");
		}
	}
	
	if(w <= 685 && !sidebarCollapsed){
		sidebarCollapsed = true;
		$("#mainSidebar").addClass("collapsed");
		$("#mainLeftDivider").hide();
	} else if(w > 685 && sidebarCollapsed){
		sidebarCollapsed = false;
		$("#mainSidebar").removeClass("collapsed");
		$("#mainLeftDivider").show();
	}
	
	if($("#mainScreen").is(":visible")){
		$("#mainSidebar").width((sidebarCollapsed ? 73 : sidebarWidth));
		$("#mainSidebar #sidebarList").height(h-headerHeight-20-30-45);
		$("#mainContent").height(h-headerHeight-22);
		$("#mainContent").width(w-(sidebarCollapsed ? 73 : sidebarWidth)-35);
	}
	
	if($("#permissionScreen").is(":visible")){
		$("#permissionScreenContent").css("left", (w-500)/2 + "px");
		if(h-headerHeight<500){
			$("#permissionScreenContent").css("height", h-headerHeight + "px");
			$("#permissionScreenContent").css("top", "0px");
		} else {
			$("#permissionScreenContent").css("height", 480 + "px");
			$("#permissionScreenContent").css("top", (h-headerHeight-480)/2 + "px");
		}
	}
	
	lastMessageContentWidth = ($("#mainContent").width() < 530 ? $("#mainContent").width()-167 : $("#mainContent").width()-226);
	if($(".tab-conv").is(":visible")){
		var tabH = $(".tab-conv").height();
		var tabW = $(".tab-conv").width();
		
		var interactive = $("#convActive").is(":visible") ? $("#convActive").height() : 0;
		$("#convBody").height(tabH-71-interactive-70);
		
		$(".convMessageContent").width(lastMessageContentWidth);
		$("#convInput").width(Math.min(475, $("#convFooter").width()-190));
		if(keepScrollBot === true){
			$("#convText")[0].scrollTop = $("#convText")[0].scrollHeight;
		}
		if(tabW <= 530 && !convMessageMetaHidden){
			convMessageMetaHidden = true;
			$("#convText").addClass("hideMeta");
		} else if(tabW > 530 && convMessageMetaHidden){
			convMessageMetaHidden = false;
			$("#convText").removeClass("hideMeta");
		}
	}
	
	if(keepPos) // popovers
		keepPos();
	if(keepPosModals)
		keepPosModals();
}
function layContent(header, body){
	var curTab = $(".contentTab:visible");
	
	document.getElementsByTagName("body")[0].style['display'] = 'none';
	var curItem = curTab.attr("data-item");
	if(curTab.hasClass("tab-conv")){
		var listItem = appcore.list[appcore.listHash[currentTab]];
		var convHeader = curTab.find("#convHeader");
		var convFooter = curTab.find("#convFooter");
		
		if(header){
			if(listItem.id.indexOf("-") != -1){
				convHeader.find("#convPicture").attr("data-status", (typeof listItem.status != "undefined" ? listItem.status : ""));
				convHeader.find("#convDisplayName").text((listItem.displayname ? listItem.displayname : listItem.username));
				convHeader.find("#convSubtitleStatus").show().text((typeof listItem.status != "undefined" ? statusText[listItem.status] : "Not contacts"));
				convHeader.find("#convSubtitleUsers").hide();
				
				convHeader.find("#inviteButton, #editGroupChat, #removeFromListRoom").hide();
				convHeader.find("#newGroupChat, #blockUser").show();
			
				if(listItem.contact == 2){
					convHeader.find("#addContactButton,#addContactFakeButton,#removeFromList,#acceptContactButton").hide();
					convHeader.find("#voiceButton,#videoButton,#removeFromContacts").show();
				} else if(listItem.contact == 1){
					if(listItem.myRequest){
						convHeader.find("#addContactFakeButton,#removeFromList").show();
						convHeader.find("#acceptContactButton").hide();
					} else {
						convHeader.find("#acceptContactButton").show();
						convHeader.find("#addContactFakeButton").hide();
					}
					convHeader.find("#removeFromList").show();
					convHeader.find("#voiceButton,#videoButton,#addContactButton,#removeFromContacts").hide();
				} else if(listItem.contact == 0){
					convHeader.find("#addContactButton,#removeFromList").show();
					convHeader.find("#voiceButton,#videoButton,#addContactFakeButton,#removeFromContacts,#acceptContactButton").hide();
				}
				if(getProp(listItem.uid + "-blocked")){
					$("#unblockButton").show();
					$("#addContactButton,#blockUser").hide();
				} else {
					$("#unblockButton").hide();
				}
			} else {
				convHeader.find("#convPicture").attr("data-status", "-1");
				convHeader.find("#convDisplayName").text(listItem.name);
				layUsers();
				
				convHeader.find("#convSubtitleStatus,#addContactButton,#addContactFakeButton,#removeFromList,#removeFromContacts,#acceptContactButton,#newGroupChat,#unblockButton,#blockUser").hide();
				convHeader.find("#convSubtitleUsers,#voiceButton,#videoButton,#removeFromListRoom,#inviteButton").show();
				
				if(listItem.myRank >= 4){
					convHeader.find("#editGroupChat").show();
				} else {
					convHeader.find("#editGroupChat").hide();
				}
			}
			
			if(listItem.avatar){
				convHeader.find("#convPicture")[0].src = listItem.avatar;
			} else {
				convHeader.find("#convPicture")[0].src = (listItem.id.indexOf("-") == -1 ? "img/group.png" : "img/noavatar.png");
			}
						
			if(getProp(listItem.id + "-pinned")){
				$("#unpinFromList").show();
				$("#pinToList").hide();
			} else {
				$("#unpinFromList").hide();
				$("#pinToList").show();
			}
			
			var convActive = $("#convActive");
			if(listItem.active && listItem.active.type){
				if(listItem.active.callUsers){
					// room
					convActive.find("#voiceUsers").show();
					convActive.find("#voiceUsersCount").text(listItem.active.callUsers.length);
				} else {
					convActive.find("#voiceUsers").hide();
				}
				if(listItem.active.type == "voice"){
					$("#voiceButton").addClass("disabled");
					if(listItem.active.callUsers)
						$("#videoButton").addClass("disabled"); // no switching call types in rooms
					$("#voiceActive").removeClass("video");
					$("#videoIcon,#videoMute").hide();
					$("#voiceIcon").show();
				} else {
					$("#videoButton").addClass("disabled");
					if(listItem.active.callUsers)
						$("#voiceButton").addClass("disabled"); // no switching call types in rooms
					$("#voiceActive").addClass("video");
					$("#voiceIcon").hide();
					$("#videoIcon,#videoMute").show();
				}
				if(listItem.active.state == "CALLING"){
					if(listItem.active.myInitiate){
						convActive.find("#voiceAccept,#voiceDropDrop,#voiceIncallText,#callDuration,#voiceGroupText,#voiceControls,#voiceIncomingText").hide();
						convActive.find("#voiceRingingText,#voiceDropCancel").show();
					} else {
						convActive.find("#voiceDropCancel,#voiceRingingText,#voiceIncallText,#callDuration,#voiceControls").hide();
						convActive.find("#voiceIncomingText,#voiceAccept,#voiceDropAccept,#voiceDropDrop").show();
						if(listItem.active.callUsers){
							convActive.find("#voiceAcceptAccept,#voiceDrop,#voiceIncomingText").hide();
							convActive.find("#voiceAcceptJoin,#voiceGroupText").show();
						} else {
							convActive.find("#voiceAcceptJoin,#voiceGroupText").hide();
							convActive.find("#voiceAcceptAccept,#voiceIncomingText").show();
						}
					}
				} else if(listItem.active.state == "INCALL"){
					convActive.find("#voiceIncomingText,#voiceAccept,#voiceRingingText,#voiceDropCancel,#voiceGroupText").hide();
					convActive.find("#voiceIncallText,#callDuration,#voiceDropDrop,#voiceDrop,#voiceControls").show();
				}			
				if(!convActive.is(":visible")){
					convActive.slideDown(400, function(){
						layScreen(true);
					});
				}
			} else {
				if(appcore.activeCall && appcore.activeCall != currentTab){
					// active call in different tab, just hide
					convActive.hide();
				} else {
					convActive.slideUp(400, function(){
						layScreen(true);
					});
				}
				$("#voiceButton").removeClass("disabled");
				$("#videoButton").removeClass("disabled");
			}
		}
		if(!appcore.profileBlob.conversations[listItem.id]){
			convFooter.find("#encInfoReady,#encPopoverReady").show();
			convFooter.find("#encInfoEncrypted,#encPopoverEncrypted").hide();
		} else {
			convFooter.find("#encInfoReady,#encPopoverReady").hide();
			convFooter.find("#encInfoEncrypted,#encPopoverEncrypted").show();
			convFooter.find("#encKey").text(appcore.profileBlob.conversations[listItem.id]);
		}
		if(getProp("disableEmoticons")){
			convFooter.find("#convEmoticon").hide();
		} else {
			convFooter.find("#convEmoticon").show();
		}
		if(body){
			curTab.find("#convText").html(ConvModel.renderModel(listItem.id));
			curTab.find("#convText")[0].scrollTop = curTab.find("#convText")[0].scrollHeight;
		}
		layScreen();
		
		var dataStatus = listItem.status;
		if(typeof dataStatus == "undefined"){
			if(listItem.id.indexOf("-") != -1)
				dataStatus = "";
			else
				dataStatus = "-1";
		}
		
		$(".sidebarListItem[data-item='" + listItem.id + "']").attr("data-status", dataStatus);

	}
	document.getElementsByTagName("body")[0].style['display'] = 'block';
}
api.on("lay", function(){
	layContent(true, false);
});
function layList(){
	$(".sidebarList").hide(); //disable redraw until end
	for(var i in appcore.list){
		var item = appcore.list[i];
		if($(".sidebarListItem[data-item='" + item.id + "']").length == 0){
			var added = false;
			var thisPinned = getProp(item.id + "-pinned");
			var thisName = item.name || item.displayname || item.username;
			
			$(".sidebarListItem").each(function(){
				var itemID = $(this).attr("data-item");
				if(itemID == "me" || itemID == "searchElement" || itemID == "home" || itemID == "meta" || itemID == "gedit"){
					
				} else {
					var lastCommunication = Math.max(appcore.list[appcore.listHash[itemID]].lastMessage, appcore.list[appcore.listHash[itemID]].lastMyMessage);
					var objPinned = getProp(itemID + "-pinned"); // obj being list item being tested
					var objName = $(this).find(".listItemTitle").text();
					
					if(thisPinned){
						if(objPinned){
							if(objName > thisName){ // compare alphabetically
								added = true;
							}								
						} else {
							added = true;
						}
					} else {
						if(objPinned){
							// don't add before a pinned item
						} else {
							if(Math.max(item.lastMessage, item.lastMyMessage) > lastCommunication){
								added = true;
							}
						}
					}
					
					if(added){
						$(this).before(createItemHTML("conv", item));
						return false;
					}
				}
			});
			if(!added){ // add at the end
				$(".sidebarListItem:last").after(createItemHTML("conv", item));
			}
			if($(".sidebarListItem[data-item='searchElement']").attr("data-searchelementadd") == item.id){
				$(".sidebarSearchInput").val("").trigger("keyup");
				changeTabTo(item.id);
			}
			if(item.created){
				changeTabTo(item.id);
			}
		}
	}
	
	if(appcore.list.length){
		$("#quickstart").hide();
	}
	
	$(".sidebarList").show();
}
function createItemHTML(type, item){
	if(type == "conv"){
		var pinnedIcon = '<span class="listItemPinned fa fa-thumb-tack"' + (getProp(item.id + "-pinned") ? '' : ' style="display: none"') + '></span>';
		if(item.id.indexOf("-") != -1){
			var subtitle = (typeof item.displayname != 'undefined' ? item.username : "");
			if(!subtitle){
				if(item.contact == 0){
					subtitle = "Not contacts";
				} else if(item.myRequest){
					subtitle = "Sent request";
				} else {
					subtitle = 'Contact request';
				}
			}
			return '<div class="sidebarListItem' + (currentTab==item.id ? ' activeItem' : '') + '" data-item="' + escapeText(item.id) + '" data-trigger="conv" data-status="' + (typeof item.status != 'undefined' ? item.status : "") + '">' + pinnedIcon + '<div class="unreadBadge">0</div><img src="' + (item.avatar ? escapeText(item.avatar) : 'img/noavatar.png') + '" class="listItemIcon" /><span class="listItemTitle">' + escapeText(item.displayname || item.username) + '</span> <br /><span class="listItemSubtitle">' + escapeText(subtitle)  + '</span></div>';
		} else {
			return '<div class="sidebarListItem' + (currentTab==item.id ? ' activeItem' : '') + '" data-item="' + escapeText(item.id) + '" data-trigger="conv" data-status="-1">' + pinnedIcon + '<div class="unreadBadge">0</div><img src="' + (item.avatar ? escapeText(item.avatar) : 'img/group.png') + '" class="listItemIcon" data-status="room" /><span class="listItemTitle">' + escapeText(item.name) + '</span> <br /><span class="listItemSubtitle">' + (item.active ? '<span class="inCallSubtitle">Group call</span>' : "Group chat") + '</span></div>';
		}
	}
}
function setListItem(id){
	// todo set full list etc
	var sidebarList = $(".sidebarListItem[data-item='" + id + "']");
	var listItem = appcore.list[appcore.listHash[id]];
	
	if(id.length == 20){
		sidebarList.find(".listItemTitle").text(listItem.name);
		sidebarList.find(".listItemSubtitle").html((listItem.active && listItem.active != -1 ? '<span class="inCallSubtitle">Group call</span>' : "Group chat"));
	} else {
		sidebarList.find(".listItemTitle").text(listItem.displayname || listItem.username);
		var subtitle = (typeof listItem.displayname != 'undefined' ? escapeText(listItem.username) : "");
		if(!subtitle){
			if(listItem.contact == 0){
				subtitle = "Not contacts";
			} else if(listItem.myRequest){
				subtitle = "Sent request";
			} else {
				subtitle = 'Contact request';
			}
		}
		sidebarList.find(".listItemSubtitle").html(subtitle);
	}
	if(appcore.activeCall == id){
		sidebarList.find(".listItemSubtitle").html('<span class="inCallSubtitle">In call..</span>');
	}
}
function layRoomInviteUserList(checked, addTo){
	var userListHTML = "";
	for(var i in appcore.list){
		if(appcore.list[i].id.indexOf("-") != -1){
			var selected = checked.indexOf(appcore.list[i].uid) != -1;
			userListHTML += '<div class="userListElement ' + (selected ? "selected" : "") + '" data-uid="' + escapeText(appcore.list[i].uid) + '"><img src="' + (appcore.list[i].avatar ? escapeText(appcore.list[i].avatar) : 'img/noavatar.png') + '" class="userListIcon" /><span>' + escapeText(appcore.list[i].username) + '</span><br /><small class="inviteMsg">' + (selected ? 'Selected' : 'Not selected') + '</small></div>';
		}
	}
	$("#roomInviteConfirm").addClass("disabled");
	$("#roomInviteUserlist").html(userListHTML);
	if(addTo){
		var name = appcore.list[appcore.listHash[addTo]].name;
		$("#roomInviteCreate,#roomCreateBtnText").hide();
		$("#roomInviteAdd,#roomAddBtnText").show();
		$("#roomAddName").text(name);
		disableInvited(addTo);
		if(!appcore.list[appcore.listHash[addTo]].pendingInvites){
			api.emit("getUsers", {target: addTo});
		}
	} else {
		$("#roomInviteCreate,#roomCreateBtnText").show();
		$("#roomInviteAdd,#roomAddBtnText").hide();
	}
	$(".userListElement").click(function(){
		var userListElement = $(this).hasClass("userListElement") ? $(this) : $(this).parent();
		if(userListElement.hasClass("invited")){
			$(userListElement).shake();
		} else if(userListElement.hasClass("selected")){
			$(userListElement).removeClass("selected").find(".inviteMsg").text("Not selected");
		} else {
			$(userListElement).addClass("selected").find(".inviteMsg").text("Selected");
		}
		testRoomInviteConfirm();
	});
}
function testRoomInviteConfirm(){
	if($("#roomInviteUserlist").find(".userListElement.selected").length >= 1 && $("#roomInviteUserlist").find(".userListElement.selected").length <= 20 && (!$("#roomCreateName").is(":visible") || $("#roomCreateName").val().length > 0)){
		$("#roomInviteConfirm").removeClass("disabled");
	} else {
		$("#roomInviteConfirm").addClass("disabled");
	}
}
function layRoomEdit(id){
	var listItem = appcore.list[appcore.listHash[id]];
	$("#roomEditName").val(listItem.name);
	$("#roomEditMenu").find(".avatarFile,.uploadAvatarProgress").attr("data-target", id);
}
function testRoomEditConfirm(){
	if($("#roomEditName").val().length){
		$("#roomEditConfirm").removeClass("disabled");
	} else {
		$("#roomEditConfirm").addClass("disabled");
	}
};
var lastLayTime = 0;
var layUsersTimeout = 0;
function layUsers(){
	if(lastLayTime + 1000 < new Date().getTime()){
		_layUsers();
	} else if(!layUsersTimeout){
		layUsersTimeout = setTimeout(_layUsers, 50);
	}
}
function _layUsers(){
	if(currentTab == "home")
		return;
	lastLayTime = new Date().getTime();
	layUsersTimeout = 0;
	var uidArray = appcore.list[appcore.listHash[currentTab]].users;
	var returnString = "";
	var notShownUsers = appcore.list[appcore.listHash[currentTab]].usercount;
	var showLeft = 4;
	for(var i in uidArray){
		if(showLeft > 0){
			var userItem = getUserItem(uidArray[i])
			if(userItem){
				if(userItem.uid == appcore.uid){
					returnString += (i == 0 ? "" : ", ") + escapeText(userItem.displayname);
				} else {
					returnString += (i == 0 ? "" : ", ") + '<a href="javascript:;" class="userLink dottedLink" data-uid="' + escapeText(uidArray[i]) + '">' + escapeText(userItem.displayname ? userItem.displayname : userItem.username) + '</a>';
				}
			} else {
				return String += (i == 0 ? "" : ", ") + "<small>Not found</small>";
			}
			showLeft--;
			notShownUsers--;
		}
	}
	$("#convSubtitleUsersList").html(returnString);
	if(notShownUsers){
		$("#convSubtitleUsersMore").text(notShownUsers + " more").show();
	} else {
		$("#convSubtitleUsersMore").text("More");
	}
}
function getUsersMore(){
	var listItem = appcore.list[appcore.listHash[currentTab]];

	api.emit("getUsers", {target: currentTab}); // always getUsers to get rank data
	$("#usersMorePopoverLoading").show();
	$("#usersMorePopoverContent").hide();
}
function getCallUsers(){
	layUsersMore(true);
}
function layUsersMore(call){
	var usersHTML = "";
	var usersArray = [];
	var uidArray = (call ? appcore.list[appcore.listHash[currentTab]].active.callUsers : appcore.list[appcore.listHash[currentTab]].users);
	var ranks = appcore.list[appcore.listHash[currentTab]].ranks || [];
	var myRank = appcore.list[appcore.listHash[currentTab]].myRank;
	if(call){
		usersHTML += "<b>Call Participants</b><hr />";
	}
	for(var i in uidArray){
		usersArray.push([getNameFromUID(uidArray[i]), uidArray[i]]);
	}
	usersArray.sort(function(a, b){
		return a[0] > b[0];
	});
	for(var i in usersArray){
		var userRank = 0;
		if(!call){
			if(ranks[usersArray[i][1]]){
				userRank = ranks[usersArray[i][1]];
			}
		}
		if(usersArray[i][1] != appcore.uid){
			usersHTML += '<a href="javascript:;" class="userLink userPopoverLink dottedLink" data-uid="' + escapeText(usersArray[i][1]) + '" data-rank="' + userRank + '">' + escapeText(usersArray[i][0])  + '</a> ';
			if(!call){
				if(myRank >= 4){
					usersHTML += '<a href="javascript:;" class="userRankLink" data-uid="' + escapeText(usersArray[i][1]) + '">Set</a>';
				}
				if(myRank >= 1 && (myRank == 9 || myRank > userRank)){
					usersHTML += '<a href="javascript:;" class="userKickLink" data-uid="' + escapeText(usersArray[i][1]) + '">Kick</a>';
				}
			}
			usersHTML += "<br />";
		} else {
			usersHTML += '<span data-rank="' + userRank + '">' + escapeText(usersArray[i][0]) + '</span><br />';
		}
	}
	$("#usersMorePopoverLoading").hide();
	$("#usersMorePopoverContent").html(usersHTML).show();
	
}
function userList(data){
	if(data.target == currentTab){
		layUsersMore();
	}
	if(currentTab == "meta" && lastTab == data.target){
		disableInvited(lastTab);
	}
}
function disableInvited(target){
	var theUserlist = $("#roomInviteUserlist");
	var pendingInvites = appcore.list[appcore.listHash[target]].pendingInvites || [];
	var users = appcore.list[appcore.listHash[target]].users;
	
	$(".userListElement").each(function(){
		var uid = $(this).attr("data-uid");
		if(pendingInvites.indexOf(uid) != -1){
			$(this).addClass("invited").find(".inviteMsg").text("Invited");
		} else if(users.indexOf(uid) != -1){
			$(this).addClass("invited").find(".inviteMsg").text("Joined");
		}
	});
}
function refreshTypingDisplay(){
	var listItem = appcore.list[appcore.listHash[currentTab]];
	if(listItem){
		var typingText = "";
		if(listItem.typings){
			var typingArray = [];
			var typedArray = [];
			for(var i in listItem.typings){
				var displayName;
				if(listItem.id.length == 37){
					displayName = listItem.displayname || listItem.username;
				} else {
					displayName = getUserItem(listItem.typings[i][0]).username;
				}
				if(listItem.typings[i][1] == "typing"){
					typingArray.push(displayName);
				} else {
					typedArray.push(displayName);
				}
			}
			if(typingArray.length == 1){
				typingText += typingArray[0] + " is typing...";
			} else if(typingArray.length > 1){
				typingText += typingArray.join(", ") + " is typing...";
			}
			if(typedArray.length == 1){
				typingText += typedArray[0] + " has typed.";
			} else if(typedArray.length > 1){
				typingText += typedArray.join(", ") + " has typed.";
			}
			$("#convTyping").text(typingText);
		} else {
			$("#convTyping").text("");
		}
	}
}
