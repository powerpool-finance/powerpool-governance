#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the ganache instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
    kill -9 $ganache_pid
  fi
}

ganache_port=8545

ganache_running() {
  nc -z localhost "$ganache_port"
}

relayer_running() {
  nc -z localhost "$relayer_port"
}

start_ganache() {
  yarn run node > /dev/null &

  ganache_pid=$!

  echo "Waiting for Buidler RVM to launch on port "$ganache_port"..."

  while ! ganache_running; do
    sleep 0.1 # wait for 1/10 of the second before check again
  done

  echo "Buidler EVM launched!"
}

if ganache_running; then
  echo "Using existing Buidler EVM instance"
else
  echo "Starting our own Buidler EVM instance"
  start_ganache
fi

REPORT_GAS=true yarn run test:local "$@"
