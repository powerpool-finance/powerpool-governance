.PHONY: test
cleanup:
	rm -rf artifacts
compile: cleanup
	yarn compile
test:
	yarn test
ctest: compile test
