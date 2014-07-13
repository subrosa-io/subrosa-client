(function() {
  var emoticons = [
    ':)',
    ':-)',
    ':]',
    ':-]',
    ':(',
    ':-(',
    ':[',
    ':-[',
    ':D',
    ':-D',
    ':O',
    ':-O',
    '&gt;_&lt;'
  ];

  this.markUp = function(src) {
    var msg = '';
    var which, loc, newLoc;
    
    src = ' ' + src  + ' '; // allow emotion at start/end of message to match
    
    const l = emoticons.length;
    do {
      which = null;
      loc = -1;
      for(var i=0;i<l;i++) {
        newLoc = src.indexOf(' ' + emoticons[i] + ' ');
        if (newLoc > loc) {
          which = emoticons[i];
          loc = newLoc;
        }
      }
      if (which) {
        msg += src.substring(0, loc)+' <span class="subrosa-image-emoticon" title="'+which+'"></span> ';
        src = src.substring(loc+which.length+2);
      }
    } while(which);
    return (msg + src).trim();
  };
}).call(window.SubrosaEmoticons = {});
