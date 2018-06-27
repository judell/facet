filenames = [
    'index.html',
    'iframe.html',
    'showAnnotation.js'
]

for filename in filenames: 
    with open(filename, 'r+') as f:
        text = f.read()
        text = text.replace('http://10.0.0.9:8000/hlib.bundle.js', 'https://jonudell.info/hlib/hlib.bundle.js')
        text = text.replace('http://10.0.0.9:8000/hlib.css', 'https://jonudell.info/hlib/hlib.css')
        f.seek(0)
        f.write(text)
        

