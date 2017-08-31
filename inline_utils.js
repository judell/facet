var server = 'https://hyp.jonudell.info/';

var orderedReplies = [];

function loadAnnotation(id) {
    var rows = [];
    var replies = [];
    $.ajax({
        url: server + 'api/annotations/' + id,
        type: "GET",
        beforeSend: function (xhr) {
            var token = localStorage.getItem('h_token');
            if (token != '') {
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
            }
        },
        success: function (data) {
            rows.push(data);
            $.ajax({
              url: server + 'api/search?references=' + id,
              type: "GET",
              beforeSend: function (xhr) {
                  var token = localStorage.getItem('h_token');
                  if (token != '') {
                      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                      xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
                  }
              },
              success: function (data) {
                rows = rows.concat(data.rows);
                replies = replies.concat(data.rows);
                orderReplies(rows[0].id, replies);
                var all = [rows[0]].concat(orderedReplies);
                all.forEach(function(reply) {
                    var level = 0;
                    if ( reply.references ) {
                      level = reply.references.length;
                    }
                    showAnnotation('widget', reply, reply.id, level);
                });
              }
            });
        }
    });
}


function showAnnotation(elt_id, anno, id, level) {
    var margin = level * 20;
    var dt = new Date(anno.updated);
    var dt_str = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString();
    var converter = new Showdown.converter();
    var text = anno.text == null ? '' : anno.text;
    var html = converter.makeHtml(text);
    var options = {
        whiteList: {
            a: ['href', 'title'],
            img: ['alt', 'src'],
            p: [],
            blockquote: [],
            span: ['title', 'class']
        },
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script']
    };
    html = filterXSS(html, options);
    var tags = '';
    if (anno.tags.length)
        tags = makeTags(anno.tags);
    var user = anno.user.replace('acct:','');
    var quote = filterXSS(anno.quote, {});
    var template = '<div style="margin-left:_MARGIN_px; margin-top:20px">' +
                    '<span class="user"><a target="_user" href="facet.html?facet=user&search=' + user + '">' + user + '</a></span>' + ' ' +
                    '<span class="timestamp">' + dt_str + '</span>' +
                    '<div class="annotation-quote">' + quote + '</div>' +
                    tags +
                    '<div>' + html + '</div>' +
                    '</div>';
    var elt = document.getElementById(elt_id);
    elt.innerHTML += template.replace('_MARGIN_', margin);
}



function gup(name, str) {
    if (! str) 
        str = window.location.href;
    else
        str = '?' + str;
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(str);
    if (results == null)
        return "";
    else
        return results[1];
}

function getLocalStorageItem(key) {
    var value = localStorage.getItem(key);
    if (value == "null") value = "";
    return value;
}

function makeTags(tags) {
  var tag_str = '<div class="tags">' +
      '<span class="tag-item">' +
      tags.join('</span><span class="tag-item">') +
      '</span></div>';
  return tag_str;
}


function orderReplies(id, replies) {
  immediateReplies = replies.filter(function(x) {
      return x.references.slice(-1) == id;
  });
  immediateReplies.forEach(function(reply) {
      orderedReplies.push(reply);
      orderReplies(reply.id, replies);
  });
}

