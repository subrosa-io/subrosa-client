(function(){
	var self = this;
	this.model = [];
	
	this.createModel = function(conv){
		if(!this.model[conv]){
			this.model[conv] = {messages: [], messagesStore: [], bufferState: "loading"};
		}
	}
	this.clearModel = function(conv){
		this.createModel(conv);
		
		this.model[conv].messages = [];
		this.model[conv].messagesStore = [];
	}
	this.deleteModel = function(conv){
		delete this.model[conv];
	}
	this.addMessage = function(conv, message){
		this.createModel(conv);
		// Always adds message to the bottom
		if(!this.model[conv])
			throw new Error("Undefined conv " + conv);
		
		var returnObj = {regenModel: false};
		// Fields added by the model
		message.edited = false; 
		
		this.model[conv].messages.push(message);
		
		// Limit max elements rendered
		if(this.model[conv].messages.length > 270){
			this.model[conv].messages = this.model[conv].messages.slice(-250);
			returnObj.regenModel = true;
		}
		
		return returnObj;
	}
	this.getMessage = function(conv, identifier){
		this.createModel(conv);
		
		if(identifier < 1000){
			if(this.model[conv].messages[identifier])
				return this.model[conv].messages[identifier];
		} else {
			for(var i = 0; i < this.model[conv].messages.length; i++){
				if(this.model[conv].messages[i].timestamp == identifier)
					return this.model[conv].messages[i];
			}
		}
			
		return false;
	}
	this.ackMessage = function(conv, clientTs, serverTs){
		if(!this.model[conv])
			throw new Error("Undefined conv " + conv);
		if(!this.model[conv].messages.length)
			return;
		for(var i = this.model[conv].messages.length-1; i >= 0; i--){
			if(this.model[conv].messages[i].timestamp == clientTs){
				this.model[conv].messages[i].timestamp = serverTs;
				return i;
			}
		}
		return -1;
	}
	
	this.replaceMessage = function(conv, user, replaceTimestamp, newMessage){
		if(!this.model[conv])
			throw new Error("Undefined conv " + conv);
		if(!this.model[conv].messages.length)
			return -1;
		for(var i = this.model[conv].messages.length-1; i >= 0; i--){
			if(this.model[conv].messages[i].timestamp == replaceTimestamp){
				if(this.model[conv].messages[i].user == user){
					this.model[conv].messages[i].edited = true;
					this.model[conv].messages[i].message = newMessage;
					return i;
				}
			}
		}
		return -1;
	}
	
	this.renderModel = function(conv){
		if(!this.model[conv])
			throw new Error("Undefined conv " + conv);
		var returnHTML = "";
		
		if(this.model[conv].bufferState == "more"){
			returnHTML += "<a id='bufferMore' href='javascript:;'><span class='fa fa-clock-o'></span>Decrypt earlier history</a>";
		} else if(this.model[conv].bufferState == "loading"){
			returnHTML += "<div id='bufferLoading'>Loading</div>";
		}
		var addedReadMarker = false;
		
		for(var i = 0; i < this.model[conv].messages.length; i++){
			if(!addedReadMarker && this.model[conv].messages[i].unread){
				addedReadMarker = true;
				if(i != 0)
					returnHTML += "<div class='readMarker'></div>";
			}
			returnHTML += this.renderElement(conv, i);
		}
		return returnHTML;
	}
	this.markRead = function(conv){
		if(!this.model[conv])
			throw new Error("Undefined conv " + conv);
		for(var i = 0; i < this.model[conv].messages.length; i++){
			this.model[conv].messages[i].unread = false;
		}
	}
	/* Possibly look into caching the HTML to save repeated renderElements */
	this.renderElement = function(conv, index, renderAux){
		if(!this.model[conv])
			throw new Error("Undefined conv " + conv);
		if(typeof renderAux == 'undefined')
			renderAux = true;
		
		if(index == "latest"){
			index = this.model[conv].messages.length-1;
		} else if(index > 1000){
			// timestamp to index
			for(var i = 0; i < this.model[conv].messages.length; i++){
				if(this.model[conv].messages[i].timestamp == index){
					index = i;
					break;
				}
			}
		}
		var prevMessage = index==0 || this.model[conv].messages[index-1];
		var message = this.model[conv].messages[index];
		
		var meClass = message.isMe ? "myMessage " : "";
		var smallClass = message.small ? "smallMessage " : "";
		var newDividerClass = "";
		var chatMessageClass = message.userShow != "*" ? "chatMessage " : "";
		var editedClass = message.edited ? "edited " : "";
		var backgroundColor = "#" + (message.bgColor || "inherit");
		var dateIndicator = "";
		
		var convMessageActions = "";
		var convMessageUser = message.userShow;
		var convMessageContent = parseChatMessage(message.message, message.userShow);
		var convMessageMeta = message.timestamp ? "<span title='" + fullTime(message.timestamp) + "'>" + friendlyTime(message.timestamp) + "</span>" : "";
		
		// Add date indicator
		if(index >= 1){
			var lastMessageTimestamp = this.model[conv].messages[index-1].timestamp;
			lastMessageDate = new Date(parseInt(lastMessageTimestamp)).getDate();
			var thisMessageDate = new Date(parseInt(message.timestamp)).getDate();
		}
		if(message.timestamp && (index == 0 || lastMessageDate != thisMessageDate)){
			var theDate = dateTime(message.timestamp);
			dateIndicator = "<div class='convMessage lapseDivider'><i class='fa fa-calendar'></i> " + theDate + "</div>";
		}
		// Hide name if last message was sent by the same user.
		if(index != 0 && prevMessage.user == message.user && dateIndicator.length == 0){
			convMessageUser = "&nbsp;";
		} else { // Otherwise, add a new divider
			newDividerClass = "newDivider ";
		}
		// Edit and cancel button if my chat message
		if(message.isMe && message.userShow != "*"){
			convMessageActions += "<div class='messageEditButton tinyButton'>Edit</div> <div class='messageEditCancelButton tinyButton' style='display: none'>Cancel</div>";
		}
		
		return (renderAux ? dateIndicator : "") + "<div class='convMessage " + meClass + smallClass + newDividerClass + chatMessageClass + "' style='background-color: " + backgroundColor + "' data-timestamp='" + message.timestamp + "'><div class='newOrb'></div><div class='convMessageActions'>" + convMessageActions + "</div><div class='convMessageUser'>" + convMessageUser + "</div><div class='convMessageContent " + editedClass + "' style='width: " + lastMessageContentWidth + "px'>" + convMessageContent + "</div><div class='convMessageMeta'>" + convMessageMeta + "</div></div>";
	}
	this.markBufferState = function(conv, bufferState){
		if(!this.model[conv])
			throw new Error("Undefined conv " + conv);
		this.model[conv].bufferState = bufferState;
	}
	
	this.storeMessages = function(conv){
		/* When a buffer is loaded, the new messages would have to be added from the top.
		   This empties out the content of the model's messages, so the buffer messgges can be
		   added normally.
		*/
		this.createModel(conv);
		
		this.model[conv].messagesStore = this.model[conv].messages.slice(); //clone
		this.model[conv].messages = [];
	}
	this.restoreMessages = function(conv){
		// Merges the stored messages after the current model's messages
		if(!this.model[conv])
			throw new Error("Undefined conv " + conv);
			
		this.model[conv].messages = this.model[conv].messages.concat(this.model[conv].messagesStore);
		this.model[conv].messagesStore = [];
	}
}).call(window.ConvModel = {});
