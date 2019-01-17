filenames = [
    'index.html',
    'iframe.html',
]

for filename in filenames: 
    with open(filename, 'r+') as f:
        text = f.read()
        text = text.replace('https://jonudell.info/hlib/hlib.bundle.js', 'http://10.0.0.9:8000/hlib.bundle.js')
        f.seek(0)
        f.write(text)
        f.truncate()
        

