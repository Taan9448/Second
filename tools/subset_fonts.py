"""Regenerate the checked-in Korean webfonts from locally installed Noto CJK.

Requires Python fonttools and brotli. Normal game builds use the committed WOFF2
files and do not need Python or a system font installation.
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
text = ''.join(p.read_text() for p in (root / 'src').rglob('*') if p.suffix in {'.ts', '.tsx', '.css'})
characters = set(text) | {chr(i) for i in range(32, 127)}
for source, target in [
    ('NotoSansCJK-Regular.ttc', 'sans-regular.woff2'),
    ('NotoSerifCJK-Regular.ttc', 'serif-regular.woff2'),
    ('NotoSerifCJK-Bold.ttc', 'serif-bold.woff2'),
]:
    font = TTFont('/usr/share/fonts/opentype/noto/' + source, fontNumber=1)
    options = subset.Options()
    options.flavor = 'woff2'
    options.name_IDs = [1, 2, 4, 6, 13, 14]
    builder = subset.Subsetter(options=options)
    builder.populate(text=''.join(sorted(characters)))
    builder.subset(font)
    font.flavor = 'woff2'
    font.save(root / 'public' / 'fonts' / target)
    print(target, (root / 'public' / 'fonts' / target).stat().st_size)
