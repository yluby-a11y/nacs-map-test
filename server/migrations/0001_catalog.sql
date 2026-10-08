CREATE TABLE places (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('charger','restaurant')),
 name TEXT NOT NULL,
 address TEXT NOT NULL DEFAULT '',
 latitude REAL,
 longitude REAL,
 navigation_latitude REAL,
 navigation_longitude REAL,
 navigation_verified INTEGER NOT NULL DEFAULT 0 CHECK(navigation_verified IN (0,1)),
 payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE INDEX places_kind_id ON places(kind,id);
CREATE INDEX places_location ON places(kind,latitude,longitude);
CREATE TABLE catalog_versions (
 id INTEGER PRIMARY KEY CHECK(id=1),
 version TEXT NOT NULL,
 chargers INTEGER NOT NULL,
 restaurants INTEGER NOT NULL
);
