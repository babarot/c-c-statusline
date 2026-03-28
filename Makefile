BIN := c-c-statusline
PREFIX := $(HOME)/.claude

.PHONY: build install clean test

build:
	deno task compile

install: build
	install -d $(PREFIX)
	install -m 755 $(BIN) $(PREFIX)/$(BIN)

clean:
	rm -f $(BIN)

test:
	deno task test
