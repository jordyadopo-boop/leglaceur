# Studio de rendu 3D — Le Glaceur

Scènes Three.js qui produisent les visuels produits `barres` et `gobelet` (Ice Cup) du site.
Outil interne : ces fichiers ne font pas partie du build Vite.

```bash
node tools/renders/render.mjs barres                 # aperçu 800×1000 dans ./renders-out/
node tools/renders/render.mjs gobelet --final --out /tmp/rendus      # 3200×4000 → 1600×2000 (lanczos3)
node tools/renders/render.mjs gobelet --final --publish             # + public/img/gobelet-{480,960,1600}.{avif,webp}
```

- `lib.js` : studio (environnement PMREM à boîtes à lumière, fond en espace écran, sol mouillé à réflexion
  miroir, matériaux glace, rendu en couches arrière → avant pour voir la glace à travers la glace, bloom/vignette/grain).
- `scene-barres.js` : barres de 10 kg et 5 kg (cœur blanc, bulles, givre), glaçons, gouttes.
- `scene-gobelet.js` : gobelet PET + couvercle dôme, glaçons creux, condensation procédurale.
- Chromium SwiftShader : `CHROMIUM_PATH` (défaut `/opt/pw-browsers/chromium`). Compter 2 à 5 min par rendu final.
