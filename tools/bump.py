#!/usr/bin/env python3
"""
Bump the build number.

GitHub Pages lets browsers cache js and css hard, so a deploy that keeps the
same URLs can leave people staring at the old game. Every local asset in
index.html carries a ?v= stamp; this bumps all of them, and the inline
window.BUILD_V that the sfx loader and the menu read.

    python3 tools/bump.py          # 6 -> 7
    python3 tools/bump.py 12       # set it to 12
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, 'index.html')

html = open(INDEX).read()
current = int(re.search(r'window\.BUILD_V = "(\d+)"', html).group(1))
nxt = int(sys.argv[1]) if len(sys.argv) > 1 else current + 1

html = re.sub(r'window\.BUILD_V = "\d+"', 'window.BUILD_V = "%d"' % nxt, html)
html = re.sub(r'\?v=\d+', '?v=%d' % nxt, html)
open(INDEX, 'w').write(html)
print('build %d -> %d' % (current, nxt))
