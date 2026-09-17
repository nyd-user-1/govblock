"""A dBASE reader for the Census shapefiles' attribute tables, with no dependencies."""

import struct


def read_bytes(data):
    count = struct.unpack("<I", data[4:8])[0]
    header_len = struct.unpack("<H", data[8:10])[0]
    record_len = struct.unpack("<H", data[10:12])[0]
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        name = data[pos : pos + 11].split(b"\0")[0].decode()
        fields.append((name, data[pos + 16]))
        pos += 32
    rows = []
    for i in range(count):
        rec = data[header_len + i * record_len : header_len + (i + 1) * record_len]
        at = 1
        row = {}
        for name, length in fields:
            row[name] = rec[at : at + length].decode("latin1").strip()
            at += length
        rows.append(row)
    return rows
