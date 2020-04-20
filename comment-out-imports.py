filenames = [
    'index.js',
    'iframe.js',
]

for filename in filenames: 
    with open(filename, 'r+') as f:
        text = f.read()
        text = text.replace('import *','// import *')
        f.seek(0)
        f.write(text)
        f.truncate()