# The TypeScript compiler converts index.ts and iframe.ts to index.js and iframe.js

rm index.js
rm iframe.js

tsc

# The TypeScript files begin with this import:

  # import * as hlib from '../../hlib/hlib'

# That makes hlib, now written in TypeScript, available to the editor.

# But apps that use hlib are simple-minded and just want to include it with a script tag.

# So this step transforms the tsc outputs, inserting comments before the import statement

python comment-out-imports.py

# For local testing, three files need reference adjustment:
#   index.html
#   iframe.html
# 
# These are the options:
#   dev: http://10.0.0.9:8000/hlib.bundle.js
#   prd: https://jonudell.info/hlib/hlib.bundle.js

if [[ $1 = "dev" ]]; then
  python use-debug-lib.py
else
  python use-production-lib.py
fi

read -rsp $'Press enter to continue...\n'
