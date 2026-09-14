################################################################################
#
# kiwix-tools-stashpi
#
################################################################################

KIWIX_TOOLS_STASHPI_VERSION = local
KIWIX_TOOLS_STASHPI_SITE = unused
KIWIX_TOOLS_STASHPI_OVERRIDE_SRCDIR = $(STASHPI_TOPDIR)/kiwix-tools
KIWIX_TOOLS_STASHPI_LICENSE = GPL-3.0+
KIWIX_TOOLS_STASHPI_LICENSE_FILES = COPYING

KIWIX_TOOLS_STASHPI_DEPENDENCIES = libkiwix-stashpi libzim-stashpi docopt-cpp

KIWIX_TOOLS_STASHPI_CONF_OPTS = \
	-Dstatic-linkage=false \
	-Ddoc=false

$(eval $(meson-package))
