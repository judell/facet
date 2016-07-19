var user = '';
var url = '';
var token = '';
var tag = '';
var group = '';
var any = '';
var query = 'https://hypothes.is/api/search?limit=200&offset=__OFFSET__&_separate_replies=true';
var _query;
var displayed_in_thread = [];

function process(rows, replies) {
    var gathered = gather(rows);

    if ($('#format_html').is(":checked")) {
        process_urls_html('exported_html', gathered, replies);
        var html = '<html><head><meta charset="utf-8"><title>Hypothesis activity for the query group=' + group + '8gk9i7VV</title>';
        html += '<style>body { margin:.75in; font-family:verdana; word-break:break-word; } .url { font-family:italic; margin-bottom:6px; color:gray } a.toggle, a.visit { color: #151414 } img { width: 90%; margin: 8px } .user { font-weight:bold } .timestamp { font-style:italic; font-size:smaller } .annotation { display:none; border:thin solid lightgray;padding:10px;margin:10px; } .annotations { display:none; } .annotation-quote { color: #777; font-style: italic;padding: 0 .615em; border-left: 3px solid #d3d3d3; margin-top:12px; margin-bottom: 12px }  .tag-item { margin: 2px; text-decoration: none; border: 1px solid #BBB3B3; border-radius: 2px; padding: 3px; color: #4B4040; background: #f9f9f9; } a { text-decoration: none; color: brown } a.toggle {font-weight: bold; } .anno-count { } span.anno-count:before { content:"+" } .tags { line-height: 2 }</style>';
        html += '</head>';
        html += '<body>';
        html += '<h1>Hypothesis activity for ' + _query.match(/&([^&]+$)/)[1] + '</h1>';
        html += document.getElementById('exported_html').innerHTML + '<script>function toggle(dom_id) {	var element = document.getElementById(dom_id);	var display = element.style[\'display\']; var annos = document.getElementById(dom_id).querySelectorAll(\'.annotation\');	if (display == \'none\' || display == \'\' ) {		element.style[\'display\'] = \'block\'; for (var i=0; i<annos.length; i++) annos[i].style.display = \'block\';	}	else {		element.style[\'display\'] = \'none\';  for (var i=0; i<annos.length; i++)  annos[i].style.display = \'none\';	} }</script></body></html>';
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

function process_urls_html(element, gathered, replies) {
    var url_updates = gathered.url_updates;
    var ids = gathered.ids;
    var titles = gathered.titles;
    var annos = gathered.annos;
    var urls = gathered.urls;
    var reverse_chron_urls = organize(url_updates);

    for (var i = 0; i < reverse_chron_urls.length; i++) {
        var url = reverse_chron_urls[i][0];
        var dom_id = '__' + i;
        var count = urls[url];
        var s_count = '<span class="anno-count">' + count.toString() + '</span>';
        var elt = $('#' + element);
        var count_html = '<span><a class="toggle" title="click to expand annotations" href=\"javascript:toggle(\'' + dom_id + '\')\">' + s_count + '</a></span>';
        elt.append('<div><a class="visit" target="overlay" title="click to visit article and see annotations as overlay" href="' + url + '">' + titles[url] + '</a>' + ' ' + count_html);
        elt.append('<div class="url">' + url + '</div>');
        elt.append('<div class="annotations" id="' + dom_id + '"/>');
        var ids_for_url = ids[url];
        for (var j = 0; j < ids_for_url.length; j++) {
            var id = ids_for_url[j];
            output = '';
            process_thread_html(annos, id, 0, replies, []);
            if (output != '')
                $('#' + dom_id).append('<blockquote class="annotation">' + output + '</blockquote>')
        }
        elt.append('</div>');
    }
}

function process_thread_html(annos, id, level, replies) {
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
        var tags = '';
        if (anno.tags.length) {
            var links = anno.tags.map(function (x) { return '<a target="_tag" href="tag.html?search=' + x.replace('#', '') + '">' + x + '</a>' });
            tags = '<div class="tags">' +
                      '<span class="tag-item">' +
                      links.join('</span><span class="tag-item">') +
                      '</span></div>';
        }
        var template = '<div style="padding:10px;margin-left:_MARGIN_px">' +
                        '<span class="user"><a target="_user" href="user.html?search=' + anno.user + '">' + anno['user'] + '</a></span>' + ' ' +
                        '<span class="timestamp">' + dt_str + '</span>' +
                        '<span style="font-size:smaller"><a title="permalink" target="_new" href="https://hyp.is/' + anno.id + '"> # </a></span>' +
                        '<div class="annotation-quote">' + anno.quote + '</div>' +
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
            process_thread_html(annos, children[i], level + 1, replies);
    }
}

function do_really_search(rows) {
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var anno = parse_annotation(row);

try {      
        show_annotation(anno);
    }
catch (e) 
    {
console.log(e.message, anno);
    }


    }
}

function wrap_search_term(s) {
    if (s) {
        var re = new RegExp( search, 'i');
        var m = s.match(re);
        if ( m ) {
            return s.replace(m[0], '<span class="search_term">' + m[0] + '</span>');
        }
        else {
            return s;
        }
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
        if ( html == 'undefined' ) {
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
    if (anno.tags.length) {
        var links = anno.tags.map(function (x) { return '<a target="_tag" href="tag.html?search=' + x.replace('#', '') + '">' + wrap_search_term(x) + '</a>' });
        tags = '<div class="tags">' +
                  '<span class="tag-item">' +
                  links.join('</span><span class="tag-item">') +
                  '</span></div>';
    }
    var template = '<div style="background-color:rgba(235, 230, 224, 0.21);padding:10px;margin-bottom:10px; margin-left:_MARGIN_px;background-color:">' +
                    '<span class="user"><a target="_user" href="user.html?search=' + anno['user'] + '">' + user + '</a></span>' + ' ' +
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


function load(offset, rows, replies) {
    var limit = 400;
    try { user = $('#user')[0].value; } catch (e) { user = ''; }
    try { token = $('#token')[0].value; } catch (e) { }
    try { tag = $('#tag')[0].value; } catch (e) { tag = ''; }
    try { group = $('#group')[0].value; } catch (e) { group = ''; }
    try { any = $('#any')[0].value; } catch (e) { any = ''; }
    try { url = $('#url')[0].value; } catch (e) { url = ''; }
    _query = query.replace('__OFFSET__', offset);
    if (tag)
        _query += '&tags=' + tag;
    if (user)
        _query += '&user=' + user;
    if (group)
        _query += '&group=' + group;
    if (any)
        _query += '&any=' + any;
    if (url)
        _query += '&uri=' + url;
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
    document.getElementById('export_ux').innerHTML = '<hr>Export results to:<p><div><input id="format_html" type="radio" name="format" value="HTML" checked="checked"> HTML<input id="format_csv" type="radio" name="format" value="CSV"> CSV<input id="format_text" type="radio" name="format" value="TEXT"> TEXT<input id="format_md" type="radio" name="format" value="MARKDOWN"> MARKDOWN</div><p><input type="button" onclick="_export()" value="export"></input></p><div id="exported_html" style="display:none"></div><div id="export_done"></div>';
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
    if ( mode == '' || mode == 'iframe' )
      panel = 'iframe';
    else
      panel = 'search';
    return panel;
}
