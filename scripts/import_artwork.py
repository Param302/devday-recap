"""Render the supplied immutable PDF; never reconstruct its artwork.
Usage: npm run assets:import -- /absolute/path/DevDay_Community_New_Delhi_A4_Print.pdf
Requires PyMuPDF. Keep the source Library identity/version with the supplied file.
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path
import fitz

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
metadata_path = root / 'src/artwork.json'
metadata = json.loads(metadata_path.read_text())
doc = fitz.open(source)
if len(doc) != 2:
    raise SystemExit('Expected the original two-page version-3 print PDF. Verify the source before import.')
page = doc[0]
text = page.get_text()
if not all(word in text for word in ['DevDay', 'DelhiNCR', 'Ambassadors', '#DevDayCommunity']):
    raise SystemExit('Artwork text does not match the supplied print reference.')
assets = root / 'public/assets'
assets.mkdir(parents=True, exist_ok=True)
shutil.copy2(source, assets / 'DevDay_Community_New_Delhi_A4_Print.pdf')
page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), alpha=False).save(assets / 'devday-original-page-1.png')
metadata.update(available=True, safeRegionsVerified=False, aspectRatio=page.rect.width / page.rect.height, sha256=hashlib.sha256(source.read_bytes()).hexdigest())
metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')
print('Original page 1 rendered without alteration. Verify the writing zone against the original pixels before public release. Page 2 remains intact in the retained PDF.')
