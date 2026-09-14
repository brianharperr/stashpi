################################################################################
#
# libzim-stashpi
#
################################################################################

LIBZIM_STASHPI_VERSION = local
LIBZIM_STASHPI_SITE = unused
LIBZIM_STASHPI_OVERRIDE_SRCDIR = $(STASHPI_TOPDIR)/deps/libzim
LIBZIM_STASHPI_INSTALL_STAGING = YES
LIBZIM_STASHPI_LICENSE = GPL-2.0
LIBZIM_STASHPI_LICENSE_FILES = COPYING

LIBZIM_STASHPI_DEPENDENCIES = zlib xz zstd xapian icu

LIBZIM_STASHPI_CONF_OPTS = \
	-Dtests=false \
	-Dexamples=false \
	-Ddoc=false \
	-Dwith_xapian=true \
	-Dstatic-linkage=false

$(eval $(meson-package))
