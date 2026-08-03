# TraceLens

A polished browser-based toolkit for technical analysis and local file intelligence.

## Included tools

- Domain Intel using DNS-over-HTTPS
- IP Lookup with ASN and location context
- Hash Lab for text and local files
- File Intel with metadata, image dimensions, basic JPEG EXIF and SHA-256

## Run locally

Serve the repository with any static web server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Privacy

Files are processed locally in the browser and are not uploaded by TraceLens. Domain and IP lookups use public lookup services.
