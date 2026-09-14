################################################################################
#
# libkiwix-stashpi
#
################################################################################

LIBKIWIX_STASHPI_VERSION = local
LIBKIWIX_STASHPI_SITE = unused
LIBKIWIX_STASHPI_OVERRIDE_SRCDIR = $(STASHPI_TOPDIR)/libkiwix_stashpi
LIBKIWIX_STASHPI_INSTALL_STAGING = YES
LIBKIWIX_STASHPI_LICENSE = GPL-3.0+
LIBKIWIX_STASHPI_LICENSE_FILES = COPYING

LIBKIWIX_STASHPI_DEPENDENCIES = \
	libzim-stashpi icu pugixml libcurl libmicrohttpd zlib xapian

LIBKIWIX_STASHPI_CONF_OPTS = \
	-Dtests=false \
	-Ddoc=false \
	-Dstatic-linkage=false

$(eval $(meson-package))
