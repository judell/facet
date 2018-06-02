# tsc creates index.js and iframe.js

tsc

# Those files contain:

  # import * as hlib from '../../hlib/hlib'

# which makes hlib, now written in TypeScript, available to the editor.

# But apps that use hlib include it with a script tag.

# So this step transforms the tsc output, index.js and iframe..js, commenting out the import

# // import * ...

python comment-out-imports.py

if [ $1 = "dev" ]; then
  python use-debug-lib.py
else
  python use-production-lib.py
fi