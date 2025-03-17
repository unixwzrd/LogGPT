include VERSION.mk

PACKAGE = loggpt-conv-export-ext

PACKAGE_FF = $(PACKAGE)-$(VERSION)-$(MANIFEST_VER_FIREFOX)
PACKAGE_GC = $(PACKAGE)-$(VERSION)-$(MANIFEST_VER_CHROME)

SOURCES = \
	icons \
	loggpt-conv-export.js \
	README.md \
	README-ja.md

MANIFEST = \
	manifest-v2.json \
	manifest-v3.json

all: package

src-package: $(SOURCES) $(MANIFEST)
	zip -r $(PACKAGE)-$(VERSION)-src.zip $(SOURCES) $(MANIFEST)
	zip -Tv $(PACKAGE)-$(VERSION)-src.zip
	ls -l *.zip

firefox:
	mkdir __package
	cp -av $(SOURCES) __package/
	cp -v manifest-v2.json __package/manifest.json
	cd __package/ && zip -r $(PACKAGE_FF).zip $(SOURCES) manifest.json
	mv __package/*.zip .
	zip -Tv $(PACKAGE_FF).zip
	rm -rf __package/
	ls -l *.zip

chrome:
	mkdir __package
	cp -av $(SOURCES) __package/
	cp -v manifest-v3.json __package/manifest.json
	cd __package/ && zip -r $(PACKAGE_GC).zip $(SOURCES) manifest.json
	mv __package/*.zip .
	zip -Tv $(PACKAGE_GC).zip
	rm -rf __package/
	ls -l *.zip

clean:
	-@rm -rf __package/
	-@rm $(PACKAGE)-*.zip
	-@rm manifest.json
