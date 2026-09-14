STASHPI_TOPDIR = $(shell cd $(BR2_EXTERNAL_STASHPI_PATH)/../.. && pwd)

include $(sort $(wildcard $(BR2_EXTERNAL_STASHPI_PATH)/package/*/*.mk))
