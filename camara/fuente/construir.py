#!/usr/bin/env python3
"""Empaqueta el visor en UN solo index.html autocontenido (Three.js 0.170.0 incluido, sin servicios externos).
Uso: python construir.py <carpeta con node_modules (three, esbuild)>   → ../index.html"""
import html, subprocess, sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
npm = Path(sys.argv[1])
esbuild = npm / "node_modules" / ".bin" / ("esbuild.cmd" if sys.platform == "win32" else "esbuild")
r = subprocess.run([str(esbuild), str(AQUI / "visor.mjs"), "--bundle", "--minify", "--format=iife", "--target=es2020",
                    f"--alias:three={npm / 'node_modules' / 'three' / 'build' / 'three.module.min.js'}"],
                   capture_output=True, text=True, encoding="utf-8")
if r.returncode:
    sys.exit(r.stderr)
js = r.stdout.replace("</script", "<\\/script")
prompt = html.escape((AQUI / "prompt.txt").read_text(encoding="utf-8").strip(), quote=False)
doc = (AQUI / "plantilla.html").read_text(encoding="utf-8").replace("/*PROMPT*/", prompt)
(AQUI.parent / "index.html").write_text(doc.replace("/*BUNDLE*/", js), encoding="utf-8")
print("index.html", round((AQUI.parent / "index.html").stat().st_size / 1024), "KB")
