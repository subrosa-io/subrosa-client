var keepPos;
var lastTrigger;
jQuery.fn.clearable = function(){
	function tog(v){return v?'addClass':'removeClass';} 
	$(this).addClass("clearable");
	$(this).on('input', function(){
		$(this)[tog(this.value)]('x');
	})
	$(this).mousemove(function(e){
		if($(this).hasClass("x")){
			$(this)[tog(this.offsetWidth-18 < e.clientX-this.getBoundingClientRect().left)]('onX');
		}
	})
	$(this).click(function(){
		if($(this).hasClass("onX")){
			$(this).removeClass('x onX').val('');
			$(this).trigger("keyup");
		}
	});
};
jQuery.fn.popover = function(obj){
	var triggerElement = $(this);
	var popover = obj;
	$("body").unbind("click.dismissPopover");
	keepPos = function(){
		if(triggerElement.is(":hidden"))
			return;
		if(popover.hasClass("popoverBottom")){
			var top = triggerElement.offset().top - triggerElement.outerHeight() - popover.outerHeight() - 32;
		} else if(popover.hasClass("popoverRight") || popover.hasClass("popoverLeft")){
			var top = triggerElement.position().top - popover.outerHeight()/2 + triggerElement.outerHeight()/2;
		} else {
			var top = triggerElement.position().top + 8 + triggerElement.outerHeight();
		}
		
		if(popover.hasClass("popoverRight")){
			var left = triggerElement.offset().left + triggerElement.outerWidth() + 8;
		} else {
			var left = triggerElement.offset().left + (triggerElement.width()/2) - (popover.outerWidth()/2);
		}
		var leftCorrection = 0;
		var topCorrection = 0;
		if($(window).width()-left-popover.outerWidth() < 20){
			leftCorrection = 20 - ($(window).width()-left-popover.outerWidth());
		}
		if(top < 10){
			topCorrection -= -10 - top;
		}
		left -= leftCorrection;
		top -= topCorrection;
		
		popover.css("top", top);
		popover.css("left", left);
		if(popover.hasClass("popoverBottom")){
			// nothing
		} else if(popover.hasClass("popoverRight")){
			popover.find(".popoverCaret").css("top", popover.outerHeight()/2 - 8 + topCorrection);
		} else {
			var caretTop = top-16;
			popover.find(".popoverCaret").css("top", caretTop-top);
		}
		if(!popover.hasClass("popoverRight")){
			var caretLeft = triggerElement.offset().left + (triggerElement.width()/2) - left;
			popover.find(".popoverCaret").css("left", caretLeft);
		}
	}
	
	$("body").on("mousedown.dismissPopover", function(event){
		if($(event.target).parents(".popover").length == 0 && !(($(event.target).is(triggerElement)) || $(triggerElement).children().is(event.target))){
			$("div[data-popover='true']").fadeOut().attr("data-popover", "");
			if(lastTrigger)
				lastTrigger.removeClass("active");
			keepPos = null;
			$("body").unbind("mousedown.dismissPopover");
		} else {
			if(keepPos) keepPos();
		}
	});
	
	if(popover.attr("data-popover")){
		popover.fadeOut();
		triggerElement.removeClass("active");
		popover.attr("data-popover", "");
		keepPos = null;
	} else {
		$("div[data-popover='true']").fadeOut().attr("data-popover", "");
		if(lastTrigger)
			lastTrigger.removeClass("active");
		popover.finish().fadeIn();
		keepPos();
		triggerElement.addClass("active");
		popover.attr("data-popover", "true");
	}
	lastTrigger = triggerElement;
};
var activeModal;
$(document).ready(function(){
	$("#overlay,#modalClose").click(function(){
		(activeModal && $.modal('', 'hide'));
	});
	$("#modal").draggable();
});
function keepPosModals(){
	if(activeModal){
		var left = window.innerWidth/2 - activeModal.outerWidth()/2;
		if(window.innerWidth < 400)
			left = 0;
		var top = window.innerHeight/2 - activeModal.outerHeight()/2;
		activeModal.css({left: left+"px", top: top+"px"});
	}
}
jQuery.fn.moveCaretToEnd = function(){
	var el = $(this)[0];
    if (typeof el.selectionStart == "number") {
        el.selectionStart = el.selectionEnd = el.value.length;
    } else if (typeof el.createTextRange != "undefined") {
        el.focus();
        var range = el.createTextRange();
        range.collapse(false);
        range.select();
    }
}
jQuery.fn.draggable = function(){
	var dragging = false;
	var lastPos = [0,0];
	$(this).mousedown(function(event){
		if(event.target.tagName == "SELECT" || event.target.tagName == "P" || event.target.tagName == "SPAN" || event.target.tagName == "PRE")
			return;
		if(event.which===1){
			dragging = true;
			lastPos = [event.pageX, event.pageY];
		}
		var element = $(this)[0];
		$("body").on("mousemove.videoPanelDrag", function(event){
			var diffX = event.pageX - lastPos[0];
			var diffY = event.pageY - lastPos[1];
			var curX = parseInt(element.style.left.split("px")[0]);
			var curY = parseInt(element.style.top.split("px")[0]);
			element.style.left = (curX+diffX) + "px";
			element.style.top = (curY+diffY) + "px";
			lastPos = [event.pageX, event.pageY];	
		});
	});
	$(this).mouseup(function(){
		dragging = false;
		$("body").unbind("mousemove.videoPanelDrag");
	});
}
jQuery.modal = function(ref, state){
	var thisModal = $("#modal");
	if(!$(thisModal).is(":visible") && (!state || state == 'show')){
		activeModal = $(thisModal);
		thisModal.find("div[data-ref]").hide();
		thisModal.find("div[data-ref='" + ref + "']").show();
		$(thisModal).fadeIn(425);
		$("#overlay").css({"opacity": 0.5, "z-index": 10000});
		keepPosModals();
	} else if($(thisModal).is(":visible") && (!state || state == 'hide')){
		$(thisModal).fadeOut(425, function(){
			$("#overlay").css("z-index", -100);
		});
		$("#overlay").css("opacity", 0);
	}
}
jQuery.fn.shake = function(intShakes, intDistance, intDuration) {
	if(!intShakes)
		intShakes = 2; intDistance = 10; intDuration = 400;
    this.each(function() {
        $(this).css("position","relative"); 
        for (var x=1; x<=intShakes; x++) {
        $(this).animate({left:(intDistance*-1)}, (((intDuration/intShakes)/4)))
    .animate({left:intDistance}, ((intDuration/intShakes)/2))
    .animate({left:0}, (((intDuration/intShakes)/4)));
    }
  });
return this;
};
var baseFaviconImage = new Image();
baseFaviconImage.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAB5UlEQVQ4jY2SvWuTURTGf+ckqdUEk1pbKGp50W4W2sYEQQeD4tA6GP+DdKkZBZ0duoqQMRbBzO0SwdEhnRSsSQqKIn68dFEsocSPRmNzr0PyviZpSz3wwP3gOc+5z3OFvprOv7iuSFrA6T634BpssZpNPu4+F28xky9PKSaHkOpv2lOWkkFvVbLxdb/BuQdrUWupirRVr5w8jHM0iBMJYKzlVa3JZqNF6XOz3cPiijD98maiHuz0LYjghEPK3fPHmRwewBjjY/JYCGMMydEm99Z/0BEqADdkZql8Sa0pAdxJjnB1PNxD7sfyhwYrHxsAGNGUijEZgIsnwsyejqKq+0JEuDZ+iJFBbRtoTEYR0gCzZ2IHklWVyECAs0NBL4J0UCAGEB+LoOqH0mu8taiqvx89EvAijHkmEh1sG9VP9JS7S+SfkFqLC/B+6/eeI+8F93vLj1NFqAIsv6n9F3m7BZ++7XQmoapGNOf9qIPIqsrD13W+NlpejDmtLMRX5yaGi7cvnEJEdj3FV96xLD7f5OnGtvf8YmUhvhoEWLzsuBv1X+79Z1+cJ+9qjEVCzE0MYa31sfJ2i59/OiZbSggZb3K/4vm1R9K52K+spVDOJub9FLovy9nEfMvaNFDczaRkRFPdZIC/EibJIIaTP3UAAAAASUVORK5CYII=";

setTimeout(function(){
	setFaviconBadge(0); // reset favicon on page load
}, 1); // Firefox workaround

function canvasLoadImage(context, src){
	var imageObj = new Image();
	imageObj.onload = function() {
	  context.drawImage(this, 0, 0);
	}
	imageObj.src = src;
}
function setFaviconBadge(badgeNumber){
	var faviconCanvas = document.createElement('canvas');
	faviconCanvas.width = 16;
	faviconCanvas.height = 16;
	var ctx = faviconCanvas.getContext('2d');
	ctx.drawImage(baseFaviconImage, 0, 0);
	
	// ASCII charCodes 90 -> 121 = 0 to 31 (5 bit, bit=1 means paint)
	var numberMasks = ['', '^`_^^^y', 'hkjf\\[y', 'hkjfjkh', 'kkkxjjj', 'y[[ijji', 'hk[ikkh', 'yjjb^^^', 'hkkhkkh', 'hkkxjjj', 'Z^^y^^Z'];
	
	if(badgeNumber != 0){
		ctx.fillStyle = '#FF955A';
		ctx.fillRect(9,7,7,9);
		
		ctx.fillStyle = '#FFFFFF';
		
		var numberMask = numberMasks[Math.min(badgeNumber, 10)];
		for(var i = 0; i < 7; i++){
			var currentMask = numberMask.charCodeAt(i)-90;
			if(currentMask & 1) ctx.fillRect(10,8+i,1,1);
			if(currentMask & 2) ctx.fillRect(11,8+i,1,1);
			if(currentMask & 4) ctx.fillRect(12,8+i,1,1);
			if(currentMask & 8) ctx.fillRect(13,8+i,1,1);
			if(currentMask & 16) ctx.fillRect(14,8+i,1,1);
		}
	}
	var imgDataUrl = faviconCanvas.toDataURL();
	$('#favicon').remove();
	var newFavicon = document.createElement('link');
	newFavicon.setAttribute('id', 'favicon');
	newFavicon.setAttribute('rel', 'icon');
	newFavicon.setAttribute('type', 'image/png');
	newFavicon.setAttribute('href', imgDataUrl);
	document.head.appendChild(newFavicon);
}
var titleAlertInterval = -1;
var originalTitle = "";
function startTitleAlert(title){
	originalTitle = title;
	clearInterval(titleAlertInterval);
	titleAlertInterval = setInterval(function(){
		if(document.title == originalTitle){
			document.title = "** " + originalTitle;
		} else {
			document.title = originalTitle;
		}
	}, 700);
}
function stopTitleAlert(){
	clearInterval(titleAlertInterval);
	document.title = originalTitle;
}
