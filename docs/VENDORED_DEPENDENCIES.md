# Vendored dependencies

`./build.sh` cross-compiles three custom Buildroot packages directly from
local checkouts via `OVERRIDE_SRCDIR` (see `docs/DEPLOY.md`), rather than
downloading tarballs. Two of those checkouts — plus the full Buildroot
tree itself — are **pristine, unmodified upstream source** and are not
tracked in this repo (they're large, and re-cloning them is simpler than
carrying a second copy of someone else's project history). The third,
`libkiwix_stashpi/`, **is** tracked here, because it carries StashPi's
actual customizations (theme, templates, favicons — see
`libkiwix_stashpi/static/skin/stashpi-theme.css`).

To rebuild a fresh checkout, re-clone each at the exact commit below —
`build.sh` expects them at these paths relative to the repo root.

| Path | Upstream | Pinned commit | Tracked here? |
|---|---|---|---|
| `buildroot/` | https://github.com/buildroot/buildroot.git | `72d9d4fa636a371ef9eb99c92a735ce9f6d829d5` (2026.05.2) | No — re-clone |
| `deps/libzim` | https://github.com/openzim/libzim.git | `26ec526f74e8342a40da5ab14e364546988e0e1a` (v9.8.2) | No — re-clone |
| `kiwix-tools/` | https://github.com/kiwix/kiwix-tools.git | `f433911c09c89f90b15ea3c9ee13a7fff5fad001` | No — re-clone |
| `libkiwix_stashpi/` | https://github.com/brianharperr/libkiwix_infobox.git | forked at `9deee89a9409403a9211236d02c573a640a4d7e2`, since customized in place | **Yes** — tracked directly, its own `.git` history was dropped in favor of this repo's |

```sh
git clone --branch 2026.05.2 https://github.com/buildroot/buildroot.git
git clone https://github.com/openzim/libzim.git deps/libzim
git -C deps/libzim checkout 26ec526f74e8342a40da5ab14e364546988e0e1a
git clone https://github.com/kiwix/kiwix-tools.git
git -C kiwix-tools checkout f433911c09c89f90b15ea3c9ee13a7fff5fad001
```

After re-cloning `deps/libzim` and `kiwix-tools`, rebuild the host-side
tools that link against them (`local/lib/`, `tools/dir2zim`, and
`kiwix-tools/build/`'s `kiwix-serve`/`kiwix-manage`) — see
`docs/DEPLOY.md` and the memory note on stale build artifacts if working
from an assistant session: editing source under these trees or
`libkiwix_stashpi/` does nothing to already-compiled binaries until they
are explicitly rebuilt.

`local/` (compiled `.so`s and headers — the host build output of
`deps/libzim` + `libkiwix_stashpi`) and every `build/` directory
(meson/ninja output) are build artifacts, not source, and are also
excluded — see `.gitignore`.
