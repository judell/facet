filenames = [
    'index.html',
    'iframe.html',
]

for filename in filenames: 
    with open(filename, 'r+') as f:
        text = f.read()
        text = text.replace('https://jonudell.info/hlib/hlib2.bundle.js', 'http://localhost:8000/hlib2.bundle.js')
        text = text.replace('https://jonudell.info/hlib/hlib.css', 'http://localhost:8000/hlib.css')        
        f.seek(0)
        f.write(text)
        f.truncate()
        

