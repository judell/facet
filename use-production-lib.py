filenames = [
    'index.html',
    'iframe.html',
]

for filename in filenames: 
    with open(filename, 'r+') as f:
        text = f.read()
        text = text.replace('http://localhost:8000/hlib2.bundle.js', 'https://jonudell.info/hlib/hlib2.bundle.js')
        text = text.replace('http://localhost:8000/hlib.css', 'https://jonudell.info/hlib/hlib.css')
        f.seek(0)
        f.write(text)
        

