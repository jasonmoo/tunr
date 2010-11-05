Array.prototype.average = function() {
  var s = 0;
  for (var i=0;i<this.length;i++) s += this[i];
  return s/this.length;
};

_tunr = { 
  time: null,
  accuracy: null,
  scores:[],
  add_score: function(score) { 
    this.scores.push(score); 
    if (this.scores.length === 3) {
      stopwatch.stop();
      var acc = 100-Math.round(this.scores.average()*10)*.1;
      _tunr.time = stopwatch.time;
      _tunr.accuracy = acc;
      $('#stopwatch, #steps').fadeOut('slow');
      $('#report_score')
        .find('#time').text(stopwatch.toString()).end()
        .find('#accuracy').text(acc+'%').end()
        .find('#post').text('I played #tunr in '+stopwatch.toString()+' with '+acc+'% accuracy. http://is.gd/fYgKn');
      $('#report_score_wrapper').slideDown(1000,function() {
        var top = $(this).offset()['top'];
        $('body').animate({scrollTop:top},1000,function() {
          $('#report_score').fadeIn(1200);
        });
      });
    }
  }
};

function Stopwatch(readout) {
  this.readout = $(readout);
  this.time = 0;
  this.active = false;
  this.interval = null;
}
$.extend(Stopwatch.prototype,{
  start: function() {
    if (this.active) return;
    var self = this;
    this.active = true;
    self.update_clock();
    self.interval = setInterval(function() {
      self.time++;
      self.update_clock();
    },1000);
  },
  stop: function() {
    this.active = false;
    clearInterval(this.interval);
  },
  reset: function() {
    this.time = 0;
    this.update_clock();
  },
  update_clock: function() {
    this.readout.text(this.toString());
  },
  toString: function() {
    var m=~~(this.time/60), s=this.time%60;
    s = s < 10 ? "0"+s : s;
    return m+':'+s;
  }
});

stopwatch = new Stopwatch('#stopwatch div');

$('#facebook, #twitter').click(function(e) {
  var network = $(this).attr('id');
  window.open('http://tunr.jasonmooberry.com:3000/'+network+'?time='+_tunr.time+'&accuracy='+_tunr.accuracy,'auth_window','width=1000,height=650,scrollbars=0,menubar=0,resizable=0,toolbar=0');
  $(window).unbind('.'+network).bind('success.'+network,function(ee) {
    $(e.target)
      .unbind()
      .replaceWith('<div id="'+network+'_done">Done!</div>');
    if ($('#post_buttons div[id$=_done]').length === 2) {
      
    }
  });
});

// start stopwatch on first mousedown 
$('#mybox').bind('mousedown.stopwatch',function() {
  $('#stopwatch, #steps').fadeIn('slow',function() { stopwatch.start(); });
  $(this).unbind('.stopwatch');
});
// prevent selection of anything in the sections
$('#sineblocks, #threeblocks, #colorblocks').mousedown(function(e) {e.preventDefault();});


function sinebox(box) {
  box.style.top = (Math.sin((+new Date/32)*.1)*80+160)+'px';
  setTimeout(function() { sinebox(box); },10);
}
sinebox($('#sinebox')[0]);
setTimeout(function() {
  $('#sineblocks div').fadeIn(1200);
	$('#steps div:nth-child(1)').css('background','green');
},1000);
  
$('#mybox').mousedown(function(e) {
  e.preventDefault();
  $('#sineblocks').css('cursor','url(cur_updown.png), move');
  var history = [],
    section_top = $('#sineblocks').offset()['top']+20,
    section_height = $('#sineblocks').height()-$(e.target).height()-20,
    sine_box = $('#sinebox');
  $(document).bind({
    'mousemove.mybox': function(ee) {
      var next_location = ee.pageY-section_top;
      // min/max to ensure next_location is within the sandbox
      next_location = Math.min(Math.max(next_location,20),section_height);
      e.target.style.top = next_location+'px';
      
      // calculate similarity by averaging movement history differences between boxes
      history.push(Math.abs(next_location-parseInt(sine_box[0].style.top.match(/^-?\d+/)[0],10)));
      if (history.length > 200) {
        history = history.slice(-200);
        var avg = history.average();
        if (avg < 12) {
          _tunr.add_score(avg);
          $('#sineblocks').css('cursor','inherit');
          $(document).unbind('.mybox');
          $('#mybox').unbind();
          sinebox($('#mybox')[0]);
          $('#threeblocks').triggerHandler('start');
        }
      }
    },
    'mouseup.mybox': function() {
      $('#sineblocks').css('cursor','inherit');
      $(document).unbind('.mybox');
    }
  });
});

function push_down(bar) {
  var existing_element = bar.find('div:last'),
    height = existing_element.height(),
    margin = parseInt(existing_element.css('margin-top').match(/^-?\d+/)[0],10);
  if (height === 0) {  // hidden elements have no height
    return setTimeout(function() { push_down(bar); },30);
  }
  bar.prepend(bar.find('div:last').detach().css({height:0,margin:0}));
  var new_element = bar.find('div:first');
    
  (function expand_ball() {
    setTimeout(function() {
      var top = parseInt(new_element.css('margin-top').match(/^-?\d+/)[0],10);
      if (new_element.height() < height) {
        new_element.height(new_element.height()+1);
        return expand_ball();
      }
      else if (top < margin) {
        new_element.css('margin-top',top+1);
        if (top+1 == margin) {
          // don't wait the 30ms to restart
          return push_down(bar);
        }
        return expand_ball();
      }
      push_down(bar);
    },30);    
  })();
}

function shrink_up(bar) {
  if (bar.find('div:last').height() === 0) {  // hidden elements have no height
    return setTimeout(function() { shrink_up(bar); },30);
  }
  bar.find('div:first').remove();
  bar.append(bar.find('div:first').clone());
  var new_element = bar.find('div:first-child');
    
  (function shrink_ball() {
    setTimeout(function() {
      var top = parseInt(new_element.css('margin-top').match(/^-?\d+/)[0],10);
      if (top > 0) {
        new_element.css('margin-top',top-1);
        return shrink_ball();
      } else if (new_element.height() > 0) {
        new_element.height(new_element.height()-1);
        if (new_element.height() == 0) {
          // don't wait the 30ms to restart
          return shrink_up(bar);
        }
        return shrink_ball();
      }
      shrink_up(bar);
    },30);    
  })();
}

function block_mousedown(e) { 
  e.preventDefault();
  $('#threeblocks').css('cursor','url(cur_up.png), move');
  var history = [],
    block_offset = $(this).offset(),
    container_offset = $('#threeblocks').offset(),
    y_offset = e.pageY-block_offset['top']+container_offset['top'],
    pacer = $('#up_bar div:last'),
    pacer_diff = pacer.position()['top']-$(this).position()['top']
    line_top = $('#line').position()['top'];
  $(this).addClass('pushing').bind({
    'mousemove.blocks': function(ee) {
      ee.preventDefault();
      $(this).addClass('inair');
      if ($('div.inair').length === 3 && $('#threeblocks').data('win') === false) {
        $('#threeblocks').data('win',true);
        $('div.inair:not(.pushing)').each(function() {
          play_block($(this));
        });
      }
      var next_location = ee.pageY-y_offset;
      
      // min/max to ensure next_location is within the sandbox
      next_location = Math.min(Math.max(next_location,20),300);
      e.target.style.top = next_location+'px';
      
      // calculate similarity by averaging movement history differences between boxes
      history.push(Math.abs(next_location+pacer_diff-pacer.position()['top']));
      if (history.length > 20) {
        var avg = history.average();
        if (avg > 20) {
          reset_blocks(true);
        } 
      }
    },
    'mouseup.blocks': function(ee) {
      ee.preventDefault();
      $('#threeblocks').css('cursor','inherit');
      var block = $(e.target);
      block.removeClass('pushing');
      if (block.position()['top']+block.height() > line_top) {
        return reset_blocks(true);
      }
      if ($('#threeblocks').data('win')) {
        _tunr.add_score(history.average());
        play_block(block);
        return $('#colorblocks').triggerHandler('start');
      }
      block.unbind('.blocks');
      (function send_it_down() {
        block[0]._tunr.timeout = setTimeout(function() {
          var top = block.position()['top'];
          if (top < 300) {
            block.css('top',top+1);
            return send_it_down();
          }
          block.removeClass('inair').bind('mousedown.blocks',block_mousedown);
        },30);
      })();
    },
    'mouseout.blocks': function(ee) {
      ee.preventDefault();
      $('#threeblocks').css('cursor','inherit');
      reset_blocks(true);
    }
  });
}
    
function play_block(block) {
  block.unbind('.blocks').addClass('play');
  clearTimeout(block[0]._tunr.timeout);
  (function send_it_down() {
    block[0]._tunr.timeout = setTimeout(function() {
      var top = block.position()['top'];
      if (top < 300) {
        block.css('top',top+1);
        return send_it_down();
      }
      (function send_it_up() {
        block[0]._tunr.timeout = setTimeout(function() {
          var top = block.position()['top'];
          if (top > 20) {
            block.css('top',top-1);
            return send_it_up();
          }
          send_it_down();
        },30);
      })();
    },30);
  })();
}

function reset_blocks(sink) {
  sink = sink || false;
  $('#blocks div')
    .unbind('.blocks')
    .removeClass('inair pushing play')
    .each(function(i,element) {
      element._tunr = element._tunr || { timeout: null };
    });
  $('#threeblocks').data('win',false).css('cursor','inherit');
  if (sink) {
    $('#blocks div').each(function(i,element) {
      clearTimeout(element._tunr.timeout);
    }).animate({top:300},300,function() {
      $(this).bind('mousedown.blocks',block_mousedown);
    });
  } else {
    $('#blocks div').bind('mousedown.blocks',block_mousedown);
  }
}

$('#threeblocks').bind('start',function(e) {
  $('#steps div:nth-child(2)').css('background','green');
  $('#threeblocks_wrapper').slideDown(1000,function() {
    var top = $(this).offset()['top'];
    $('body').animate({scrollTop:top},1000,function() {
      push_down($('#down_bar'));
      shrink_up($('#up_bar'));
      reset_blocks();
      $(e.target).fadeIn(1200);
    });
  });
});


function circle() {
  var t = +new Date/700;
  return {
    x: 34*Math.cos(t),
    y: 34*Math.sin(t)
  };
}
function color_spin(img) {
  var coords = circle();
  img.style.top = coords['y']-100+'px';
  img.style.left = coords['x']-100+'px';
  setTimeout(function() { color_spin(img); },10); 
}
$('#colorblocks').bind('start',function(e) { 
  $('#steps div:nth-child(3)').css('background','green');
  $('#colorblocks_wrapper').slideDown(1000,function() {
    var top = $(this).offset()['top'];
    $('body').animate({scrollTop:top},1000,function() {
      $(e.target).fadeIn(1200);
    });
  });
  color_spin($('#color_box img')[0]); 
});

$('#my_color_box img').mousedown(function(e) {
  e.preventDefault();
  var history = [],
    img_offset = $(this).offset(),
    container_offset = $(this).parent().offset(),
    x_offset = e.pageX-img_offset['left']+container_offset['left'],
    y_offset = e.pageY-img_offset['top']+container_offset['top'],
    pace_img = $('#color_box img')[0];
    
  $(document).bind({
    'mousemove.mycolorbox': function(ee) {
      ee.preventDefault();
      var next_x = Math.max(Math.min(ee.pageX-x_offset,60),-260);
      var next_y = Math.max(Math.min(ee.pageY-y_offset,60),-260);
                 
      e.target.style.left = next_x+'px';
      e.target.style.top = next_y+'px';
      
      // calculate similarity by averaging movement history differences between boxes
      var distance = Math.abs(next_x-parseInt(pace_img.style.top.match(/^-?\d+/)[0],10)) + Math.abs(next_y-parseInt(pace_img.style.left.match(/^-?\d+/)[0],10));
      history.push(distance);
      if (history.length > 300) {
        history = history.slice(-300);
        var avg = history.average();
        if (avg < 56) {
          _tunr.add_score(avg/2); // grade on a curve
          $(document).unbind('.mycolorbox');
          $('#my_color_box img').unbind();
          color_spin($('#my_color_box img')[0]);
        } 
      }
    },
    'mouseup.mycolorbox': function(ee) {
      ee.preventDefault();
      $(document).unbind('.mycolorbox');
    }
  });
});
