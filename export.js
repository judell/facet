var count = 0;
var output = '';

function show_thread(fn, annos, ids, reverse_chron_urls, output) {
    count = 0;
    for (var i = 0; i < reverse_chron_urls.length; i++) {
        var url = reverse_chron_urls[i][0];
        var ids_for_url = ids[url];
        for (var j = 0; j < ids_for_url.length; j++) {
            count++;
            var id = ids_for_url[j];
            output += fn(annos, id, '');
        }
    }
    return { output: output, count: count }
}

function to_markdown(rows) {
    count = 0;
    var gathered = gather(rows);
    var url_updates = gathered.url_updates;
    var ids = gathered.ids;
    var annos = gathered.annos;
    var reverse_chron_urls = organize(url_updates);
    displayed_in_thread = [];
    var result = show_thread(show_thread_md, annos, ids, reverse_chron_urls, '');
    document.getElementById('export_done').innerText = 'Done: ' + count;
    try { download(output, 'md'); }
    catch (e) { console.log('cannot download') }
}

function to_csv(rows) {
    count = 0;
    var gathered = gather(rows);
    var url_updates = gathered.url_updates;
    var ids = gathered.ids;
    var annos = gathered.annos;
    var reverse_chron_urls = organize(url_updates);
    displayed_in_thread = [];
    var result = show_thread(show_thread_csv, annos, ids, reverse_chron_urls, '');
    var output = result.output;
    document.getElementById('export_done').innerText = 'Done: ' + result.count;
    try { download(output, 'csv'); }
    catch (e) { console.log('cannot download') }
}

function to_text(rows) {
    count = 0;
    var gathered = gather(rows);
    var url_updates = gathered.url_updates;
    var ids = gathered.ids;
    var annos = gathered.annos;
    var reverse_chron_urls = organize(url_updates);
    displayed_in_thread = [];
    var result = show_thread(show_thread_text, annos, ids, reverse_chron_urls, '');
    var output = result.output;
    document.getElementById('export_done').innerText = 'Done: ' + result.count;
    try { download(output, 'txt'); }
    catch (e) { console.log('cannot download') }
}

function show_thread_text(annos, id, output) {
    var anno = annos[id];
    output += 'id: ' + anno.id + '\n';
    output += 'user: ' + anno.user + '\n';
    output += 'group: ' + anno.group + '\n';
    output += 'quote: ' + anno.quote + '\n';
    output += 'text: ' + anno.text + '\n';
    output += 'tags: ' + anno.tags + '\n\n';
    displayed_in_thread.push(id);
    return output;
}

function show_thread_csv(annos, id, output) {
    var anno = annos[id];
    csv_row = [anno.updated, anno.url, anno.user, anno.id, anno.group, anno.tags.join(', '), anno.quote, anno.text];
    csv_row = csv_row.map(function (item) {
        item = '"' + item.replace(/"/g, '\"\"') + '"';
        item = item.replace(/\r?\n|\r/g, ' ');
        return item;
    });
    output += csv_row.join(',') + '\n';
    return output;
}

function show_thread_md(annos, id, level) {
    var anno = annos[id];
    var dt = new Date(anno.updated);
    var dt_str = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString();
    output += '## ' + anno.user + ', ' + dt_str + '\n\n';
    if (anno.tags && anno.tags.length) {
        tags = anno.tags.join(', ');
        output += '### ' + tags + '\n\n';
    }
    output += anno.text + '\n\n';
}

