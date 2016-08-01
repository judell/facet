var output = '';
var token = '';
var displayed_in_thread = [];
var query = 'https://hypothes.is/api/search?limit=200&offset=__OFFSET__';

function load(offset, rows, replies) {
    var limit = 400;
    var _query = query.replace('__OFFSET__', offset);
    $.ajax({
        url: _query,
        type: "GET",
        beforeSend: function (xhr) {
            if (token != '') {
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
            }
        },
        success: function (data) {
            if (data.hasOwnProperty('rows'))     // capture annotations
                rows = rows.concat(data.rows);
            if (data.hasOwnProperty('replies')) { // also capture replies
                rows = rows.concat(data.replies);
                replies = replies.concat(data.replies);
            }
            if (data.rows.length == 0 || rows.length > limit)
                process(rows, replies);
            else
                load(offset + 200, rows, replies);
        }
    });
}

function gather(rows) {
    var urls = {};
    var ids = {};
    var titles = {};
    var url_updates = {};
    var annos = {};
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var annotation = parse_annotation(row);  // parse the annotation
        var id = annotation.id;
        annos[id] = annotation;                  // save it by id
        var url = annotation.url;             // remember these things
        url = url.replace(/\/$/, "");            // strip trailing slash
        var updated = annotation.updated;
        var title = annotation.title;
        if (!title)
            title = url;
        if (url in urls) {                     // add/update this url's info
            urls[url] += 1;
            ids[url].push(id);
            if (updated > url_updates[url])
                url_updates[url] = updated;
        }
        else {                                   // init this url's info
            urls[url] = 1;
            ids[url] = [id];
            titles[url] = title;
            url_updates[url] = updated;
        }
    }
    return { ids: ids, url_updates: url_updates, annos: annos, titles: titles, urls: urls };
}

function organize(url_updates) {
    var reverse_chron_urls = [];
    for (var url_update in url_updates)  // sort urls in reverse chron of recent update
        reverse_chron_urls.push([url_update, url_updates[url_update]]);
    reverse_chron_urls.sort(function (a, b) { return new Date(b[1]) - new Date(a[1]) });
    return reverse_chron_urls;
}

function process(rows, replies) {
    var gathered = gather(rows);

    if ($('#format_html').is(":checked")) {
        document_view('exported_html', gathered, replies);
        var html = '<html><head><meta charset="utf-8"><title>Hypothesis activity for the query ' + facet + ' = ' + search + '</title>';
        html += '<style>input { display:none} body { margin:.75in; font-family:verdana; word-break:break-word; } .url { font-family:italic; margin-bottom:6px; color:gray } a.visit { color: #151414 } img { width: 90%; margin: 8px } .user { font-weight:bold } .timestamp { font-style:italic; font-size:smaller } .thread { display:none; border:thin solid lightgray;padding:10px;margin:10px; } .annotations { display:none; } .annotation-quote { color: #777; font-style: italic;padding: 0 .615em; border-left: 3px solid #d3d3d3; margin-top:12px; margin-bottom: 12px }  .tag-item { margin: 2px; text-decoration: none; border: 1px solid #BBB3B3; border-radius: 2px; padding: 3px; color: #4B4040; background: #f9f9f9; } a { text-decoration: none; color: brown } a.toggle {font-weight: bold; } .anno-count { } span.anno-count:before { content:"+" } .tags { line-height: 2 }</style>';
        html += '</head>';
        html += '<body>';
        html += '<h1>Hypothesis activity for the query ' + facet + ' = ' + search + '</h1>';
        html += document.getElementById('exported_html').innerHTML + '<script>function toggle(dom_id) {	var element = document.getElementById(dom_id);	var display = element.style[\'display\']; var annos = document.getElementById(dom_id).querySelectorAll(\'.thread\');	if (display == \'none\' || display == \'\' ) {		element.style[\'display\'] = \'block\'; for (var i=0; i<annos.length; i++) annos[i].style.display = \'block\';	}	else {		element.style[\'display\'] = \'none\';  for (var i=0; i<annos.length; i++)  annos[i].style.display = \'none\';	} }</script></body></html>';
        download(html, 'html');
        rows = [];
    }
    else if ($('#format_csv').is(":checked")) {
        to_csv(rows);
    }
    else if ($('#format_md').is(":checked")) {
        to_markdown(rows);
    }
    else if ($('#format_text').is(":checked")) {
        to_text(rows);
    }
    else {
        console.log('?')
    }
}

function document_view(element, gathered, replies) {
    var url_updates = gathered.url_updates;
    var ids = gathered.ids;
    var titles = gathered.titles;
    var annos = gathered.annos;
    var urls = gathered.urls;
    var reverse_chron_urls = organize(url_updates);

    for (var i = 0; i < reverse_chron_urls.length; i++) {
        if ( is_exporting() ) {
            var selected_ids = get_ids();
            if ( selected_ids.length>0 && selected_ids.indexOf(i) == -1 )
                continue;
            }
        var url = reverse_chron_urls[i][0];
        var dom_id = 'a' + i;
        var count = urls[url];
        var s_count = '<span class="anno-count">' + count.toString() + '</span>';
        var elt = $('#' + element);
        var count_html = '<span><a class="toggle" title="click to expand annotations" href=\"javascript:toggle(\'' + dom_id + '\')\">' + s_count + '</a></span>';
        elt.append('<div><input checked onchange="javascript:item_checked(' + dom_id.replace('a','') + ')" class="checkbox" id="c' + i + '" type="checkbox"><a class="visit" target="overlay" title="click to visit article and see annotations as overlay" href="' + url + '">' + wrap_search_term(titles[url]) + '</a>' + ' ' + count_html);
        elt.append('<div class="url">' + wrap_search_term(url) + '</div>');
        elt.append('<div class="annotations" id="' + dom_id + '"/>');
        var ids_for_url = ids[url];
        for (var j = 0; j < ids_for_url.length; j++) {
            var id = ids_for_url[j];
            output = '';
            show_thread(annos, id, 0, replies, []);
            if (output != '')
                $('#' + dom_id).append('<blockquote class="thread">' + output + '</blockquote>')
        }
        elt.append('</div>');
    }

    all_or_none();

}

function show_thread(annos, id, level, replies) {
    if (displayed_in_thread.indexOf(id) == -1) {
        var margin = level * 20;
        var anno = annos[id];
        var dt = new Date(anno['updated']);
        var dt_str = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString();
        var converter = new Showdown.converter();
        var text = anno['text'] == null ? '' : anno['text'];
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
        html = wrap_search_term(html);
        var tags = '';
        if (anno.tags.length) 
			tags = make_tags(anno.tags);
        html = wrap_search_term(html);
        var user = anno.user;
        var quote = wrap_search_term(anno.quote);
        var template = '<div>' +
                        '<span class="user"><a target="_user" href="facet.html?facet=user&search=' + user + '">' + wrap_search_term(user) + '</a></span>' + ' ' +
                        '<span class="timestamp">' + dt_str + '</span>' +
                        '<span style="font-size:smaller"><a title="permalink" target="_new" href="https://hyp.is/' + anno.id + '"> # </a></span>' +
                        '<div class="annotation-quote">' + quote + '</div>' +
                        tags +
                        '<div>' + html + '</div>' +
                        '</div>';
        output += template.replace('_MARGIN_', margin);
        displayed_in_thread.push(id);
    }

    var children = replies.filter(function (row) {
        return row.hasOwnProperty('references') && row['references'].indexOf(id) != -1;
    });

    children = children.map(function (row) {
        return row['id'];
    });

    children.reverse();

    if (children.length) {
        for (var i = 0; i < children.length; i++)
            show_thread(annos, children[i], level + 1, replies);
    }
}

function annotation_view(rows) {
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var anno = parse_annotation(row);
        show_annotation(anno);
    }
}

function show_annotation(anno) {
    var margin = 20;
    var dt = new Date(anno.updated);
    var user = anno.user.replace('acct:','').replace('@hypothes.is','')
    user = wrap_search_term(user);
    var url = wrap_search_term(anno.url);
    var quote = '';
    if (anno.quote)
        quote = wrap_search_term(anno.quote);
    var title = wrap_search_term(anno.title);
    var dt_str = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString();
    var converter = new Showdown.converter();
    var text = wrap_search_term(anno.text);
    var html = '';
    if (text) {
        html = converter.makeHtml(text);
        html = filterXSS(html, options);
        html = wrap_search_term(html);
        if ( ! html ) {
            html = '';
        }
    }
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
    var tags = '';
    if (anno.tags.length) 
		tags = make_tags(anno.tags);
    var template = '<div class="annotation">' +
        '<span class="user"><a target="_user" href="facet.html?facet=user&search=' + anno.user + '">' + user + '</a></span>' + ' ' +
        '<span class="timestamp">' + dt_str + '</span>' +
        '<span style="font-size:smaller"><a title="permalink" target="_new" href="https://hyp.is/' + anno.id + '"> # </a></span>' +
        '<div class="uri">' + url + '</div>' +
        '<div class="title">' + title + '</div>' +
        '<div class="annotation-quote">' + quote + '</div>' +
        tags +
        '<div>' + html + '</div>' +
        '</div>';
    output += template.toString();
}

function wrap_search_term(s) {
    if ( ! s || typeof(search) == 'undefined' )
        return s;
    var re = new RegExp( search, 'i');
    var m = s.match(re);
    if ( m )
        return s.replace(m[0], '<span class="search_term">' + m[0] + '</span>');
    else 
        return s;
}

function parse_annotation(row) {
    var id = row['id'];
    var url = row['uri'];
    var updated = row['updated'].slice(0, 19);
    var group = row['group'];
    var title = url;
    var refs = row.hasOwnProperty('references') ? row['references'] : [];
    var user = row['user'].replace('acct:', '').replace('@hypothes.is', '');
    var quote = '';
    if ( // sigh...
            row.hasOwnProperty('target') &&
            row['target'].length
            ) {
        var selectors = row['target'][0]['selector'];
        if (selectors) {
            for (var i = 0; i < selectors.length; i++) {
                selector = selectors[i];
                if (selector['type'] == 'TextQuoteSelector')
                    quote = selector['exact'];
            }
        }
    }
    var text = row.hasOwnProperty('text') ? row.text : '';
    var tags = [];
    try {
        title = row.document.title;
        if ( typeof(title) == 'object' )
            title = title[0];
        refs[id] = refs;
        tags = row.tags;
    }
    catch (e) {
        console.log(e);
    }
    return {
        id: id,
        url: url,
        updated: updated,
        title: title,
        refs: refs,
        user: user,
        text: text,
        quote: quote,
        tags: tags,
        group: group
    }
}

function gup(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.href);
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

function add_css(css) {
    var head = document.getElementsByTagName('head')[0];
    var s = document.createElement('style');
    s.setAttribute('type', 'text/css');
    if (s.styleSheet) {   // IE
        s.styleSheet.cssText = css;
    } else {                // the world
        s.appendChild(document.createTextNode(css));
    }
    head.appendChild(s);
}

function toggle(dom_id) {
    var element = document.getElementById(dom_id);
    var display = element.style['display'];
    var annos = document.getElementById(dom_id).querySelectorAll('.annotation');
    if (display == 'none' || display == '') {
        element.style['display'] = 'block';
        for (var i = 0; i < annos.length; i++)
            annos[i].style.display = 'block';
    }
    else {
        element.style['display'] = 'none';
        for (var i = 0; i < annos.length; i++)
            annos[i].style.display = 'none';
    }
}

function add_export_ux() {
    document.getElementById('export_ux').innerHTML = '<hr>Export results to:<p><div><input id="format_html" type="radio" name="format" value="HTML" checked="checked"> HTML<input id="format_csv" type="radio" name="format" value="CSV"> CSV<input id="format_text" type="radio" name="format" value="TEXT"> TEXT<input id="format_md" type="radio" name="format" value="MARKDOWN"> MARKDOWN</div><p><input type="button" onclick="_select()" value="select"></input> <input type="button" onclick="_export()" value="export"></input></p><div id="exported_html" style="display:none"></div><div id="export_done"></div><p style="font-size:smaller">(Click <i>select</i> to surface checkboxes. Click <i>documents</i> or <i>annotations</i> to reset.)</p>';
}

function add_doc() {
    document.getElementById('doc').innerHTML = '<hr><p>Results are organized as follows:</p><ol><li> Annotations are grouped into threads.<li> Threads are grouped by URL.<li> URLs appear in reverse order by recency of annotation.</ol><hr><p>Source: <a href="https://github.com/judell/h_export">https://github.com/judell/h_export</a>';
}

function download(text, type) {
    var a = document.createElement('a');
    a.href = 'data:attachment/' + type + ',' + encodeURIComponent(text);
    a.target = '_blank';
    a.download = 'hypothesis.' + type;
    document.body.appendChild(a);
    a.click();
}

function get_mode() {
    var mode = gup('mode');
	if ( mode == '' || mode == 'documents' )
		return 'documents';
    else
		return 'annotations';
}

function save_ids(ids) {
  localStorage.setItem('h_export_selections', JSON.stringify(ids) );
}

function get_ids() {
    return JSON.parse(localStorage.getItem('h_export_selections'));
}

function all_or_none() {
    if ( !is_selecting) return;
    if ( is_selecting() && !is_exporting() ) {
		document.getElementById('selections').style.display = 'block';
		var choice = getRVBN('selections');
		var checkboxes = document.querySelectorAll('input[type="checkbox"]');
		var ids = [];
		if (choice == 'none') {
			for (var i = 0; i < checkboxes.length; i++) {
				checkboxes[i].checked = false;
				checkboxes[i].style.display = 'inline';
			}
		}
		else {
			for (var i = 0; i < checkboxes.length; i++) {
				checkboxes[i].style.display = 'inline';
				checkboxes[i].checked = true;
				ids.push(i);
			}
		}
		save_ids(ids);
    }
}

function item_checked(id) {
    var ids = get_ids();
    var is_saved = ids.indexOf(id) != -1;
    var checkbox = document.getElementById('c' + id);
    var is_checked = checkbox.checked;
    if ( ! is_checked && is_saved ) {
       var index = ids.indexOf(id);
       if ( index > -1 ) {
           ids.splice(index, 1);
           save_ids(ids);
           console.log('unsave ' + id);
           }
       }
    if ( is_checked && ! is_saved ) {
       ids.push(id);
       save_ids(ids);
       console.log('save ' + id);
       }
}

function getRVBN(rName) {
    var radioButtons = document.getElementsByName(rName);
    for (var i = 0; i < radioButtons.length; i++) {
        if (radioButtons[i].checked)
            return radioButtons[i].value;
    }
    return '';
}

function is_selecting() {
    return localStorage.getItem('h_is_selecting')=='true';
}

function is_exporting() {
    return localStorage.getItem('h_is_exporting')=='true';
}

function init_selections() {
    if ( gup('selections') == '' ) {
        localStorage.setItem('h_export_selections', JSON.stringify([]));
        localStorage.setItem('h_is_selecting','false');
        localStorage.setItem('h_is_exporting','false');
        }
    }

function start_selections() {
  localStorage.setItem('h_is_selecting','true');
  localStorage.setItem('h_is_exporting','false');
  }

function menu(facet) {
  var items = ['user', 'group', 'uri', 'tag', 'any'];
  var html_items = [];
  for (var i=0; i<items.length; i++) {
    if ( items[i] == facet ) {
      html_items.push('<b>' + facet + '</b>');
	  }
	else {
		
	  html_items.push('<a href="facet.html?facet=' + items[i] + '">' + items[i] + '</a>');
      }
  }
  return html_items.join('  &#8226; ');
}

function heredoc(fn) {
 var a = fn.toString();
 var b = a.slice(14, -3);
 return b;
}

var form = function(){/*
<div>
<p>
<input value="" id="facet"></input> <br><span class="small">__MSG1__</span>
</p>
<p>
<input type="password" value="" size="40" id="token"></input> <br> <span class="small">__MSG2__</span> 
</p>
<p>
<input type="button" onclick="_search('__FACET__', 'documents')" value="documents"></input>
<input type="button" onclick="_search('__FACET__', 'annotations')" value="annotations"></input>
</p>
</div>
*/};

function add_form(facet, mode) {
  var token_msg_1 = '(for private annotations, include your <a href="https://hypothes.is/profile/developer">API token</a>)';
  var token_msg_2 = '(your <a href="https://hypothes.is/profile/developer">API token</a>)';

  var s = heredoc(form);
  s = s.replace(/__FACET__/g, facet);
  s = s.replace(/__MODE__/g, mode);
  switch (facet) {
    case 'user':
	  s = s.replace('__MSG1__', '(a Hypothesis username)');
	  s = s.replace('__MSG2__', token_msg_1);
	  break;
	case 'group':
	  s = s.replace('__MSG1__', '(a Hypothesis group ID from https://hypothes.is/groups/<span style="font-weight:bold">ID</span>)');
	  s = s.replace('__MSG2__', token_msg_2);
	  break;
	case 'uri':
	  s = s.replace('__MSG1__', '(URL of an annotated document)');
	  s = s.replace('__MSG2__', token_msg_1);
	  break;
	case 'tag':
	  s = s.replace('__MSG1__', '(a Hypothesis tag)');
	  s = s.replace('__MSG2__', token_msg_1);
	  break;
	case 'any':
	  s = s.replace('__MSG1__', '(user, URL, tag. annotation quote or body)');
	  s = s.replace('__MSG2__', token_msg_1);
	  break;
	default:
	    console.log('add_form unexpected facet ' + facet);	
    }	  
  document.getElementById('form').innerHTML = s;
  var token = getLocalStorageItem('h_token');
  document.getElementById('token').value = token;
  }

function add_menu(facet) {
  document.getElementById('menu').innerHTML = menu(facet);
  }

function _search(facet, mode) {
  localStorage.setItem('h_token', document.getElementById('token').value);
  token = localStorage.getItem('h_token');
  var search = document.getElementById('facet').value;
  var href = 'facet.html?facet=' + facet + '&mode=' + mode + '&search=' + search;
  location.href = href;
}

function _export() {
  query += '&' + facet + '=' + search;
  localStorage.setItem('h_is_exporting','true');
  localStorage.setItem('h_is_selecting','false');
  load(0, [], []);
}

function _select() {
  start_selections();
  search = document.getElementById('facet').value;
  location.href = 'facet.html?facet=' + facet + '&mode=' + mode + '&search=' + search + '&selections=yes';
}

function expand_all() {
    document.getElementById('expander').style.display = 'none';
    document.getElementById('collapser').style.display = 'inline';
    var annos = document.querySelectorAll('.annotations');
    for (var i = 0; i < annos.length; i++)
        annos[i].style.display = 'block';
}

function collapse_all() {
    document.getElementById('expander').style.display = 'inline';
    document.getElementById('collapser').style.display = 'none';
    var annos = document.querySelectorAll('.annotations');
    for (var i = 0; i < annos.length; i++)
        annos[i].style.display = 'none';
}

function compare(a,b) {
  if (a.updated > b.updated)
    return -1;
  else if (a.updated < b.updated)
    return 1;
  else 
    return 0;
}

function make_tags(tags) {
  var links = tags.map(function (x) { return '<a target="_tag" href="facet.html?mode=' + mode + '&facet=tag&search=' + x.replace('#', '') + '">' + wrap_search_term(x) + '</a>' });
  var tags = '<div class="tags">' +
      '<span class="tag-item">' +
      links.join('</span><span class="tag-item">') +
      '</span></div>';
  return tags;
}

