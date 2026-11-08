package main

import (
	"net"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBind_ExplicitPort(t *testing.T) {
	// Take a random port, release it, and bind it explicitly.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	port := ln.Addr().(*net.TCPAddr).Port
	require.NoError(t, ln.Close())

	got, gotPort, err := bind("127.0.0.1:" + strconv.Itoa(port))
	require.NoError(t, err)
	defer got.Close()
	assert.Equal(t, port, gotPort)
}

func TestBind_ProbesUpwardWhenBusy(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer ln.Close()
	busy := ln.Addr().(*net.TCPAddr).Port

	got, gotPort, err := bind("127.0.0.1:" + strconv.Itoa(busy))
	require.NoError(t, err)
	defer got.Close()
	assert.Greater(t, gotPort, busy)
}

func TestBind_PortZeroUsesOSAssigned(t *testing.T) {
	got, gotPort, err := bind("127.0.0.1:0")
	require.NoError(t, err)
	defer got.Close()
	assert.Greater(t, gotPort, 0)
	assert.Contains(t, got.Addr().String(), "127.0.0.1")
}

func TestBind_InvalidAddr(t *testing.T) {
	_, _, err := bind("not-an-address")
	require.Error(t, err)
}
