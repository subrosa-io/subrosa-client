(function() {
  var emoticons = [
    ':)',
    ':-)',
    ':]',
    ':-]',
    ':D',
    ':-D'
  ];

  this.markUp = function(src) {
    var msg = '';
    var which, loc, newLoc;
    const l = emoticons.length;
    do {
      which = null;
      loc = -1;
      for(var i=0;i<l;i++) {
        newLoc = src.indexOf(emoticons[i]);
        if (newLoc > loc) {
          which = emoticons[i];
          loc = newLoc;
        }
      }
      if (which) {
        msg += src.substring(0, loc)+'<span class="subrosa-image-emoticon" title="'+which+'"></span>';
        src = src.substring(loc+which.length);
      }
    } while(which);
    return msg;
  };
}).call(window.SubrosaEmoticons = {});
