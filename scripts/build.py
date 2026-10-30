from pathlib import Path
root = Path(__file__).resolve().parent.parent
source = (root / 'src/bookmarklet.js').read_text()
page = root / 'docs/index.html'
html = page.read_text()
marker = '<script type="text/plain" id="source">\n'
start = html.index(marker) + len(marker)
end = html.index('</script>', start)
page.write_text(html[:start] + source + '\n' + html[end:])
(root / 'docs/b.js').write_text(''.join(c if ord(c) < 128 else '\\u%04x' % ord(c) for c in source))
