#!/usr/bin/env python3
"""Builds index.html: Omni (originals/omni.html) + Forge's visual programs, Nova and the visuals AI (plus/).
Run: python3 build.py   Omni's own code is never edited; the add-on only talks to window.SubliminalOmni."""
import re, pathlib
H = pathlib.Path(__file__).parent
omni = (H/'originals/omni.html').read_text()
P = lambda n: (H/'plus'/n).read_text()

def scope(css, pre='.fx'):
    out, i = [], 0
    skip = re.compile(r'^(:root|\*|html|body|h1|h2|h3|button,|:focus-visible|\.sr$|\.wrap$|img)')
    def rules(block):
        res = []
        for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', block):
            sel, body = m.group(1).strip(), m.group(2)
            sel = re.sub(r'/\*.*?\*/', '', sel, flags=re.S).strip()
            if not sel or skip.match(sel): continue
            sel = ','.join(pre + ' ' + s.strip() for s in sel.split(','))
            res.append(sel + '{' + body + '}')
        return res
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    while i < len(css):
        at = css.find('@', i)
        if at < 0: out += rules(css[i:]); break
        out += rules(css[i:at])
        j = css.find('{', at); depth, k = 1, j + 1
        while depth: depth += {'{': 1, '}': -1}.get(css[k], 0); k += 1
        head, inner = css[at:j].strip(), css[j+1:k-1]
        if head.startswith('@keyframes'): out.append(head + '{' + inner + '}')
        elif head.startswith('@media'): out.append(head + '{' + ''.join(rules(inner)) + '}')
        i = k
    return '\n'.join(out)

css = '.fx{--stage:#07060A;--card-glass:rgba(14,12,18,.86);--on-image:#FFFFFF;--r:14px}\n' + scope(P('forge-css.txt')) + '\n' + P('extra.css')
visuals = f'''<!-- VISUALS: Forge's image programs, on a schedule -->
<section class="fx" id="vView" hidden aria-label="Visual programs">
{P('visuals-inner.html')}
{P('ai-panel.html')}
</section>
'''
nova = '<div class="fx">\n' + P('nova.html') + '\n</div>\n'
js = P('head.js') + '\n' + P('visual-port.js') + '\n' + P('brain.js') + '\n' + P('tonight.js') + '\n' + P('tail.js')

s = omni
s = s.replace('<title>Subliminal Forge Omni</title>', '<title>Forge Omni Plus</title>', 1)
btn = '<button type="button" data-view="map" aria-pressed="false">Map</button>'
assert btn in s; s = s.replace(btn, btn + '<button type="button" data-view="visuals" aria-pressed="false">Visuals</button>', 1)
anchor = '<input type="file" id="audioPick"'
assert anchor in s
# the Visuals view goes inside .wrap, right after the map section
mapend = s.index('</section>', s.index('id="omap"')) + len('</section>')
s = s[:mapend] + '\n' + visuals + s[mapend:]
end = s.rindex('})();</script>') + len('})();</script>')
s = s[:end] + '\n<style id="omni-plus-css">\n' + css + '\n</style>\n' + nova + '<script id="omni-plus">\n' + js + '\n</script>' + s[end:]
(H/'index.html').write_text(s)
print('index.html', len(s), 'bytes')

# --ext DIR: a copy for a Chrome extension page (Front Stage's 🌀 Forge panel). Manifest V3 pages can't run inline scripts or
# scripts from a CDN, so each inline <script> becomes its own file and sam-js comes from vendor/. Nova's pictures come along.
import sys, shutil
if '--ext' in sys.argv:
    out = pathlib.Path(sys.argv[sys.argv.index('--ext') + 1]).resolve(); out.mkdir(parents=True, exist_ok=True)
    e, n = s, 0
    e = e.replace('<script id="sam-js" src="https://cdn.jsdelivr.net/npm/sam-js@0.3.1/dist/samjs.min.js"></script>', '<script id="sam-js" src="samjs.min.js"></script>', 1)
    def ext_script(m):
        global n
        attrs, body = m.group(1), m.group(2)
        if 'src=' in attrs: return m.group(0)
        n += 1; name = f'forge-{n}.js'; (out/name).write_text(body)
        return f'<script{attrs} src="{name}"></script>'
    e = re.sub(r'<script([^>]*)>(.*?)</script>', ext_script, e, flags=re.S)
    assert '<script>' not in e and not re.search(r'<script(?![^>]*src=)[^>]*>', e)
    (out/'index.html').write_text(e)
    shutil.copy(H/'vendor/samjs.min.js', out/'samjs.min.js')
    (out/'nova').mkdir(exist_ok=True)
    for f in (H/'nova').glob('*.webp'): shutil.copy(f, out/'nova'/f.name)
    print('extension copy:', out, n, 'scripts')
